// 비슷한 사진 묶기 시험: 시험셋 사진마다 흔한 변형(살짝 자르기·옮기기·밝기·재압축·기울이기·연속 촬영)을 만들어
// 원본과 묶이는지, 서로 다른 사진끼리 잘못 묶이는지를 앱과 같은 경로(긴 변 320px 미리보기 JPEG → 9×8 해시)로 잰다.
import { colorDist, dhashOfBlob, hamming } from '../photos/similar';

type Draw = (ctx: OffscreenCanvasRenderingContext2D, src: ImageBitmap, w: number, h: number) => void;

const VARIANTS: Record<string, Draw> = {
  crop: (c, s, w, h) => c.drawImage(s, s.width * 0.06, s.height * 0.06, s.width * 0.88, s.height * 0.88, 0, 0, w, h),
  shift: (c, s, w, h) => c.drawImage(s, s.width * 0.05, 0, s.width * 0.95, s.height, 0, 0, w, h),
  bright: (c, s, w, h) => { c.filter = 'brightness(1.15)'; c.drawImage(s, 0, 0, w, h); c.filter = 'none'; },
  rotate: (c, s, w, h) => { c.translate(w / 2, h / 2); c.rotate((3 * Math.PI) / 180); c.scale(1.08, 1.08); c.drawImage(s, -w / 2, -h / 2, w, h); c.setTransform(1, 0, 0, 1, 0, 0); },
  burst: (c, s, w, h) => { c.filter = 'brightness(1.05)'; c.drawImage(s, s.width * 0.03, s.height * 0.02, s.width * 0.95, s.height * 0.96, 0, 0, w, h); c.filter = 'none'; },
};

async function thumb(src: ImageBitmap, draw: Draw, quality = 0.8): Promise<Blob> {
  const sc = 320 / Math.max(src.width, src.height);
  const w = Math.round(src.width * sc), h = Math.round(src.height * sc);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  draw(ctx, src, w, h);
  return c.convertToBlob({ type: 'image/jpeg', quality });
}

async function recompress(file: Blob): Promise<ImageBitmap> {
  const b = await createImageBitmap(file);
  const c = new OffscreenCanvas(b.width, b.height);
  c.getContext('2d')!.drawImage(b, 0, 0);
  return createImageBitmap(await c.convertToBlob({ type: 'image/jpeg', quality: 0.4 }));
}

export interface SimilarRow { name: string; base: string; variants: Record<string, { ham: number; color: number }> }

async function run(): Promise<{ rows: SimilarRow[]; pairs: { a: string; b: string; ham: number; color: number }[] }> {
  const files = Array.from((document.getElementById('files') as HTMLInputElement).files ?? []);
  const rows: SimilarRow[] = [];
  for (const f of files) {
    const src = await createImageBitmap(f);
    const plain: Draw = (c, s, w, h) => c.drawImage(s, 0, 0, w, h);
    const base = (await dhashOfBlob(await thumb(src, plain)))!;
    const variants: SimilarRow['variants'] = {};
    for (const [k, d] of Object.entries(VARIANTS)) {
      const dh = (await dhashOfBlob(await thumb(src, d)))!;
      variants[k] = { ham: hamming(base, dh), color: colorDist(base, dh) };
    }
    const rc = await recompress(f);
    const dj = (await dhashOfBlob(await thumb(rc, plain)))!;
    variants.jpeg = { ham: hamming(base, dj), color: colorDist(base, dj) };
    rows.push({ name: f.name, base, variants });
  }
  const pairs = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    pairs.push({ a: rows[i].name, b: rows[j].name, ham: hamming(rows[i].base, rows[j].base), color: colorDist(rows[i].base, rows[j].base) });
  }
  document.getElementById('status')!.textContent = `완료 ${rows.length}장 · 서로 다른 사진 쌍 ${pairs.length}개`;
  return { rows, pairs };
}

declare global { interface Window { __similarRun: typeof run } }
window.__similarRun = run;
