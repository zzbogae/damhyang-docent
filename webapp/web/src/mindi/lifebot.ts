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

/** 연결 오류 뒤 「다시 연결해 보기」: 확인을 한 번 더 한다 */
export function recheck(): Promise<boolean> {
  alive = null;
  return available();
}

export function chat(message: string, history: Turn[], voice: Voice, focus: Focus | null = null, signal?: AbortSignal) {
  return post<LifebotReply>('chat', { message, history, focus, style: STYLE[voice] }, signal);
}

export function island(history: Turn[], voice: Voice) {
  return post<Island>('island', { history, style: STYLE[voice] });
}

// 11/10 보별: 서연님 챗봇의 「이 대화로 섬 만들기」(대화 → 키워드·한 줄 요약)를 웹에도 잇는다.
// 민디와 이야기에서 받은 단어를 나의 공간 섬 만들기의 추천 단어로 넘긴다. 이 브라우저 세션에만 둔다.
const CHAT_ISLAND_KEY = 'mined.island.fromChat.v1';
export interface ChatIsland { keywords: string[]; summary: string; at: string }
// 챗봇 요약은 3~5문장으로 오므로, 화면에는 첫 문장만 「한 줄」로 보여 준다
export function firstSentence(s: string): string {
  const t = String(s ?? '').trim();
  const m = t.match(/^.*?[.!?。](?=\s|$)/);
  return (m ? m[0] : t).trim();
}
export function saveChatIsland(i: Island) {
  const v: ChatIsland = { keywords: (i.keywords ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 5), summary: firstSentence(i.summary ?? ''), at: new Date().toISOString() };
  try { sessionStorage.setItem(CHAT_ISLAND_KEY, JSON.stringify(v)); } catch { /* 저장소를 못 써도 진행 */ }
  return v;
}
export function peekChatIsland(): ChatIsland | null {
  try { const raw = sessionStorage.getItem(CHAT_ISLAND_KEY); return raw ? (JSON.parse(raw) as ChatIsland) : null; } catch { return null; }
}
export function clearChatIsland() { try { sessionStorage.removeItem(CHAT_ISLAND_KEY); } catch { /* 없음 */ } }
