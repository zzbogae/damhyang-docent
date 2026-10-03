// 카카오톡 대화 내보내기(txt: PC·안드로이드·iOS). 메시지 원문은 저장하지 않고 "나"의 집계만 남긴다.
import type { Aggregator } from '../aggregate';
import { hour24, type LocalTime, wall } from '../dates';
import { chars, isAssertive, isFirstPerson, isNight, REPLY_CAP_MIN } from '../rules';

export type KakaoFormat = 'pc' | 'android' | 'ios' | 'unknown';

export interface KakaoMessage {
  sender: string; t: LocalTime;
  /** 원문. keepText 일 때만 남긴다(시험용). 집계에는 아래 세 값만 쓴다 */
  text?: string;
  chars: number; first: boolean; assert: boolean;
}
export interface KakaoChat { name: string; format: KakaoFormat; savedDate: string | null; messages: KakaoMessage[] }

const RE_PC_MSG = /^\[([^\]]+)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ?(.*)$/;
const RE_PC_DATE = /^-{5,} (\d{4})년 (\d{1,2})월 (\d{1,2})일 .*-{5,}$/;
const RE_AND_PREFIX = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.*)$/;
const RE_IOS_PREFIX = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.*)$/;
const RE_DAY_LINE = /^\d{4}년 \d{1,2}월 \d{1,2}일 [월화수목금토일]요일$/;
const RE_HEADER = /님과 카카오톡 대화$|^저장한 날짜\s*:/;

function parseSaved(line: string): string | null {
  const s = line.replace(/^저장한 날짜\s*:\s*/, '');
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s) || /^(\d{4})년 (\d{1,2})월 (\d{1,2})일/.exec(s) || /^(\d{4})\. (\d{1,2})\. (\d{1,2})\./.exec(s);
  if (!m) return null;
  return wall(+m[1], +m[2], +m[3]).date;
}

/**
 * 대화 txt 를 메시지 목록으로 읽는다. 원문은 읽는 순간 글자 수·1인칭·단정어 여부로만 바꾸고 버린다
 * (15년치 60만 개에서 남는 메모리 172MB → 측정값은 out/kakao_bench.md). 발신자 이름과 날짜 문자열은 하나씩만 둔다.
 */
export function parseKakaoText(text: string, name: string, opts: { keepText?: boolean } = {}): KakaoChat {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const chat: KakaoChat = { name, format: 'unknown', savedDate: null, messages: [] };
  let day: { y: number; m: number; d: number } | null = null;
  let cur: (Omit<KakaoMessage, 'chars' | 'first' | 'assert'> & { text: string }) | null = null;
  const senders = new Map<string, string>();
  const dates = new Map<string, string>();
  const intern = <T,>(m: Map<T, T>, v: T) => { const h = m.get(v); if (h !== undefined) return h; m.set(v, v); return v; };
  const at = (y: number, mo: number, d: number, h: number, mi: number) => {
    const t = wall(y, mo, d, h, mi);
    t.date = intern(dates, t.date);
    return t;
  };
  const push = () => {
    if (!cur) return;
    const c = cur;
    chat.messages.push({ sender: intern(senders, c.sender), t: c.t, ...(opts.keepText ? { text: c.text } : {}),
      chars: chars(c.text), first: isFirstPerson(c.text), assert: isAssertive(c.text) });
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.normalize('NFC');
    if (!line.trim()) continue; // 빈 줄은 무시
    if (RE_HEADER.test(line)) {
      if (/^저장한 날짜/.test(line)) chat.savedDate = parseSaved(line);
      continue;
    }
    let m = RE_PC_DATE.exec(line);
    if (m) {
      push();
      day = { y: +m[1], m: +m[2], d: +m[3] };
      chat.format = 'pc';
      continue;
    }
    if (RE_DAY_LINE.test(line)) { push(); continue; }
    m = RE_PC_MSG.exec(line);
    if (m && day) {
      push();
      cur = { sender: m[1], t: at(day.y, day.m, day.d, hour24(m[2], +m[3]), +m[4]), text: m[5] };
      continue;
    }
    const and = RE_AND_PREFIX.exec(line);
    const mob = and || RE_IOS_PREFIX.exec(line);
    if (mob) {
      push();
      if (chat.format === 'unknown') chat.format = and ? 'android' : 'ios';
      const rest = mob[7];
      const sep = rest.indexOf(' : ');
      if (sep < 0) continue; // 시스템 줄(…님이 들어왔습니다.)
      cur = {
        sender: rest.slice(0, sep),
        t: at(+mob[1], +mob[2], +mob[3], hour24(mob[4], +mob[5]), +mob[6]),
        text: rest.slice(sep + 3),
      };
      continue;
    }
    if (cur) cur.text += '\n' + line; // 이어지는 줄
  }
  push();
  return chat;
}

export interface KakaoParticipant { name: string; messages: number; files: number }

export function participants(chats: KakaoChat[]): KakaoParticipant[] {
  const m = new Map<string, KakaoParticipant>();
  for (const c of chats) {
    const seen = new Set<string>();
    for (const msg of c.messages) {
      let p = m.get(msg.sender);
      if (!p) m.set(msg.sender, (p = { name: msg.sender, messages: 0, files: 0 }));
      p.messages++;
      if (!seen.has(msg.sender)) { seen.add(msg.sender); p.files++; }
    }
  }
  return [...m.values()].sort((a, b) => b.files - a.files || b.messages - a.messages);
}

/** "나"의 메시지를 일 단위 표에 넣는다. 반환: 센 내 메시지 수 */
export function aggregateKakao(chats: KakaoChat[], me: string, agg: Aggregator): number {
  let n = 0;
  for (const c of chats) {
    const src = c.format === 'unknown' ? 'kakao' : `kakao-${c.format}`;
    let prev: KakaoMessage | null = null;
    for (const msg of c.messages) {
      if (msg.sender === me) {
        const d = msg.t.date;
        agg.add(d, 'kakao_n');
        agg.stamp(msg.t);
        agg.add(d, 'kakao_chars', msg.chars);
        if (isNight(msg.t.hour)) agg.add(d, 'kakao_night_n');
        if (msg.first) agg.add(d, 'kakao_first_n');
        if (msg.assert) agg.add(d, 'kakao_assert_n');
        if (prev && prev.sender !== me) {
          const delay = Math.max(0, Math.min(REPLY_CAP_MIN, Math.floor((msg.t.ms - prev.t.ms) / 60000)));
          agg.add(d, 'kakao_reply_n');
          agg.add(d, 'kakao_reply_min_sum', delay);
        }
        agg.touch('kakao', d, src);
        n++;
      }
      prev = msg;
    }
    agg.addExportDate(c.savedDate);
  }
  return n;
}
