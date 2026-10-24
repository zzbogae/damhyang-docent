// 민디 말투 5종(보이스 v4 §7 의 네 결 + 반말 1종, 10/24 하빈 결정).
// 템플릿 문장(합쇼체)의 어미만 바꾼다. 숫자·날짜·순위·「가장」은 손대지 않고, 감정 판정·예측·조언은 tone.ts 검사를 그대로 쓴다.
// 인터넷이 없어도 어미 규칙으로 바로 바뀌고, 외부 모델(/api/mindi)이 켜져 있으면 그 말투로 한 번 더 다듬는다.
// 고른 말투는 이 기기 브라우저에만 둔다(설정 › 민디와 채팅 창이 같은 값을 쓴다).
import { useEffect, useState } from 'react';
import { checkTone } from './tone';

export type Voice = 'quiet' | 'warm' | 'plain' | 'dry' | 'casual';

export interface VoiceDef {
  id: Voice;
  /** 버튼에 쓰는 이름 */
  label: string;
  /** 고르기 창의 한 줄 설명 */
  hint: string;
  /** 튜토리얼 v1.1 §7 「7-1 캐기」 줄. 반말은 [제안] */
  sample: string;
  /** 외부 모델에 줄 말투 지시 */
  prompt: string;
}

export const VOICES: VoiceDef[] = [
  { id: 'quiet', label: '조용한', hint: '차분하게 사실만 건네요', sample: '세 번 두드리면 열려요.',
    prompt: '말투: 조용한. 차분한 합쇼체를 유지하고 꾸밈말을 더하지 않는다.' },
  { id: 'warm', label: '다정한', hint: '부드럽고 다정하게 말해요', sample: '세 번만 톡톡 두드려 주세요. 천천히 하셔도 돼요.',
    prompt: '말투: 다정한. 부드러운 해요체로 바꾼다. 위로나 감정 이름 붙이기는 하지 않는다.' },
  { id: 'plain', label: '담백한', hint: '짧게, 요점만 말해요', sample: '세 번 두드리세요.',
    prompt: '말투: 담백한. 합쇼체를 유지하되 문장을 짧게 줄이고, 명사로 끝내도 된다. 내용은 빼지 않는다.' },
  { id: 'dry', label: '시니컬한', hint: '건조하게, 가끔 자기 농담을 해요', sample: '세 번이요. 네 번 두드려도 안 깨지는 건 아니니까 걱정 마시고요.',
    prompt: '말투: 시니컬한. 건조한 해요체. 농담은 다섯 문장에 한 번 이하, 과녁은 민디 자신이나 숫자뿐이다. 사용자의 기록·감정·사람을 농담거리로 삼지 않고, 숫자로 감정을 짐작하지 않는다.' },
  { id: 'casual', label: '친구처럼', hint: '반말로 편하게 말해요', sample: '세 번 두드리면 열려.',
    prompt: '말투: 친구처럼. 반말(해체)로 바꾼다. 무례하거나 단정하는 말은 쓰지 않는다.' },
];

export const DEFAULT_VOICE: Voice = 'quiet';
export const voiceDef = (v: Voice): VoiceDef => VOICES.find((x) => x.id === v) ?? VOICES[0];
export const isVoice = (x: unknown): x is Voice => VOICES.some((v) => v.id === x);

// ── 한글 어미 바꾸기 ──────────────────────────────────────────────
const BASE = 0xac00;
const isHangul = (ch: string) => { const c = ch.charCodeAt(0); return c >= BASE && c <= 0xd7a3; };
const parts = (ch: string) => { const n = ch.charCodeAt(0) - BASE; return { l: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 }; };
const join = (l: number, v: number, t = 0) => String.fromCharCode(BASE + l * 588 + v * 28 + t);
const hasBatchim = (ch: string) => isHangul(ch) && parts(ch).t !== 0;

// 모음 번호: ㅏ0 ㅐ1 ㅓ4 ㅔ5 ㅕ6 ㅗ8 ㅘ9 ㅚ11 ㅜ13 ㅝ14 ㅡ18 ㅣ20 / 받침 ㄹ8 ㅂ17 / 초성 ㄹ5 ㅇ11
const V = { a: 0, ae: 1, eo: 4, e: 5, yeo: 6, o: 8, wa: 9, oe: 11, u: 13, wo: 14, eu: 18, i: 20 };
const T_RIEUL = 8, T_BIEUP = 17, T_SSANG = 20, T_HIEUT = 27;

/** 해요체에서 「요」를 뺀 꼴(해체). stem 은 「-습니다/-ㅂ니다」를 떼어 낸 어간 */
function haeForm(stem: string): string {
  const last = stem.slice(-1);
  if (!isHangul(last)) return stem + '어';
  const head = stem.slice(0, -1);
  const p = parts(last);
  // 받침 ㅆ(았·었·였·졌·했·있 …)과 겠은 언제나 「어」
  if (p.t === T_SSANG || last === '겠') return stem + '어';
  // ㅎ 불규칙: 그렇다 → 그래, 어떻다 → 어때 (좋다·놓다·넣다·쌓다·닿다·낳다는 규칙)
  if (p.t === T_HIEUT && !'좋놓넣쌓닿낳'.includes(last)) return head + join(p.l, V.ae);
  if (p.t !== 0) return stem + (p.v === V.a || p.v === V.o ? '아' : '어');
  if (last === '하') return head + '해';
  if (last === '되') return head + '돼';
  if (last === '르' && head && isHangul(head.slice(-1))) {
    const q = parts(head.slice(-1));
    return head.slice(0, -1) + join(q.l, q.v, T_RIEUL) + (q.v === V.a || q.v === V.o ? '라' : '러');
  }
  if (p.v === V.a || p.v === V.eo || p.v === V.ae || p.v === V.e || p.v === V.yeo) return stem;
  if (p.v === V.o) return head + join(p.l, V.wa);
  if (p.v === V.u) return head + join(p.l, V.wo);
  if (p.v === V.i) return p.l === 11 ? head + '여' : head + join(p.l, V.yeo);
  if (p.v === V.eu) return head + join(p.l, V.eo);
  return stem + '어';
}

type Level = 'haeyo' | 'hae';

/** 문장 끝 「…습니다/…ㅂ니다」 하나를 해요체(haeyo)나 반말(hae)로 */
function conjugate(word: string, level: Level): string {
  // 이다(입니다)·아니다(아닙니다): 받침 따라 이에요/예요, 반말은 이야/야
  if (word.endsWith('아닙니다')) return word.slice(0, -4) + (level === 'haeyo' ? '아니에요' : '아니야');
  if (word.endsWith('입니다')) {
    const noun = word.slice(0, -3);
    const b = hasBatchim(noun.slice(-1)) || !isHangul(noun.slice(-1));
    return noun + (level === 'haeyo' ? (b ? '이에요' : '예요') : (b ? '이야' : '야'));
  }
  let stem: string | null = null;
  if (word.endsWith('습니다')) stem = word.slice(0, -3);
  else if (word.endsWith('니다')) {
    const ch = word.slice(-3, -2);
    if (isHangul(ch) && parts(ch).t === T_BIEUP) { const p = parts(ch); stem = word.slice(0, -3) + join(p.l, p.v); }
  }
  if (stem === null || !stem) return word;
  const hae = haeForm(stem);
  return level === 'haeyo' ? hae + '요' : hae;
}

// 문장 끝: 마침표·쉼표·물음표 앞, 또는 「… (상위 15%).」처럼 띄어 쓴 괄호·다음 말 앞
const END = String.raw`(?=[\s.!?,)]|$)`;
const ENDING = new RegExp(String.raw`([가-힣]+)니다` + END, 'g');

/** 합쇼체 → 해요체 */
export function toHaeyo(s: string): string {
  return s.replace(ENDING, (m) => conjugate(m, 'haeyo'));
}

/** 합쇼체·해요체 → 반말 */
export function toHae(s: string): string {
  return s.replace(ENDING, (m) => conjugate(m, 'hae'))
    .replace(/([가-힣])(이에요|예요)(?=[.!?]|$)/g, (_m, a: string, e: string) => a + (e === '이에요' ? '이야' : '야'))
    .replace(/까요(?=\?)/g, '까')
    .replace(/([가-힣])요(?=[.!?]|$)/g, '$1');
}

/** 담백한: 「…입니다.」로 끝나는 문장을 명사로 끝낸다(튜토리얼 §7 「광석은 평소와 크게 달랐던 주.」) */
export function toPlain(s: string): string {
  return s.replace(new RegExp(String.raw`([가-힣]+?)입니다` + END, 'g'), '$1');
}

/** 시니컬한: 해요체 + 지난 일은 「…더라고요」로 한 발 물러서 말한다 */
export function toDry(s: string): string {
  const past = (ch: string) => isHangul(ch) && parts(ch).t === T_SSANG && ch !== '있';
  return toHaeyo(s.replace(new RegExp(String.raw`([가-힣])습니다` + END, 'g'), (m, ch: string) => (past(ch) ? ch + '더라고요' : m)));
}

/** 인터넷 없이 쓰는 말투 바꾸기. 조용한은 템플릿 그대로 */
export function applyVoice(template: string, voice: Voice): string {
  switch (voice) {
    case 'warm': return toHaeyo(template);
    case 'plain': return toPlain(template);
    case 'dry': return toDry(template);
    case 'casual': return toHae(template);
    default: return template;
  }
}

// 시니컬 결의 선(보이스 v4 §7, 점검표 §5-4): 숫자로 감정을 뒷받침하거나 사용자를 과녁으로 삼지 않는다
const DRY_FORBIDDEN = [/숫자만 봐도/, /좀 그렇더/, /그럴 만하/, /티가 나/, /뻔하/];

/** tone.ts 검사 + 말투별 추가 검사 */
export function checkVoice(template: string, output: string, voice: Voice): { ok: boolean; reasons: string[] } {
  const r = checkTone(template, output);
  if (voice === 'dry') for (const re of DRY_FORBIDDEN) if (re.test(output)) r.reasons.push(`dry:${re.source}`);
  return { ok: r.reasons.length === 0, reasons: r.reasons };
}

export function voiceSystem(voice: Voice): string {
  return [
    '너는 기록 앱의 캐릭터 "민디"다. 주어진 문장의 말투만 바꾼다.',
    voiceDef(voice).prompt,
    '규칙: 숫자·날짜·순위·"가장" 같은 표현은 한 글자도 바꾸거나 더하거나 빼지 않는다.',
    '사람의 감정이나 상태를 이름 붙이지 않는다(슬픔·우울·힘듦 같은 말 금지). 앞일을 예측하거나 조언하지 않는다.',
    '문장 수를 늘리지 말고, 바꾼 문장만 출력한다.',
  ].join('\n');
}

export interface Voiced { text: string; used: 'template' | 'rule' | 'llm'; reasons?: string[] }

/**
 * 템플릿 문장을 고른 말투로. useLlm 이 꺼져 있거나 모델 답이 검사를 못 넘으면 어미 규칙 결과를,
 * 규칙 결과마저 검사를 못 넘으면(일어나면 안 되지만) 템플릿 그대로를 쓴다.
 */
export async function speakAs(template: string, voice: Voice, opts: { useLlm?: boolean; signal?: AbortSignal } = {}): Promise<Voiced> {
  const ruled = applyVoice(template, voice);
  const safe: Voiced = ruled === template ? { text: template, used: 'template' }
    : checkVoice(template, ruled, voice).ok ? { text: ruled, used: 'rule' } : { text: template, used: 'template' };
  if (!opts.useLlm) return safe;
  try {
    const r = await fetch('/api/mindi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: voiceSystem(voice), user: template }),
      signal: opts.signal,
    });
    if (!r.ok) return { ...safe, reasons: [`http_${r.status}`] };
    const text = String((await r.json()).text ?? '').trim();
    const check = checkVoice(template, text, voice);
    return check.ok ? { text, used: 'llm' } : { ...safe, reasons: check.reasons };
  } catch {
    return { ...safe, reasons: ['network'] };
  }
}

// ── 고른 말투 저장 ───────────────────────────────────────────────
const KEY = 'mined.voice.v1';
const EVT = 'mined:voice';

export function loadVoice(): Voice {
  try { const v = localStorage.getItem(KEY); return isVoice(v) ? v : DEFAULT_VOICE; } catch { return DEFAULT_VOICE; }
}

export function saveVoice(v: Voice): void {
  try { localStorage.setItem(KEY, v); } catch { /* 사생활 보호 창: 이번 화면에서만 */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

/** 설정 › 민디와 채팅 창이 같은 값을 보도록, 한 곳에서 바꾸면 다른 곳도 따라 바뀐다 */
export function useVoice(): [Voice, (v: Voice) => void] {
  const [v, setV] = useState<Voice>(loadVoice);
  useEffect(() => {
    const on = () => setV(loadVoice());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on); };
  }, []);
  return [v, (next: Voice) => { setV(next); saveVoice(next); }];
}
