// 필터 시험 페이지: 고른 사진마다 필터를 돌려 결과를 화면과 window.__filter 에 남긴다.
import { filterPhoto, warmupPhotoFilter, type PhotoFilterOptions, type PhotoFilterResult } from '../filter/photoFilter';

type Row = Omit<PhotoFilterResult, 'thumb'> & { name: string; thumbBytes: number };
declare global {
  interface Window { __filter: { rows: Row[]; done: boolean; warmupMs: number; error?: string }; __filterRun: (o?: PhotoFilterOptions) => Promise<Row[]> }
}

const input = document.getElementById('files') as HTMLInputElement;
const grid = document.getElementById('grid')!;
const status = document.getElementById('status')!;
window.__filter = { rows: [], done: false, warmupMs: 0 };

// 시험에서는 점수 기준을 낮춰 모든 후보를 남기고, 기준값 비교는 결과를 받은 쪽에서 한다.
const LAB_OPTS: PhotoFilterOptions = { minFaceScore: 0.3, faceModel: 'both', faceTiles: 3, minTileFaceScore: 0.3, skipTilesIfHidden: false };

// ?prod 로 열면 앱이 실제로 쓰는 기본값(DEFAULTS)으로 돌린다.
const PROD = new URLSearchParams(location.search).has('prod');

async function run(opts: PhotoFilterOptions = PROD ? {} : LAB_OPTS): Promise<Row[]> {
  const files = Array.from(input.files ?? []);
  window.__filter = { rows: [], done: false, warmupMs: 0 };
  grid.innerHTML = '';
  const t0 = performance.now();
  try {
    await warmupPhotoFilter(opts);
  } catch (e) {
    window.__filter.error = String(e);
  }
  window.__filter.warmupMs = Math.round(performance.now() - t0);
  status.textContent = `모델 준비 ${window.__filter.warmupMs}ms · ${files.length}장 검사 중`;
  for (const f of files) {
    const r = await filterPhoto(f, f.name, opts);
    const { thumb, ...rest } = r;
    const row: Row = { ...rest, name: f.name, thumbBytes: thumb?.size ?? 0 };
    window.__filter.rows.push(row);
    const fig = document.createElement('figure');
    let img: HTMLElement;
    if (thumb) {
      const el = document.createElement('img');
      el.src = URL.createObjectURL(thumb);
      el.alt = f.name;
      img = el;
    } else {
      img = document.createElement('div');
      img.className = 'noimg';
      img.textContent = r.status === 'error' ? '해독 실패: 보여 주지 않음' : '숨김: 미리보기를 만들지 않음';
    }
    const cap = document.createElement('figcaption');
    const faces = r.faceBoxes.map((b) => `${b.model}:${b.score.toFixed(2)}`).join(' ');
    cap.innerHTML = `<span class="${r.status}">${r.status}</span> ${r.reasons.join(',')}<br>${f.name}<br>글자 ${r.textRatio === null ? '-' : (r.textRatio * 100).toFixed(1) + '%'} · 얼굴 ${r.faces} ${faces} · ${r.ms}ms${r.thumbBlurred ? ' · 흐림' : ''}${r.error ? '<br>' + r.error : ''}`;
    fig.append(img, cap);
    grid.append(fig);
  }
  window.__filter.done = true;
  status.textContent = `완료 ${files.length}장 · 모델 준비 ${window.__filter.warmupMs}ms`;
  return window.__filter.rows;
}

input.addEventListener('change', () => { void run(); });
window.__filterRun = run;
