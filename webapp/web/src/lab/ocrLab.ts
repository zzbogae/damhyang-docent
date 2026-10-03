// 스크린타임 캡처 읽기 시험 페이지: 고른 이미지마다 OCR 줄과 해석 결과를 window.__ocr 에 남긴다.
import { readImageText } from '../ocr/ocr';
import { readScreenTime } from '../import/screentime';

declare global { interface Window { __ocrRun: () => Promise<unknown[]> } }

const input = document.getElementById('files') as HTMLInputElement;
const out = document.getElementById('out')!;
window.__ocrRun = async () => {
  const rows = [];
  for (const f of Array.from(input.files ?? [])) {
    const t0 = performance.now();
    const lines = await readImageText(f);
    rows.push({ name: f.name, ms: Math.round(performance.now() - t0), lines: lines.map((l) => [l.text, +l.y.toFixed(3)]), reading: readScreenTime(lines) });
  }
  out.textContent = JSON.stringify(rows, null, 1);
  return rows;
};
