// 구글 피트니스(Google Takeout 'Fit'·'피트니스' 폴더). 걸음수는 일일 활동 측정항목 CSV 의 합계 파일에서,
// 잠은 모든 세션(All Sessions) JSON 의 수면 세션에서 읽는다. 머리글은 영어 판을 기준으로 하고,
// 한국어 판 머리글은 실물을 확인하지 못해 '걸음 수'·'날짜' 같은 말이 들어간 열을 넓게 잡는다(추정).
import type { LocalTime } from '../dates';
import { isoToLocal, wall } from '../dates';
import type { HealthAcc } from './health';

const SRC = 'google-fit';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** 일일 활동 측정항목 합계 CSV → 날짜별 걸음수(그리고 있으면 수면 시간). 읽은 날 수를 돌려준다. */
export function parseFitDaily(text: string, health: HealthAcc): number {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return 0;
  const head = splitCsvLine(lines[0]);
  const iDate = head.findIndex((h) => /^(date|날짜)$/i.test(h));
  const iSteps = head.findIndex((h) => /^(step count|걸음\s*수)/i.test(h));
  const iSleep = head.findIndex((h) => /^(sleep duration \(ms\)|수면\s*시간\s*\(ms\))/i.test(h));
  if (iDate < 0 || (iSteps < 0 && iSleep < 0)) return 0;
  health.sources.add(SRC);
  let n = 0;
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c[iDate] ?? '');
    if (!d) continue;
    const date = `${d[1]}-${d[2]}-${d[3]}`;
    let any = false;
    const steps = iSteps >= 0 ? Number(c[iSteps]) : NaN;
    if (Number.isFinite(steps) && steps > 0) { health.setStepsMax(date, SRC, steps); any = true; }
    const ms = iSleep >= 0 ? Number(c[iSleep]) : NaN;
    if (Number.isFinite(ms) && ms > 0) {
      // 합계만 있으면 그날 아침 7시에 깬 잠으로 놓는다(세션 JSON 이 있으면 세션 쪽이 더 정확하다)
      const end: LocalTime = wall(+d[1], +d[2], +d[3], 7, 0, 0);
      const start: LocalTime = { ...end, ms: end.ms - ms };
      const st = new Date(start.ms);
      start.date = `${st.getUTCFullYear()}-${String(st.getUTCMonth() + 1).padStart(2, '0')}-${String(st.getUTCDate()).padStart(2, '0')}`;
      start.hour = st.getUTCHours();
      start.minute = st.getUTCMinutes();
      health.addSleep(SRC + '-daily', start, end);
      any = true;
    }
    if (any) n++;
  }
  return n;
}

interface FitSession { fitnessActivity?: string; startTime?: string; endTime?: string }

/** 모든 세션 JSON 한 개 → 수면 세션이면 잠 구간으로 넣는다. 넣은 구간 수(0 또는 1). */
export function parseFitSession(text: string, health: HealthAcc): number {
  let s: FitSession;
  try { s = JSON.parse(text.replace(/^﻿/, '')); } catch { return 0; }
  if (!s || !/^sleep/i.test(s.fitnessActivity ?? '')) return 0;
  const a = s.startTime ? isoToLocal(s.startTime) : null;
  const b = s.endTime ? isoToLocal(s.endTime) : null;
  if (!a || !b || b.ms <= a.ms) return 0;
  health.sources.add(SRC);
  health.addSleep(SRC, a, b);
  return 1;
}
