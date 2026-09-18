// AI 대화 내보내기(ChatGPT·Claude 의 conversations.json). 내가 보낸 메시지의 개수·시각·글자 수만 센다. 원문은 저장하지 않는다.
// ChatGPT: [{ mapping: { id: { message: { author: { role }, create_time(초), content: { parts } } } } }]
// Claude: [{ chat_messages: [{ sender: 'human' | 'assistant', created_at(ISO), text | content[] }] }]
import type { Aggregator } from '../aggregate';
import { isoToLocal, utcMsToLocal } from '../dates';
import { isNight } from '../rules';

function textLen(s: string): number {
  return [...s.normalize('NFC')].length;
}

export function parseAiConversations(text: string, agg: Aggregator): { messages: number; app: 'chatgpt' | 'claude' | null } {
  let j: any;
  try { j = JSON.parse(text); } catch { return { messages: 0, app: null }; }
  if (!Array.isArray(j) || !j.length) return { messages: 0, app: null };
  const app = j.some((c: any) => c && typeof c === 'object' && c.mapping) ? 'chatgpt' : j.some((c: any) => Array.isArray(c?.chat_messages)) ? 'claude' : null;
  if (!app) return { messages: 0, app: null };
  let n = 0;
  const add = (t: ReturnType<typeof isoToLocal>, chars: number) => {
    if (!t) return;
    agg.add(t.date, 'ai_msg_n');
    if (isNight(t.hour)) agg.add(t.date, 'ai_msg_night_n');
    agg.add(t.date, 'ai_chars', chars);
    agg.touch('ai', t.date, app);
    n++;
  };
  if (app === 'chatgpt') {
    for (const conv of j) {
      for (const node of Object.values<any>(conv?.mapping ?? {})) {
        const m = node?.message;
        if (!m || m.author?.role !== 'user' || typeof m.create_time !== 'number') continue;
        if (m.metadata?.is_visually_hidden_from_conversation) continue;
        const parts: unknown[] = m.content?.parts ?? [];
        const chars = parts.reduce<number>((a, p) => a + (typeof p === 'string' ? textLen(p) : 0), 0);
        add(utcMsToLocal(Math.round(m.create_time * 1000)), chars);
      }
    }
  } else {
    for (const conv of j) {
      for (const m of conv?.chat_messages ?? []) {
        if (m?.sender !== 'human' || !m?.created_at) continue;
        const body = typeof m.text === 'string' && m.text ? m.text
          : (m.content ?? []).map((c: any) => (c?.type === 'text' ? String(c.text ?? '') : '')).join('');
        add(isoToLocal(m.created_at), textLen(body));
      }
    }
  }
  return { messages: n, app };
}
