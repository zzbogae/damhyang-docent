// 나의 공간 이미지 생성(11/12 멘토진): 섬 키워드 사전에 있는 단어만 이미지 프롬프트로 보낸다.
// 대화에서 나온 단어에는 이름·실제 장소·감정어가 섞일 수 있다. 사전(팀 「키워드_최종본_v1」의 active 124개)에
// 대표어나 동의어로 있는 단어만 대표어로 바꿔 남기고 나머지는 버린다. 버린 단어는 밖으로 보내지 않는다.
// 서버(hf-space/space_words.py)도 같은 파일로 한 번 더 거른다. 규칙을 바꾸면 두 곳을 같이 고친다.
import dict from './islandKeywords.json';

export interface KeywordEntry { id: string; word: string; syn: string[]; cat: string; scene: string; en: string; teen_exclude?: boolean }

export const KEYWORDS: KeywordEntry[] = (dict as { words: KeywordEntry[] }).words;
/** 프롬프트에 넣는 단어 수 상한 */
export const MAX_WORDS = 5;
const MAX_LEN = 24;
// 한국어 끝에 붙는 조사(긴 것부터). 「바다에서」→「바다」. 떼고 남은 말이 사전에 있을 때만 쓴다
const PARTICLES = ['에서는', '에서', '으로', '에게', '까지', '부터', '처럼', '은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '와', '과', '랑'];

export const norm = (s: string) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

const INDEX = new Map<string, KeywordEntry>();
for (const e of KEYWORDS) {
  if (e.teen_exclude) continue; // 전시 관람객 나이를 모르므로 청소년 제외 단어(맥주)는 쓰지 않는다
  for (const t of [e.word, ...e.syn]) {
    INDEX.set(norm(t), e);
    INDEX.set(norm(t).replace(/ /g, ''), e);
  }
}

function lookup(t: string): KeywordEntry | null {
  const k = norm(t);
  if (!k) return null;
  const hit = INDEX.get(k) ?? INDEX.get(k.replace(/ /g, ''));
  if (hit) return hit;
  for (const p of PARTICLES) {
    if (k.length > p.length && k.endsWith(p)) {
      const stem = k.slice(0, -p.length);
      if (stem.length >= 1 && INDEX.has(stem)) return INDEX.get(stem)!;
    }
  }
  return null;
}

/** 단어 하나 → 사전 항목(없으면 null). 통째로 먼저, 안 되면 띄어쓰기로 나눈 첫 일치 */
export function matchWord(raw: string): KeywordEntry | null {
  const k = norm(raw);
  if (!k || k.length > MAX_LEN) return null;
  return lookup(k) ?? k.split(' ').map(lookup).find(Boolean) ?? null;
}

/** 단어 목록 → 사전 대표어만(중복 없이, 최대 MAX_WORDS개). dropped 는 화면 안내용 개수로만 쓴다 */
export function filterWords(words: string[], max = MAX_WORDS): { kept: KeywordEntry[]; dropped: number } {
  const kept: KeywordEntry[] = [];
  let dropped = 0;
  for (const w of words ?? []) {
    const e = matchWord(w);
    if (!e) { dropped++; continue; }
    if (!kept.some((x) => x.id === e.id) && kept.length < max) kept.push(e);
  }
  return { kept, dropped };
}
