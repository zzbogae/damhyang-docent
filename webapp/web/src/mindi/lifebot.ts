// 민디와 이야기 ↔ 라이프로그 챗봇(팀 1조 isyndy/lifelog-chatbot). 브라우저는 같은 주소의 /api/lifebot 만 부르고,
// 개발·미리보기 서버가 챗봇으로 넘긴다(lifebot-plugin.ts). 서버에 LIFEBOT_URL 이 없거나 챗봇이 꺼져 있으면
// available() 이 false 이고, 화면은 지금까지처럼 기기 안 규칙 답만 쓴다.
// 챗봇은 대화를 기억하지 않으니 history 는 이 화면이 들고 있다가 매번 같이 보낸다(챗봇 README §5).
import type { Voice } from './voices';

export type Turn = { role: 'user' | 'assistant'; content: string };
export type Focus =
  | { type: 'cluster'; id: string }
  | { type: 'period'; sheet: string; start: string; end: string }
  | { type: 'text'; text: string; title: string };
export interface LifebotReply { reply: string; tools: string[]; focus_title: string | null }
export interface Island { island_id: string; created_at: string; keywords: string[]; summary: string }

/** 앱의 말투 4종 → 챗봇 style 이름 */
export const STYLE: Record<Voice, string> = { quiet: '조용한', warm: '다정한', plain: '담백한', dry: '시니컬한' };

async function post<T>(name: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`/api/lifebot/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  if (!r.ok) throw new Error(`lifebot ${r.status}`);
  return ((await r.json()) as { data: T }).data;
}

let alive: Promise<boolean> | null = null;
/** 챗봇이 연결돼 있는지(페이지마다 한 번 확인) */
export function available(): Promise<boolean> {
  alive ??= fetch('/api/lifebot/health').then((r) => r.ok).catch(() => false);
  return alive;
}

export function chat(message: string, history: Turn[], voice: Voice, focus: Focus | null = null, signal?: AbortSignal) {
  return post<LifebotReply>('chat', { message, history, focus, style: STYLE[voice] }, signal);
}

export function island(history: Turn[], voice: Voice) {
  return post<Island>('island', { history, style: STYLE[voice] });
}
