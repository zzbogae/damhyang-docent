// 비슷한 사진 묶기: 연속 촬영이나 같은 장면을 여러 번 찍은 사진은 한 장만 보여 주고 나머지는 접어 둔다.
// 차이 해시(dHash, 9×8 흑백 → 64비트)의 해밍 거리와 평균 색, 찍은 시각으로 판단한다. 사진은 기기 밖으로 나가지 않는다.
// 하늘·벽처럼 무늬가 거의 없는 사진은 차이 해시가 서로 비슷해지므로 평균 색이 가까울 때만 묶는다.

/** 9×8 흑백 화소(행 우선)에서 옆 화소보다 밝으면 1인 64비트 해시를 16진수 16자로 만든다. */
export function dhashFromGray(gray: ArrayLike<number>): string {
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** RGBA 화소(9×8)로 차이 해시 16자 + 평균 색 6자(RGB 각 2자)를 만든다. */
export function dhashFromRgba(rgba: ArrayLike<number>): string {
  const g = new Array<number>(72);
  let r = 0, gr = 0, b = 0;
  for (let i = 0; i < 72; i++) {
    g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    r += rgba[i * 4]; gr += rgba[i * 4 + 1]; b += rgba[i * 4 + 2];
  }
  const h2 = (v: number) => Math.round(v / 72).toString(16).padStart(2, '0');
  return dhashFromGray(g) + h2(r) + h2(gr) + h2(b);
}

/** 평균 색 차이(RGB 채널 가운데 가장 큰 차이). 색 정보가 없는 해시끼리는 0. */
export function colorDist(a: string, b: string): number {
  if (a.length < 22 || b.length < 22) return 0;
  let m = 0;
  for (let k = 16; k < 22; k += 2) m = Math.max(m, Math.abs(parseInt(a.slice(k, k + 2), 16) - parseInt(b.slice(k, k + 2), 16)));
  return m;
}

const POP = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

export interface SimilarItem { id: string; dh?: string; date: string; hour: number; minute?: number }
export interface SimilarGroup<T extends SimilarItem> { rep: T; members: T[] }

/** 같은 날 가까운 시각(기본 60분 안)이면 해밍 거리 near(14) 이하, 시각이 멀면 same(4) 이하이고 평균 색이 가까울 때 같은 묶음으로 본다. 기준값은 docs/filter_eval.md. */
export function groupSimilar<T extends SimilarItem>(items: T[], opts: { near?: number; same?: number; windowMin?: number; color?: number } = {}): SimilarGroup<T>[] {
  const near = opts.near ?? 14;
  const same = opts.same ?? 4;
  const win = opts.windowMin ?? 60;
  const color = opts.color ?? 28;
  const t = (x: T) => x.hour * 60 + (x.minute ?? 30);
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || t(a) - t(b) || a.id.localeCompare(b.id));
  const groups: SimilarGroup<T>[] = [];
  for (const it of sorted) {
    let joined = false;
    if (it.dh) {
      // 최근 묶음부터 본다. 한 주의 사진은 많아야 수백 장이라 모든 묶음과 견줘도 몇 밀리초면 끝난다
      for (let k = groups.length - 1; k >= 0; k--) {
        const g = groups[k];
        const last = g.members[g.members.length - 1];
        if (!g.rep.dh) continue;
        const close = last.date === it.date && Math.abs(t(it) - t(last)) <= win;
        const d = Math.min(hamming(it.dh, g.rep.dh), last.dh ? hamming(it.dh, last.dh) : 64);
        if (d <= (close ? near : same) && colorDist(it.dh, g.rep.dh) <= color) { g.members.push(it); joined = true; break; }
      }
    }
    if (!joined) groups.push({ rep: it, members: [it] });
  }
  return groups;
}

/** 미리보기 이미지로 해시를 만든다(브라우저 전용). 실패하면 undefined 이고, 그 사진은 묶지 않고 그대로 보여 준다. */
export async function dhashOfBlob(blob: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(9, 8) : Object.assign(document.createElement('canvas'), { width: 9, height: 8 });
    const x = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, 0, 0, 9, 8);
    bmp.close();
    return dhashFromRgba(x.getImageData(0, 0, 9, 8).data);
  } catch {
    return undefined;
  }
}
