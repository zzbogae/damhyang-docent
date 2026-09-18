// 인스타그램 "내 정보 다운로드"(JSON 형식). 게시물·스토리·릴스는 올린 날짜만, DM 은 내가 보낸 메시지의 개수·시각만 센다.
// 캡션과 메시지 원문은 저장하지 않는다. 인스타그램 JSON 은 한글을 UTF-8 바이트 단위의 \u00XX 로 적어서(깨진 글자) 되살려야 한다.
import type { Aggregator } from '../aggregate';
import { type LocalTime, utcMsToLocal } from '../dates';
import { isNight } from '../rules';

/** "ìë" 같은 글자를 원래 한글로 되살린다. 이미 정상이면 그대로 둔다. */
export function fixMojibake(s: string): string {
  if (!s || !/[Â-ô][-¿]/.test(s)) return s;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0xff) return s; // 진짜 한글이 이미 섞여 있음
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

interface Thread { participants: string[]; messages: { sender: string; t: LocalTime }[] }

export class InstagramAcc {
  posts: LocalTime[] = [];
  threads = new Map<string, Thread>();
  profileName: string | null = null;

  addContent(text: string): number {
    let j: any;
    try { j = JSON.parse(text); } catch { return 0; }
    const out: number[] = [];
    const push = (sec: unknown) => { if (typeof sec === 'number' && sec > 0) out.push(sec); };
    if (Array.isArray(j)) {
      for (const post of j) push(post?.creation_timestamp ?? post?.media?.[0]?.creation_timestamp);
    } else if (j && typeof j === 'object') {
      for (const s of j.ig_stories ?? []) push(s?.creation_timestamp);
      for (const r of j.ig_reels_media ?? []) push(r?.creation_timestamp ?? r?.media?.[0]?.creation_timestamp);
    }
    for (const sec of out) this.posts.push(utcMsToLocal(sec * 1000));
    return out.length;
  }

  addMessages(text: string, threadKey: string): number {
    let j: any;
    try { j = JSON.parse(text); } catch { return 0; }
    const th = this.threads.get(threadKey) ?? { participants: [], messages: [] };
    for (const p of j?.participants ?? []) {
      const n = fixMojibake(String(p?.name ?? '')).normalize('NFC');
      if (n && !th.participants.includes(n)) th.participants.push(n);
    }
    let n = 0;
    for (const m of j?.messages ?? []) {
      if (typeof m?.timestamp_ms !== 'number' || !m?.sender_name) continue;
      th.messages.push({ sender: fixMojibake(String(m.sender_name)).normalize('NFC'), t: utcMsToLocal(m.timestamp_ms) });
      n++;
    }
    this.threads.set(threadKey, th);
    return n;
  }

  addProfile(text: string) {
    try {
      const j = JSON.parse(text);
      const smd = j?.profile_user?.[0]?.string_map_data ?? {};
      const name = smd?.Name?.value ?? smd?.['이름']?.value;
      if (name) this.profileName = fixMojibake(String(name)).normalize('NFC');
    } catch { /* 무시 */ }
  }

  /** 나: 프로필 이름이 있으면 그것, 없으면 가장 많은 대화방에 참여한 사람 */
  me(): string | null {
    if (this.profileName) return this.profileName;
    const count = new Map<string, number>();
    for (const th of this.threads.values()) for (const p of th.participants) count.set(p, (count.get(p) ?? 0) + 1);
    let best: string | null = null;
    let bn = 0;
    for (const [p, c] of count) if (c > bn || (c === bn && best !== null && p < best)) { best = p; bn = c; }
    return best;
  }

  flush(agg: Aggregator): number {
    let n = 0;
    for (const t of this.posts) {
      agg.add(t.date, 'sns_post_n');
      agg.touch('sns', t.date, 'instagram');
      n++;
    }
    const me = this.me();
    if (me) {
      for (const th of this.threads.values()) {
        for (const m of th.messages) {
          if (m.sender !== me) continue;
          agg.add(m.t.date, 'sns_dm_n');
          if (isNight(m.t.hour)) agg.add(m.t.date, 'sns_dm_night_n');
          agg.touch('sns', m.t.date, 'instagram');
          n++;
        }
      }
    }
    return n;
  }
}
