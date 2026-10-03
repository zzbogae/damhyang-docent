// 기기 안 글자 읽기(OCR): PP-OCRv5 글자 영역 검출(det) → 줄마다 한국어 인식(rec). 이미지와 글자는 밖으로 나가지 않는다.
// 용도는 스크린타임 캡처처럼 화면을 찍은 이미지에서 짧은 문구를 읽는 것이다. 사진 속 글자를 읽어 저장하는 데는 쓰지 않는다.
type OrtT = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;
type Canvas2D = OffscreenCanvas | HTMLCanvasElement;

export interface OcrLine { text: string; x: number; y: number; w: number; h: number; score: number }

let loaded: Promise<{ ort: OrtT; det: Session; rec: Session; dict: string[] }> | null = null;

export function defaultModelBase() {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  return `${base}models/`;
}

export function loadOcr(modelBase = defaultModelBase()) {
  if (loaded) return loaded;
  loaded = (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths = `${modelBase}ort/`;
    ort.env.wasm.numThreads = 1;
    const [det, rec, dict] = await Promise.all([
      ort.InferenceSession.create(`${modelBase}ppocrv5_mobile_det.onnx`, { executionProviders: ['wasm'] }),
      ort.InferenceSession.create(`${modelBase}korean_ppocrv5_mobile_rec.onnx`, { executionProviders: ['wasm'] }),
      fetch(`${modelBase}korean_ppocrv5_dict.json`).then((r) => r.json() as Promise<string[]>),
    ]);
    return { ort, det, rec, dict };
  })();
  loaded.catch(() => { loaded = null; });
  return loaded;
}

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const ctx2d = (c: Canvas2D) => (c as any).getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** 글자 영역 상자들(원본 좌표). 확률 지도를 이진화해 연결 성분의 바깥 상자를 조금 넓힌다(DB 후처리의 간이판). */
async function detect(src: Canvas2D, w: number, h: number, side = 960): Promise<{ x: number; y: number; w: number; h: number }[]> {
  const { ort, det } = await loadOcr();
  const s = side / Math.max(w, h);
  const tw = Math.max(32, Math.round((w * s) / 32) * 32);
  const th = Math.max(32, Math.round((h * s) / 32) * 32);
  const c = makeCanvas(tw, th);
  ctx2d(c).drawImage(src as any, 0, 0, tw, th);
  const px = ctx2d(c).getImageData(0, 0, tw, th).data;
  const n = tw * th;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    input[i] = (b - MEAN[0]) / STD[0];
    input[n + i] = (g - MEAN[1]) / STD[1];
    input[2 * n + i] = (r - MEAN[2]) / STD[2];
  }
  const out = await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, th, tw]) });
  const prob = out[det.outputNames[0]].data as Float32Array;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = prob[i] > 0.3 ? 1 : 0;
  const seen = new Uint8Array(n);
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!on[i] || seen[i]) continue;
    let x0 = tw, y0 = th, x1 = 0, y1 = 0, cnt = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % tw, y = (k - x) / tw;
      cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [k - 1, k + 1, k - tw, k + tw];
      for (const j of nb) {
        if (j < 0 || j >= n || seen[j] || !on[j]) continue;
        if ((j === k - 1 && x === 0) || (j === k + 1 && x === tw - 1)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (cnt < 12) continue;
    const bh = y1 - y0 + 1;
    const pad = Math.max(2, bh * 0.45);
    const sx = w / tw, sy = h / th;
    const bx = Math.max(0, (x0 - pad) * sx), by = Math.max(0, (y0 - pad) * sy);
    boxes.push({ x: bx, y: by, w: Math.min(w, (x1 + 1 + pad) * sx) - bx, h: Math.min(h, (y1 + 1 + pad) * sy) - by });
  }
  return boxes;
}

/** 줄 하나를 읽는다(CTC 탐욕 복호). */
async function recognize(src: Canvas2D, b: { x: number; y: number; w: number; h: number }): Promise<{ text: string; score: number }> {
  const { ort, rec, dict } = await loadOcr();
  const H = 48;
  const W = Math.max(16, Math.min(3200, Math.round((b.w / b.h) * H)));
  const c = makeCanvas(W, H);
  const cx = ctx2d(c);
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, W, H);
  cx.drawImage(src as any, b.x, b.y, b.w, b.h, 0, 0, W, H);
  const px = cx.getImageData(0, 0, W, H).data;
  const n = W * H;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = (px[i * 4 + 2] / 255 - 0.5) / 0.5;
    input[n + i] = (px[i * 4 + 1] / 255 - 0.5) / 0.5;
    input[2 * n + i] = (px[i * 4] / 255 - 0.5) / 0.5;
  }
  const out = await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, H, W]) });
  const t = out[rec.outputNames[0]];
  const [, T, C] = t.dims as number[];
  const d = t.data as Float32Array;
  let text = '', prev = 0, sum = 0, k = 0;
  for (let i = 0; i < T; i++) {
    let best = 0, bv = -Infinity;
    for (let j = 0; j < C; j++) { const v = d[i * C + j]; if (v > bv) { bv = v; best = j; } }
    if (best !== 0 && best !== prev) {
      text += best - 1 < dict.length ? dict[best - 1] : ' ';
      sum += bv; k++;
    }
    prev = best;
  }
  return { text: text.trim(), score: k ? sum / k : 0 };
}

/** 이미지 파일 → 읽은 줄(위에서 아래, 왼쪽에서 오른쪽). */
export async function readImageText(blob: Blob, maxSide = 1600): Promise<OcrLine[]> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = makeCanvas(w, h);
  ctx2d(c).drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const boxes = await detect(c, w, h);
  const lines: OcrLine[] = [];
  for (const b of boxes) {
    if (b.h < 6 || b.w < 6) continue;
    const r = await recognize(c, b);
    if (r.text) lines.push({ text: r.text, x: b.x / w, y: b.y / h, w: b.w / w, h: b.h / h, score: r.score });
  }
  lines.sort((a, b) => (Math.abs(a.y - b.y) < 0.01 ? a.x - b.x : a.y - b.y));
  return lines;
}
