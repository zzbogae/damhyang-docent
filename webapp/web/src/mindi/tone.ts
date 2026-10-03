// 민디 말투 다듬기(선택). 외부 모델에는 판정 문장만 보내고, 돌아온 문장이 숫자·날짜·순위를 바꾸지 않았는지,
// 감정 판정·예측·조언 표현이 없는지 검사한다. 하나라도 어긋나면 템플릿 문장을 그대로 쓴다.
import { DONT_KNOW } from './templates';

const FACT_RE = /(\d{4}년|\d{1,2}월|\d{1,2}일|\d+주|\d+(?:\.\d+)?%|\d+개|\d+장|\d+번째|(?:두|세|네|다섯|여섯|일곱|여덟|아홉|열) 번째|가장)/g;

const FORBIDDEN = [
  /우울/, /불안/, /진단/, /치료/, /증상/, /질환/, /병원/, /상담을 받/, /위험/,
  /슬프|슬픔|외로|행복|기쁘|기쁨|힘드셨|힘들었|괴로|지치셨|지쳤/,
  /할 거예요|될 거예요|거예요\.|겁니다|것입니다|좋아질|나아질|괜찮아질|회복하실|이겨내/,
  /하세요|해 보세요|해보세요|추천|권해|조언|해야 합니다|하셔야/,
];

export function facts(s: string): string[] {
  return (s.match(FACT_RE) ?? []).map((x) => x.replace(/\s+/g, ' ')).sort();
}

export function checkTone(template: string, output: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const out = output.replace(DONT_KNOW, '').trim();
  if (!out) reasons.push('empty');
  const a = facts(template).join('|');
  const b = facts(out).join('|');
  if (a !== b) reasons.push(`facts_changed:${a} -> ${b}`);
  for (const re of FORBIDDEN) if (re.test(out) && !re.test(template)) reasons.push(`forbidden:${re.source}`);
  if (out.length > template.length * 1.6 + 40) reasons.push('too_long');
  return { ok: reasons.length === 0, reasons };
}

export const TONE_SYSTEM = [
  '너는 기록 앱의 캐릭터 "민디"다. 주어진 문장의 말투만 부드러운 합쇼체로 다듬는다.',
  '규칙: 숫자·날짜·순위·"가장" 같은 표현은 한 글자도 바꾸거나 더하거나 빼지 않는다.',
  '사람의 감정이나 상태를 이름 붙이지 않는다(슬픔·우울·힘듦 같은 말 금지). 앞일을 예측하거나 조언하지 않는다.',
  '문장 수를 늘리지 말고, 다듬은 문장만 출력한다.',
].join('\n');

export async function polishTone(template: string, signal?: AbortSignal): Promise<{ text: string; used: 'llm' | 'template'; reasons?: string[] }> {
  try {
    const r = await fetch('/api/mindi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: TONE_SYSTEM, user: template }),
      signal,
    });
    if (!r.ok) return { text: template, used: 'template', reasons: [`http_${r.status}`] };
    const j = await r.json();
    const text = String(j.text ?? '').trim();
    const check = checkTone(template, text);
    if (!check.ok) return { text: template, used: 'template', reasons: check.reasons };
    return { text, used: 'llm' };
  } catch (e) {
    return { text: template, used: 'template', reasons: ['network'] };
  }
}
