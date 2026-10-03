// 민디 자유 질문: 사용자가 친 문장을 기기 안 규칙으로 정해진 질문 하나에 연결한다. 외부 모델은 쓰지 않는다.
// 연결하지 못하면 지어내지 않고 「아직 답하지 못합니다」로 닫는다. 마음·이유를 묻는 말에는 판정하지 않는다고 답한다(원칙 1).
import type { Axis } from '../types';
import type { QuestionId } from './answers';

export type Intent =
  | { kind: 'question'; id: QuestionId }
  | { kind: 'axis'; axis: Axis; dir: 'up' | 'down' }
  | { kind: 'axis_unclear'; axis: Axis }
  | { kind: 'feeling' }
  | { kind: 'unknown' };

const AXIS_RE: [Axis, RegExp][] = [
  ['rest', /(잠|수면|잤|자는|잔 주|못 ?잔|잘 ?잔|쉬|쉼|피곤|불면)/],
  ['move', /(걸음|걸었|걷|산책|운동|움직|만보)/],
  ['watch', /(유튜브|영상|화면|폰|핸드폰|스마트폰|휴대폰|ai|챗지피티|chatgpt|클로드|본 주)/i],
  ['leave', /(메모|기록|사진|글|일기|카톡|인스타|남긴|남겼|찍은|썼)/],
];
const DOWN_RE = /(적[게었은]|짧[게았은]|못|덜|안 ?[잤걸찍썼남]|부족|줄었|없었)/;
const UP_RE = /(많[이았은]|길[게었]|오래|자주|잘 ?잤|잘 ?잔|더 |늘었|푹)/;
const FEELING_RE = /(힘들|우울|슬펐|외로|불안|괜찮|행복|기뻤|화났|지쳤|마음|기분|감정|스트레스)/;

const QUESTION_RE: [QuestionId, RegExp][] = [
  ['similar', /(닮은|비슷한)/],
  ['why', /(왜|이유|어떻게 골|무슨 기준)/],
  ['after', /(그 ?뒤|이후|다음에|그다음|어떻게 됐)/],
  ['era', /(시기|무렵|그때 ?는 어땠)/],
  ['year', /(1년|일 ?년|올해|가장 달랐|제일 달랐)/],
  ['what', /(무엇이|뭐가|무슨 일|달랐어|달랐나)/],
];

export function parseIntent(raw: string): Intent {
  const t = raw.normalize('NFC').trim().toLowerCase();
  if (!t) return { kind: 'unknown' };
  const axis = AXIS_RE.find(([, re]) => re.test(t))?.[0];
  if (axis) {
    const down = DOWN_RE.test(t), up = UP_RE.test(t);
    if (down && !up) return { kind: 'axis', axis, dir: 'down' };
    if (up && !down) return { kind: 'axis', axis, dir: 'up' };
    return { kind: 'axis_unclear', axis };
  }
  const q = QUESTION_RE.find(([, re]) => re.test(t))?.[0];
  if (q) return { kind: 'question', id: q };
  if (FEELING_RE.test(t)) return { kind: 'feeling' };
  return { kind: 'unknown' };
}

export const FEELING_TEXT = '저는 그때의 마음이 어땠는지 판정하지 않습니다. 대신 그 주에 무엇이 평소와 달랐는지, 그때 남긴 글이 무엇인지는 보여 드릴 수 있습니다.';
export const UNKNOWN_TEXT = '이 질문에는 아직 답하지 못합니다. 위의 질문 가운데서 골라 주시거나, 걸음·잠·화면·기록 가운데 하나로 물어 주세요.';
export const UNCLEAR_TEXT = '어느 쪽을 찾을까요?';
