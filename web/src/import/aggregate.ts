// 채널 파서가 넘긴 기록을 일 단위 표(DailyRow)와 채널 메타로 모은다.
import type { Channel, ChannelMeta, DailyMeta, DailyRow } from '../types';
import { NIGHT_HOURS } from './rules';

type CountField = Exclude<keyof DailyRow, 'date' | 'steps' | 'sleep_min'>;

interface ChanAcc { first?: string; last?: string; sources: Set<string>; records: number }

export class Aggregator {
  private rows = new Map<string, Record<string, number>>();
  private chans = new Map<Channel, ChanAcc>();
  private exportDates: string[] = [];

  add(date: string, field: CountField, n = 1) {
    let r = this.rows.get(date);
    if (!r) this.rows.set(date, (r = {}));
    r[field] = (r[field] ?? 0) + n;
  }

  /** 건강 값(걸음·잠)을 정한다. 출처 중 가장 큰 값을 고르는 일은 파서가 한다. */
  setHealth(date: string, field: 'steps' | 'sleep_min', v: number) {
    let r = this.rows.get(date);
    if (!r) this.rows.set(date, (r = {}));
    r[field] = v;
  }

  touch(channel: Channel, date: string, source: string, n = 1) {
    let c = this.chans.get(channel);
    if (!c) this.chans.set(channel, (c = { sources: new Set(), records: 0 }));
    if (!c.first || date < c.first) c.first = date;
    if (!c.last || date > c.last) c.last = date;
    c.sources.add(source);
    c.records += n;
  }

  /** 건강 채널은 기록이 있는 날 수를 records 로 쓴다. */
  setHealthMeta(days: Set<string>, sources: Set<string>) {
    if (!days.size) return;
    const sorted = [...days].sort();
    this.chans.set('health', { first: sorted[0], last: sorted[sorted.length - 1], sources: new Set(sources), records: days.size });
  }

  addExportDate(date: string | null | undefined) {
    if (date) this.exportDates.push(date);
  }

  finalize(): { daily: DailyRow[]; meta: DailyMeta } {
    const daily: DailyRow[] = [];
    for (const date of [...this.rows.keys()].sort()) {
      const r = this.rows.get(date)!;
      const row: Record<string, unknown> = { date };
      for (const k of Object.keys(r).sort()) {
        const v = r[k];
        if (k === 'steps' || k === 'sleep_min') row[k] = Math.round(v);
        else if (k === 'kakao_reply_min_sum') { if (r.kakao_reply_n) row[k] = v; }
        else if (v) row[k] = v;
      }
      if (Object.keys(row).length > 1) daily.push(row as unknown as DailyRow);
    }
    const channels: Partial<Record<Channel, ChannelMeta>> = {};
    for (const k of [...this.chans.keys()].sort()) {
      const c = this.chans.get(k)!;
      if (!c.first || !c.last) continue;
      channels[k] = { first: c.first, last: c.last, sources: [...c.sources].sort(), records: c.records };
    }
    const meta: DailyMeta = { tz: 'Asia/Seoul', night_hours: [...NIGHT_HOURS] as [number, number], channels };
    if (this.exportDates.length) meta.export_date = this.exportDates.sort()[this.exportDates.length - 1];
    return { daily, meta };
  }
}
