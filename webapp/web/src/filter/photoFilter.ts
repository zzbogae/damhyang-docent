// 사진 안전 필터: 기기 안(브라우저)에서만 실행한다. 사진은 밖으로 나가지 않는다.
// 순서: (1) 화면 캡처 규칙 → (2) 글자 영역(PP-OCRv5 det) → (3) 얼굴(MediaPipe BlazeFace).
// 모델을 못 불러오거나 사진을 해독하지 못하면 status 'error' 를 돌려주고, 호출하는 쪽은 그 사진을 보여 주지 않는다.
import exifr from 'exifr';
import type { PhotoFilterReason } from '../types';

export interface PhotoFilterOptions {
  /** 모델 파일이 있는 기준 경로. 기본값은 앱 BASE_URL + 'models/' */
  modelBase?: string;
  /** 글자 확률맵에서 글자로 보는 확률(PaddleOCR DB 후처리 기본값 0.3) */
  textProbThreshold?: number;
  /** 글자 면적 비율이 이 값 이상이면 문서류로 보고 숨긴다(시험셋으로 정함, docs/filter_eval.md) */
  textRatioThreshold?: number;
  /** 얼굴 모델: 가까운 거리용만, 먼 거리용만, 둘 다 */
  faceModel?: 'short' | 'full' | 'both';
  /** 얼굴로 인정하는 최소 점수 */
  minFaceScore?: number;
  /** 해독할 때 긴 변 길이 */
  maxSide?: number;
  /** 글자 검출에 넣을 긴 변 길이(32의 배수로 맞춤) */
  textSide?: number;
  /** 미리보기 썸네일 긴 변 길이 */
  thumbSide?: number;
  /** 숨긴 얼굴 사진에도 얼굴을 흐린 썸네일을 만들지 */
  blurredThumbForFaces?: boolean;
  /** 작은 얼굴용 타일 검사: 사진을 n×n 으로 나눠 먼 거리용 모델을 한 번 더 돌린다(0 이면 끔) */
  faceTiles?: number;
  /** 타일 검사에 쓸 해독 해상도(긴 변) */
  tileSourceSide?: number;
  /** 타일에서 찾은 얼굴로 인정하는 최소 점수 */
  minTileFaceScore?: number;
  /** 이미 숨길 이유가 있으면 타일 검사를 건너뛴다(시험 페이지는 기록을 위해 끔) */
  skipTilesIfHidden?: boolean;
}

export interface FaceBox { x: number; y: number; w: number; h: number; score: number; model: 'short' | 'full' | 'tile' }

export interface PhotoFilterResult {
  status: 'ok' | 'hidden' | 'error';
  reasons: PhotoFilterReason[];
  faces: number;
  faceBoxes: FaceBox[]; // 0~1 정규화 좌표
  textRatio: number | null;
  screenshot: boolean;
  width?: number;
  height?: number;
  ms: number;
  thumb?: Blob;
  thumbBlurred?: boolean;
  error?: string;
}

export const DEFAULTS: Required<Omit<PhotoFilterOptions, 'modelBase'>> = {
  textProbThreshold: 0.3,
  textRatioThreshold: 0.015,
  faceModel: 'both',
  minFaceScore: 0.5,
  maxSide: 640,
  textSide: 640,
  thumbSide: 320,
  blurredThumbForFaces: true,
  faceTiles: 3,
  tileSourceSide: 960,
  minTileFaceScore: 0.6,
  skipTilesIfHidden: true,
};

const SCREENSHOT_NAME = /(screen ?shot|screenshot|스크린샷|스크린 ?캡처|화면 ?캡처|screen_?capture|capture_\d)/i;

function defaultModelBase(): string {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  return `${base}models/`;
}

// ---------------------------------------------------------------- 모델 준비(한 번만)
type FaceDetectorT = import('@mediapipe/tasks-vision').FaceDetector;
type OrtT = typeof import('onnxruntime-web/wasm');

let facePromise: Promise<{ short?: FaceDetectorT; full?: FaceDetectorT }> | null = null;
let textPromise: Promise<{ ort: OrtT; session: import('onnxruntime-web/wasm').InferenceSession }> | null = null;
let facePromiseKey = '';

function loadFaces(modelBase: string, which: 'short' | 'full' | 'both') {
  const key = `${modelBase}|${which}`;
  if (facePromise && facePromiseKey === key) return facePromise;
  facePromiseKey = key;
  facePromise = (async () => {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(`${modelBase}mediapipe-wasm`);
    const make = (file: string) =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${modelBase}${file}`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.3, // 점수 기준은 결과를 받은 뒤 minFaceScore 로 거른다
      });
    const out: { short?: FaceDetectorT; full?: FaceDetectorT } = {};
    if (which !== 'full') out.short = await make('blaze_face_short_range.tflite');
    if (which !== 'short') out.full = await make('blaze_face_full_range.tflite');
    return out;
  })();
  facePromise.catch(() => { facePromise = null; });
  return facePromise;
}

function loadText(modelBase: string) {
  if (textPromise) return textPromise;
  textPromise = (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths = `${modelBase}ort/`;
    ort.env.wasm.numThreads = 1; // COOP/COEP 없이도 돌도록 단일 스레드
    const session = await ort.InferenceSession.create(`${modelBase}ppocrv5_mobile_det.onnx`, {
      executionProviders: ['wasm'],
    });
    return { ort, session };
  })();
  textPromise.catch(() => { textPromise = null; });
  return textPromise;
}

/** 모델을 미리 불러 둔다(첫 사진에서 기다리지 않게). 실패하면 예외를 던진다. */
export async function warmupPhotoFilter(opts: PhotoFilterOptions = {}) {
  const o = { ...DEFAULTS, ...opts };
  const base = opts.modelBase ?? defaultModelBase();
  await Promise.all([loadFaces(base, o.faceModel), loadText(base)]);
}

// ---------------------------------------------------------------- 해독
type Canvas2D = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function ctx2d(c: Canvas2D) {
  return (c as any).getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
}

async function sniff(blob: Blob): Promise<'png' | 'jpeg' | 'heic' | 'other'> {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  const brand = String.fromCharCode(...b.slice(4, 12));
  if (brand.startsWith('ftyp') && /heic|heix|hevc|heim|heis|mif1|msf1/.test(brand.slice(4))) return 'heic';
  return 'other';
}

async function decodeHeic(blob: Blob): Promise<ImageData> {
  const mod: any = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
  const libheif = (mod.default ?? mod)();
  const decoder = new libheif.HeifDecoder();
  const data = decoder.decode(new Uint8Array(await blob.arrayBuffer()));
  if (!data || !data.length) throw new Error('heic_decode_empty');
  const image = data[0];
  const w = image.get_width();
  const h = image.get_height();
  const out = await new Promise<ImageData>((resolve, reject) => {
    const target = new ImageData(w, h);
    image.display(target, (res: ImageData | null) => (res ? resolve(res) : reject(new Error('heic_display'))));
  });
  for (const d of data) d.free?.();
  return out;
}

/** 사진을 긴 변 maxSide 로 줄여 캔버스에 그린다. EXIF 방향은 브라우저가 적용한다. */
async function decodeScaled(blob: Blob, kind: string, maxSide: number): Promise<{ canvas: Canvas2D; w: number; h: number; ow: number; oh: number }> {
  let source: ImageBitmap | null = null;
  let imageData: ImageData | null = null;
  try {
    source = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch (e) {
    if (kind !== 'heic') throw e;
  }
  if (!source) {
    imageData = await decodeHeic(blob);
  }
  const ow = source ? source.width : imageData!.width;
  const oh = source ? source.height : imageData!.height;
  const scale = Math.min(1, maxSide / Math.max(ow, oh));
  const w = Math.max(1, Math.round(ow * scale));
  const h = Math.max(1, Math.round(oh * scale));
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  if (source) {
    ctx.drawImage(source, 0, 0, w, h);
    source.close();
  } else {
    const tmp = makeCanvas(ow, oh);
    ctx2d(tmp).putImageData(imageData!, 0, 0);
    ctx.drawImage(tmp as any, 0, 0, w, h);
  }
  return { canvas, w, h, ow, oh };
}

// ---------------------------------------------------------------- 글자 영역
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

async function textAreaRatio(canvas: Canvas2D, w: number, h: number, side: number, probThr: number, base: string) {
  const { ort, session } = await loadText(base);
  const scale = side / Math.max(w, h);
  const tw = Math.max(32, Math.round((w * scale) / 32) * 32);
  const th = Math.max(32, Math.round((h * scale) / 32) * 32);
  const c = makeCanvas(tw, th);
  const ctx = ctx2d(c);
  ctx.drawImage(canvas as any, 0, 0, tw, th);
  const px = ctx.getImageData(0, 0, tw, th).data;
  const n = tw * th;
  const input = new Float32Array(3 * n);
  // PaddleOCR 는 BGR 순서로 읽고 채널 순서대로 mean/std 를 적용한다
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    input[i] = (b - MEAN[0]) / STD[0];
    input[n + i] = (g - MEAN[1]) / STD[1];
    input[2 * n + i] = (r - MEAN[2]) / STD[2];
  }
  const feeds: Record<string, any> = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, th, tw]) };
  const out = await session.run(feeds);
  const prob = out[session.outputNames[0]].data as Float32Array;
  let on = 0;
  for (let i = 0; i < prob.length; i++) if (prob[i] > probThr) on++;
  return on / prob.length;
}

// ---------------------------------------------------------------- 얼굴
async function detectFaces(canvas: Canvas2D, w: number, h: number, which: 'short' | 'full' | 'both', minScore: number, base: string): Promise<FaceBox[]> {
  const det = await loadFaces(base, which);
  const boxes: FaceBox[] = [];
  const run = (d: FaceDetectorT | undefined, model: 'short' | 'full') => {
    if (!d) return;
    const res = d.detect(canvas as any);
    for (const x of res.detections) {
      const score = x.categories?.[0]?.score ?? 0;
      const bb = x.boundingBox;
      if (!bb || score < minScore) continue;
      boxes.push({ x: bb.originX / w, y: bb.originY / h, w: bb.width / w, h: bb.height / h, score, model });
    }
  };
  run(det.short, 'short');
  run(det.full, 'full');
  return boxes;
}

/** 작은 얼굴용: 원본을 n×n(가장자리 25% 겹침) 타일로 나눠 먼 거리용 모델을 돌린다. 모델 입력이 192px 로 고정이라
 * 사진 전체를 넣으면 멀리 있는 얼굴이 몇 픽셀로 줄어들기 때문이다. */
async function detectFacesTiled(src: Canvas2D, sw: number, sh: number, n: number, minScore: number, base: string): Promise<FaceBox[]> {
  if (n < 2) return [];
  const det = await loadFaces(base, 'both');
  const d = det.full ?? det.short;
  if (!d) return [];
  const boxes: FaceBox[] = [];
  const tw = Math.ceil((sw / n) * 1.25);
  const th = Math.ceil((sh / n) * 1.25);
  const stepX = n > 1 ? (sw - tw) / (n - 1) : 0;
  const stepY = n > 1 ? (sh - th) / (n - 1) : 0;
  const side = 384;
  const s = Math.min(1, side / Math.max(tw, th));
  const cw = Math.max(1, Math.round(tw * s)), ch = Math.max(1, Math.round(th * s));
  const c = makeCanvas(cw, ch);
  const ctx = ctx2d(c);
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const x0 = Math.round(ix * stepX), y0 = Math.round(iy * stepY);
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(src as any, x0, y0, tw, th, 0, 0, cw, ch);
      const res = d.detect(c as any);
      for (const x of res.detections) {
        const score = x.categories?.[0]?.score ?? 0;
        const bb = x.boundingBox;
        if (!bb || score < minScore) continue;
        boxes.push({
          x: (x0 + (bb.originX / cw) * tw) / sw, y: (y0 + (bb.originY / ch) * th) / sh,
          w: ((bb.width / cw) * tw) / sw, h: ((bb.height / ch) * th) / sh, score, model: 'tile',
        });
      }
    }
  }
  return boxes;
}

// ---------------------------------------------------------------- 썸네일
async function toBlob(c: Canvas2D, type = 'image/jpeg', quality = 0.8): Promise<Blob> {
  if ('convertToBlob' in c) return (c as OffscreenCanvas).convertToBlob({ type, quality });
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, quality));
}

/** 얼굴 영역을 모자이크한 썸네일. 캔버스 filter 가 없는 브라우저에서도 같은 결과가 나오게 축소·확대로 모자이크한다. */
export async function makeThumb(canvas: Canvas2D, w: number, h: number, side: number, faces: FaceBox[] = []): Promise<Blob> {
  const s = Math.min(1, side / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * s));
  const th = Math.max(1, Math.round(h * s));
  const c = makeCanvas(tw, th);
  const ctx = ctx2d(c);
  ctx.drawImage(canvas as any, 0, 0, tw, th);
  for (const f of faces) {
    const pad = 0.25;
    const x0 = Math.max(0, Math.floor((f.x - f.w * pad) * tw));
    const y0 = Math.max(0, Math.floor((f.y - f.h * pad) * th));
    const x1 = Math.min(tw, Math.ceil((f.x + f.w * (1 + pad)) * tw));
    const y1 = Math.min(th, Math.ceil((f.y + f.h * (1 + pad)) * th));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 2 || bh < 2) continue;
    const cells = 6;
    const tiny = makeCanvas(cells, cells);
    const tctx = ctx2d(tiny);
    tctx.drawImage(c as any, x0, y0, bw, bh, 0, 0, cells, cells);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny as any, 0, 0, cells, cells, x0, y0, bw, bh);
    ctx.imageSmoothingEnabled = true;
  }
  return toBlob(c);
}

// ---------------------------------------------------------------- 한 장
export async function filterPhoto(blob: Blob, name: string, opts: PhotoFilterOptions = {}): Promise<PhotoFilterResult> {
  const o = { ...DEFAULTS, ...opts };
  const base = opts.modelBase ?? defaultModelBase();
  const t0 = performance.now();
  const done = (r: Omit<PhotoFilterResult, 'ms'>): PhotoFilterResult => ({ ...r, ms: Math.round(performance.now() - t0) });

  let kind: Awaited<ReturnType<typeof sniff>> = 'other';
  try { kind = await sniff(blob); } catch { /* 아래 해독에서 걸러짐 */ }

  // (1) 화면 캡처: 카메라 제조사·모델 EXIF 가 없고, PNG 이거나 이름이 스크린샷
  let make: string | undefined, model: string | undefined;
  try {
    const tags = await exifr.parse(blob, ['Make', 'Model']);
    make = tags?.Make; model = tags?.Model;
  } catch { /* EXIF 없음 */ }
  const noCamera = !make && !model;
  const isPngLike = kind === 'png' || /\.png$/i.test(name) || blob.type === 'image/png';
  const screenshot = noCamera && (isPngLike || SCREENSHOT_NAME.test(name));
  if (screenshot) {
    return done({ status: 'hidden', reasons: ['screenshot'], faces: 0, faceBoxes: [], textRatio: null, screenshot: true });
  }

  // 해독
  let decoded: Awaited<ReturnType<typeof decodeScaled>>;
  try {
    decoded = await decodeScaled(blob, kind, o.faceTiles >= 2 ? Math.max(o.maxSide, o.tileSourceSide) : o.maxSide);
  } catch (e) {
    return done({ status: 'error', reasons: ['decode'], faces: 0, faceBoxes: [], textRatio: null, screenshot: false, error: String((e as Error)?.message ?? e) });
  }
  const big = decoded.canvas, bw = decoded.w, bh = decoded.h, ow = decoded.ow, oh = decoded.oh;
  let canvas: Canvas2D = big, w = bw, h = bh;
  if (Math.max(bw, bh) > o.maxSide) {
    const sc = o.maxSide / Math.max(bw, bh);
    w = Math.max(1, Math.round(bw * sc)); h = Math.max(1, Math.round(bh * sc));
    canvas = makeCanvas(w, h);
    const cx = ctx2d(canvas);
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(big as any, 0, 0, w, h);
  }

  const reasons: PhotoFilterReason[] = [];
  let textRatio: number | null = null;
  let faceBoxes: FaceBox[] = [];
  try {
    // (2) 글자 영역
    textRatio = await textAreaRatio(canvas, w, h, o.textSide, o.textProbThreshold, base);
    if (textRatio >= o.textRatioThreshold) reasons.push('text');
    // (3) 얼굴
    faceBoxes = await detectFaces(canvas, w, h, o.faceModel, o.minFaceScore, base);
    // 이미 숨길 이유가 있으면 타일 검사는 건너뛴다(시간 절약). 얼굴 흐림 썸네일이 필요한 얼굴 사진도 전체 검사 결과로 충분하다.
    if (o.faceTiles >= 2 && !(o.skipTilesIfHidden && (reasons.length || faceBoxes.length))) {
      faceBoxes.push(...(await detectFacesTiled(big, bw, bh, o.faceTiles, o.minTileFaceScore, base)));
    }
    if (faceBoxes.length) reasons.push('face');
  } catch (e) {
    return done({ status: 'error', reasons: ['model'], faces: 0, faceBoxes: [], textRatio, screenshot: false, width: ow, height: oh, error: String((e as Error)?.message ?? e) });
  }

  const faces = dedupeFaces(faceBoxes);
  let thumb: Blob | undefined;
  let thumbBlurred = false;
  try {
    if (!reasons.length) {
      thumb = await makeThumb(canvas, w, h, o.thumbSide);
    } else if (o.blurredThumbForFaces && reasons.length === 1 && reasons[0] === 'face') {
      thumb = await makeThumb(canvas, w, h, o.thumbSide, faces);
      thumbBlurred = true;
    }
  } catch { thumb = undefined; }

  return done({
    status: reasons.length ? 'hidden' : 'ok',
    reasons, faces: faces.length, faceBoxes: faces, textRatio, screenshot: false,
    width: ow, height: oh, thumb, thumbBlurred,
  });
}

/** 두 모델이 같은 얼굴을 각각 잡은 경우 하나로 센다(IoU 0.3 이상). */
function dedupeFaces(boxes: FaceBox[]): FaceBox[] {
  const out: FaceBox[] = [];
  for (const b of [...boxes].sort((a, c) => c.score - a.score)) {
    if (!out.some((k) => iou(k, b) >= 0.3)) out.push(b);
  }
  return out;
}

function iou(a: FaceBox, b: FaceBox) {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

// ---------------------------------------------------------------- 한 주
export interface FilterItem { id: string; blob: Blob; name: string }

/** 한 주(수십 장)의 사진을 차례로 검사한다. 모델은 한 번만 불러온다. */
export async function filterPhotos(
  items: FilterItem[],
  onProgress?: (done: number, total: number, id: string, r: PhotoFilterResult) => void,
  opts: PhotoFilterOptions = {},
): Promise<Map<string, PhotoFilterResult>> {
  const out = new Map<string, PhotoFilterResult>();
  let i = 0;
  for (const it of items) {
    let r: PhotoFilterResult;
    try {
      r = await filterPhoto(it.blob, it.name, opts);
    } catch (e) {
      r = { status: 'error', reasons: ['model'], faces: 0, faceBoxes: [], textRatio: null, screenshot: false, ms: 0, error: String(e) };
    }
    out.set(it.id, r);
    onProgress?.(++i, items.length, it.id, r);
  }
  return out;
}

/** PhotoRecord.filter 에 넣을 형태로 바꾼다. */
export function toRecordFilter(r: PhotoFilterResult) {
  return {
    status: r.status,
    reasons: r.reasons,
    faces: r.faces,
    textRatio: r.textRatio ?? undefined,
    checkedAt: new Date().toISOString(),
  };
}
