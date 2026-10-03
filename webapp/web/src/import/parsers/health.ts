// 건강 기록(애플 건강 XML 스트림, 삼성 헬스 CSV). 출처별로 모은 뒤 하루에 가장 큰 출처 값을 쓴다.
import { SaxesParser } from 'saxes';
import type { Aggregator } from '../aggregate';
import { appleDateToLocal, type LocalTime, utcMsToLocal } from '../dates';
import { SLEEP_ASLEEP_VALUES, SLEEP_SESSION_GAP_MIN } from '../rules';
import type { SourceFile } from '../sources';

interface Seg { start: LocalTime; end: LocalTime }

/** 출처별 걸음·잠 누적기. 파일 여러 개(삼성 CSV 두 개 등)를 같은 누적기로 받는다. */
export class HealthAcc {
  steps = new Map<string, Map<string, number>>(); // date → source → 합
  sleepSegs = new Map<string, Seg[]>(); // source → 구간
  sources = new Set<string>();
  exportDate: string | null = null;

  addSteps(date: string, source: string, v: number) {
    let m = this.steps.get(date);
    if (!m) this.steps.set(date, (m = new Map()));
    m.set(source, (m.get(source) ?? 0) + v);
  }

  setStepsMax(date: string, source: string, v: number) {
    let m = this.steps.get(date);
    if (!m) this.steps.set(date, (m = new Map()));
    m.set(source, Math.max(m.get(source) ?? 0, v));
  }

  addSleep(source: string, start: LocalTime, end: LocalTime) {
    let a = this.sleepSegs.get(source);
    if (!a) this.sleepSegs.set(source, (a = []));
    a.push({ start, end });
  }

  /** 누적한 값을 일 단위 표로 옮긴다. */
  flush(agg: Aggregator) {
    const days = new Set<string>();
    for (const [date, per] of this.steps) {
      agg.setHealth(date, 'steps', Math.max(...per.values()));
      days.add(date);
    }
    const sleepDay = new Map<string, Map<string, number>>();
    for (const [src, segs] of this.sleepSegs) {
      for (const s of sleepSessions(segs)) {
        let m = sleepDay.get(s.date);
        if (!m) sleepDay.set(s.date, (m = new Map()));
        m.set(src, (m.get(src) ?? 0) + s.minutes);
      }
    }
    for (const [date, per] of sleepDay) {
      agg.setHealth(date, 'sleep_min', Math.max(...per.values()));
      days.add(date);
    }
    agg.setHealthMeta(days, this.sources);
    agg.addExportDate(this.exportDate);
  }
}

/** 같은 시작·끝 구간은 한 번만 두고, 90분 넘게 떨어진 구간부터 새 세션으로 묶는다. 세션 날짜 = 끝 시각의 날짜 */
export function sleepSessions(segs: Seg[]): { date: string; minutes: number }[] {
  const uniq = new Map<string, Seg>();
  for (const s of segs) uniq.set(`${s.start.ms}|${s.end.ms}`, s);
  const sorted = [...uniq.values()].sort((a, b) => a.start.ms - b.start.ms || a.end.ms - b.end.ms);
  const out: { date: string; minutes: number }[] = [];
  let curEnd: LocalTime | null = null;
  let total = 0;
  for (const s of sorted) {
    if (curEnd && (s.start.ms - curEnd.ms) / 60000 > SLEEP_SESSION_GAP_MIN) {
      out.push({ date: curEnd.date, minutes: total });
      curEnd = null;
      total = 0;
    }
    curEnd = !curEnd || s.end.ms > curEnd.ms ? s.end : curEnd;
    total += (s.end.ms - s.start.ms) / 60000;
  }
  if (curEnd) out.push({ date: curEnd.date, minutes: total });
  return out;
}

/** 애플 건강 export.xml 을 스트림으로 읽는다(GB 단위 가정). 반환: 읽은 조각 수 */
export async function parseAppleHealth(src: SourceFile, acc: HealthAcc): Promise<{ chunks: number; records: number }> {
  const parser = new SaxesParser();
  let records = 0;
  parser.on('opentag', (node) => {
    if (node.name === 'Record') {
      const a = node.attributes as Record<string, string>;
      const type = a.type;
      if (type === 'HKQuantityTypeIdentifierStepCount') {
        const t = appleDateToLocal(a.startDate);
        const v = Number(a.value);
        if (t && Number.isFinite(v)) {
          acc.addSteps(t.date, a.sourceName ?? '', v);
          records++;
        }
      } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        if (!SLEEP_ASLEEP_VALUES.has(a.value)) return;
        const s = appleDateToLocal(a.startDate);
        const e = appleDateToLocal(a.endDate);
        if (s && e && e.ms > s.ms) {
          acc.addSleep(a.sourceName ?? '', s, e);
          records++;
        }
      }
    } else if (node.name === 'ExportDate') {
      const t = appleDateToLocal((node.attributes as Record<string, string>).value ?? '');
      if (t) acc.exportDate = t.date;
    }
  });
  const decoder = new TextDecoder('utf-8');
  let chunks = 0;
  await src.pipe(
    new WritableStream<Uint8Array>({
      write(chunk) {
        chunks++;
        parser.write(decoder.decode(chunk, { stream: true }));
      },
      close() {
        parser.write(decoder.decode());
        parser.close();
      },
    }),
  );
  acc.sources.add('apple-health');
  return { chunks, records };
}

/** 따옴표를 지원하는 CSV 한 줄 나누기 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function csvTable(text: string): { cols: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  // 첫 줄은 메타 행(com.samsung.shealth.…,버전,개수), 둘째 줄이 열 이름
  const headerIdx = /^com\.samsung\./.test(lines[0] ?? '') ? 1 : 0;
  const cols = splitCsvLine(lines[headerIdx] ?? '').map((c) => c.slice(c.lastIndexOf('.') + 1).trim());
  return { cols, rows: lines.slice(headerIdx + 1).map(splitCsvLine) };
}

export function parseSamsungSteps(text: string, acc: HealthAcc): number {
  const { cols, rows } = csvTable(text);
  const iDay = cols.indexOf('day_time');
  const iSteps = cols.indexOf('step_count');
  const iDev = cols.indexOf('deviceuuid');
  if (iDay < 0 || iSteps < 0) return 0;
  let n = 0;
  for (const r of rows) {
    const ms = Number(r[iDay]);
    const v = Number(r[iSteps]);
    if (!Number.isFinite(ms) || !Number.isFinite(v)) continue;
    const date = new Date(ms).toISOString().slice(0, 10); // day_time = 그 날짜 00:00 UTC
    acc.setStepsMax(date, r[iDev] ?? '', v);
    n++;
  }
  acc.sources.add('samsung-health');
  return n;
}

/** 삼성 헬스 시각은 UTC 로 적혀 있다. time_offset(기록 당시 현지 오프셋)은 참고만 하고, 규칙대로 한국 시간으로 바꾼다. */
function samsungTime(s: string): LocalTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return utcMsToLocal(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

export function parseSamsungSleep(text: string, acc: HealthAcc): number {
  const { cols, rows } = csvTable(text);
  const iS = cols.indexOf('start_time');
  const iE = cols.indexOf('end_time');
  if (iS < 0 || iE < 0) return 0;
  let n = 0;
  for (const r of rows) {
    const s = samsungTime(r[iS] ?? '');
    const e = samsungTime(r[iE] ?? '');
    if (!s || !e || e.ms <= s.ms) continue;
    acc.addSleep('samsung', s, e);
    n++;
  }
  acc.sources.add('samsung-health');
  return n;
}
