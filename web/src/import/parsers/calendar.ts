// 캘린더(ICS). 반복 일정은 ical.js 로 펼치고, 일정 제목은 저장하지 않는다.
import ICAL from 'ical.js';
import type { Aggregator } from '../aggregate';
import { addDays, type LocalTime, utcMsToLocal, wall, zonedWallToLocal } from '../dates';

const SEOUL_VTZ = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:mined',
  'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900',
  'TZNAME:KST', 'DTSTART:19700101T000000', 'END:STANDARD', 'END:VTIMEZONE', 'END:VCALENDAR',
].join('\r\n');

function ensureSeoul() {
  if (ICAL.TimezoneService.has('Asia/Seoul')) return;
  const comp = new ICAL.Component(ICAL.parse(SEOUL_VTZ));
  const vtz = comp.getFirstSubcomponent('vtimezone');
  if (vtz) ICAL.TimezoneService.register(vtz);
}

type ITime = InstanceType<typeof ICAL.Time>;

function toLocal(t: ITime): LocalTime {
  if (t.isDate) return wall(t.year, t.month, t.day);
  const tzid = t.zone?.tzid;
  if (tzid === 'UTC' || tzid === 'Z') return utcMsToLocal(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second));
  if (!tzid || tzid === 'floating' || tzid === 'Asia/Seoul') return wall(t.year, t.month, t.day, t.hour, t.minute, t.second);
  return zonedWallToLocal(tzid, t.year, t.month, t.day, t.hour, t.minute, t.second);
}

const MAX_OCCURRENCES = 5000;

export function parseCalendar(text: string, agg: Aggregator): number {
  ensureSeoul();
  let root: InstanceType<typeof ICAL.Component>;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    return 0;
  }
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    const tzid = String(vtz.getFirstPropertyValue('tzid') ?? '');
    if (tzid && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(vtz);
  }
  const vevents = root.getAllSubcomponents('vevent');
  // 반복이 아닌 일정 중 가장 늦은 현지 시작 날짜(끝이 없는 반복을 펼치는 한계)
  let bound: string | null = null;
  const overrides = new Map<string, Set<number>>(); // uid → 바뀐 발생의 원래 시각(ms)
  for (const v of vevents) {
    const rid = v.getFirstPropertyValue('recurrence-id') as ITime | null;
    const uid = String(v.getFirstPropertyValue('uid') ?? '');
    if (rid) {
      const l = toLocal(rid);
      if (!overrides.has(uid)) overrides.set(uid, new Set());
      overrides.get(uid)!.add(l.ms);
      continue;
    }
    if (!v.getFirstProperty('rrule')) {
      const s = v.getFirstPropertyValue('dtstart') as ITime | null;
      if (s) {
        const d = toLocal(s).date;
        if (!bound || d > bound) bound = d;
      }
    }
  }
  let n = 0;
  for (const v of vevents) {
    const status = String(v.getFirstPropertyValue('status') ?? '').toUpperCase();
    if (status === 'CANCELLED') continue;
    const start = v.getFirstPropertyValue('dtstart') as ITime | null;
    if (!start) continue;
    const rrule = v.getFirstPropertyValue('rrule') as InstanceType<typeof ICAL.Recur> | null;
    if (!rrule || v.getFirstPropertyValue('recurrence-id')) {
      const l = toLocal(start);
      agg.add(l.date, 'cal_n');
      agg.touch('cal', l.date, 'ics');
      n++;
      continue;
    }
    const uid = String(v.getFirstPropertyValue('uid') ?? '');
    const skip = overrides.get(uid);
    const infinite = rrule.count == null && rrule.until == null;
    const first = toLocal(start).date;
    const limit = infinite ? (bound ?? addDays(first, 365)) : null;
    const ev = new ICAL.Event(v);
    const it = ev.iterator();
    let occ: ITime | null | undefined;
    let guard = 0;
    while ((occ = it.next()) && guard++ < MAX_OCCURRENCES) {
      const l = toLocal(occ);
      if (limit && l.date > limit) break;
      if (skip?.has(l.ms)) continue;
      agg.add(l.date, 'cal_n');
      agg.touch('cal', l.date, 'ics');
      n++;
    }
  }
  return n;
}
