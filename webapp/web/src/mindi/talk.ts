// 민디와 이야기에서 대본집(scripts.gen.ts)의 문장을 고르는 규칙.
// - 진단·치료·위기는 고정형(대본집 §17): 어떤 말투에서도 한 글자도 바꾸지 않고, 다른 무엇보다 먼저 답한다
// - 사용자가 먼저 꺼낸 마음(§11-5)과 판정을 묻는 말(§11-6)은 대본집 문장으로 받는다
// - 호칭이 정해지기 전에는 {이름}님이 든 문장(줄)을 빼고 말한다(대본집 §0-3). 빼고 나서 남는 게 없으면 그 문장은 쓰지 않는다
// - 숫자를 지어낸 예시(「사진이 열여덟 장」, 「최근 4주는 걸음이 조금 줄었고」 등)가 든 줄은 쓰지 않는다: 실제 기록과 다를 수 있다
import { DAILY, EMPATHY, FIXED, ISLAND_LOCKED_EARLY, ISLAND_LOCKED_TWO, JUDGMENT, OPENERS } from './scripts.gen';
import type { Voice } from './voices';

export type Fixed = keyof typeof FIXED;

const CRISIS_RE = /(죽고\s?싶|죽어\s?버리|사라지고\s?싶|없어지고\s?싶|살기\s?싫|살고\s?싶지\s?않|끝내고\s?싶|자해|다\s?의미\s?없|의미가\s?없는\s?것\s?같)/;
const TREATMENT_RE = /(약.{0,4}(줄여|끊어|끊|바꿔|그만)|상담.{0,4}(그만|끊|안\s?가)|치료.{0,4}(그만|중단|안\s?받))/;
const DIAGNOSIS_RE = /(우울증|우울한\s?(건가|거야|걸까)|ADHD|adhd|불면증|공황|조울|양극성|강박증|진단)/;

/** 진단·치료·위기 질문이면 그 종류. 위기를 가장 먼저 본다 */
export function fixedKind(raw: string): Fixed | null {
  const t = raw.normalize('NFC');
  if (CRISIS_RE.test(t)) return 'crisis';
  if (TREATMENT_RE.test(t)) return 'treatment';
  if (DIAGNOSIS_RE.test(t)) return 'diagnosis';
  return null;
}

export const fixedLine = (k: Fixed): string => FIXED[k];

/** 호칭이 없으면 {이름}님이 든 줄·문장을 뺀다. 이름이 있으면 채운다 */
export function withName(line: string, name?: string): string | null {
  if (name) return line.replaceAll('{이름}', name);
  if (!line.includes('{이름}')) return line;
  const kept = line.split('\n')
    .map((l) => l.split(/(?<=[.?!])\s+/).filter((sent) => !sent.includes('{이름}')).join(' '))
    .filter((l) => l.trim());
  const out = kept.join('\n').trim();
  return out || null;
}

// 지어낸 수치가 든 예시 줄: 실제 기록 대신 대본의 예시 숫자를 말하게 되므로 빼고 쓴다
const MADE_UP = /(열여덟|최근 4주|만 보|밤 11시|사진이 많|사진은 이때|사진 많)/;
function honest(line: string): string | null {
  const kept = line.split('\n').filter((l) => !MADE_UP.test(l));
  return kept.length ? kept.join('\n') : null;
}

// 사용자의 말 → 대본집 공감·돌려 답하기 표의 줄. 위에서부터 먼저 맞는 것
const MATCH: [RegExp, 'EMPATHY' | 'JUDGMENT', string][] = [
  [/(힘들|힘드|지쳤|지친)/, 'EMPATHY', '(먼저) 요즘 너무 힘들어'],
  [/지겨/, 'EMPATHY', '그냥 요즘 좀 지겨워'],
  [/(재밌|재미있|즐거웠)/, 'EMPATHY', '이때 진짜 재밌었는데'],
  [/(생각하고\s?싶지\s?않|보기\s?싫|그만\s?보|안\s?보고\s?싶)/, 'EMPATHY', '별로 생각하고 싶지 않아'],
  [/왜\s?이런\s?걸/, 'EMPATHY', '왜 이런 걸 보여주는 거야'],
  [/왜\s?이러지/, 'EMPATHY', '나 요즘 왜 이러지'],
  [/(다\s?알아|전부\s?알아)/, 'EMPATHY', '(농담) 너 진짜 다 알아?'],
  [/한\s?(것|게)도\s?없/, 'EMPATHY', '(농담) 나 오늘 한 것도 없어'],
  [/(고마워|고맙|감사)/, 'EMPATHY', '고마워'],
  [/(이상한\s?사람)/, 'JUDGMENT', '나 이상한 사람이야?'],
  [/(잘못|내가\s?이상한)/, 'JUDGMENT', '이거 걔 잘못 아니야? 내가 이상한 거야?'],
  [/(맞아\s?틀려|내가\s?맞|누가\s?맞)/, 'JUDGMENT', '그래서 내가 맞아 틀려?'],
  [/(늦은\s?거|너무\s?늦)/, 'JUDGMENT', '나 너무 늦은 거 아닐까?'],
];

/** 대본집에 받을 말이 있으면 그 문장(말투·호칭 반영), 없으면 null */
export function scriptedReply(raw: string, voice: Voice, name?: string): string | null {
  const t = raw.normalize('NFC');
  for (const [re, table, key] of MATCH) {
    if (!re.test(t)) continue;
    const row = (table === 'EMPATHY' ? EMPATHY : JUDGMENT)[key];
    if (!row) continue;
    const line = honest(row[voice]);
    const named = line && withName(line, name);
    if (named) return named;
  }
  return null;
}

const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

/** 관측소 오늘의 한 마디(대본집 §5-5, 44개 × 4종). 같은 날이면 같은 줄 */
export function dailyLine(voice: Voice, today = new Date()): string {
  const all = DAILY[voice];
  return all[dayIndex(today) % all.length];
}

/** 민디와 이야기 첫 한 마디(대본집 §11-2 하늘·날씨 1~10). 호칭이 없으면 {이름}님이 든 문장을 뺀다 */
export function openerLine(voice: Voice, today = new Date(), name?: string): string {
  const all = OPENERS[voice].map((l) => withName(l, name)).filter((l): l is string => !!l);
  return all[dayIndex(today) % all.length];
}

/** 나만의 섬이 잠겨 있을 때 민디(대본집 §13): 두 개면 「하나 더」, 그보다 적으면 「조금만 더」 */
export function islandLockedLine(have: number, voice: Voice): string {
  return (have === 2 ? ISLAND_LOCKED_TWO : ISLAND_LOCKED_EARLY)[voice];
}
