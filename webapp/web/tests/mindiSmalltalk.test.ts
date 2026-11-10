import { describe, expect, it } from 'vitest';
import { intensity, smallTalk, smallTalkCategory } from '../src/mindi/smalltalk';
import { fixedKind, scriptedReply } from '../src/mindi/talk';
import { parseIntent } from '../src/mindi/intent';
import { VOICES } from '../src/mindi/voices';

const ALL = VOICES.map((v) => v.id);
// tone.ts FORBIDDEN와 같은 선: 감정 이름 붙이기·예측·조언은 민디 문장에 없어야 한다(사용자의 말을 되돌려 주는 「」 안은 제외)
const FORBIDDEN = [
  /우울/, /불안/, /진단/, /치료/, /증상/, /질환/, /병원/, /위험/,
  /슬프|슬픔|외로|행복|기쁘|기쁨|힘드셨|힘들었|괴로|지치셨|지쳤/,
  /할 거예요|될 거예요|거예요\.|겁니다|것입니다|좋아질|나아질|괜찮아질|회복하실|이겨내/,
  /하세요|해 보세요|해보세요|추천|권해|조언|해야 합니다|하셔야/,
];
const strip = (s: string) => s.replace(/「[^」]*」/g, '「」').replace(/안녕하세요/g, '안녕');

describe('일상 대화·마음 공감(11/10, 챗봇 없을 때)', () => {
  it('마음을 꺼낸 말을 알아듣고, 그 말을 그대로 되돌려 준다', () => {
    expect(smallTalkCategory('요즘 너무 불안해요')).toBe('anxious');
    expect(smallTalkCategory('그냥 외로워')).toBe('lonely');
    expect(smallTalkCategory('아무것도 하기 싫다')).toBe('numb');
    expect(smallTalkCategory('오늘 좋은 일 있었어')).toBe('glad');
    for (const v of ALL) {
      const r = smallTalk('요즘 너무 불안해요', v)!;
      expect(r).toContain('「불안해요」');
      expect(r).not.toMatch(/\{말\}|\{이름\}/);
    }
  });
  it('일상말(인사·밥·날씨·너 누구야)도 받는다', () => {
    expect(smallTalkCategory('안녕 민디')).toBe('greeting');
    expect(smallTalkCategory('밥 먹었어?')).toBe('food');
    expect(smallTalkCategory('오늘 비 온다')).toBe('weather');
    expect(smallTalkCategory('너 누구야')).toBe('whoareyou');
    expect(smallTalkCategory('심심해')).toBe('bored');
    for (const v of ALL) expect(smallTalk('밥 먹었어?', v)).toBeTruthy();
  });
  it('기록을 묻는 말은 받지 않고 intent.ts로 넘긴다', () => {
    for (const q of ['잠을 못 잔 주는 언제였어?', '지난 주에 걷기는 얼마나 했어?', '2025년 3월 어땠어', '밥을 몇 번 먹었어']) {
      expect(smallTalkCategory(q)).toBeNull();
      expect(smallTalk(q, 'quiet')).toBeNull();
    }
    expect(parseIntent('잠을 못 잔 주는 언제였어?').kind).not.toBe('unknown');
  });
  it('진단·치료·위기와 대본집 공감은 먼저 받으므로 겹쳐도 상관없다', () => {
    expect(fixedKind('나 우울증인가?')).toBe('diagnosis');
    expect(fixedKind('죽고 싶어')).toBe('crisis');
    expect(scriptedReply('요즘 너무 힘들어', 'quiet')).toBeTruthy();
  });
  it('말의 세기: 반복·ㅠㅠ·「너무/계속」이 쌓이면 한 박자 늦추는 줄이 앞에 붙는다', () => {
    expect(intensity('조금 걱정돼')).toBe(0);
    const heavy = '진짜 너무 불안하고 계속 가슴이 뛰어서 하나도 못 하겠어 ㅠㅠㅠ 어떡하지...';
    expect(intensity(heavy)).toBe(2);
    for (const v of ALL) {
      const soft = smallTalk('조금 불안해', v)!.split('\n');
      const hard = smallTalk(heavy, v)!.split('\n');
      expect(hard.length).toBeGreaterThan(soft.length);
    }
    // 기쁜 말에는 세게 말해도 늦추는 줄·기록 제안을 덧붙이지 않는다
    expect(smallTalk('오늘 진짜 너무 좋은 일 있었어!! 계속 신나!!', 'warm')!.split('\n').length)
      .toBe(smallTalk('오늘 좋은 일 있었어', 'warm')!.split('\n').length);
  });
  it('말투 4종이 서로 다르고, 민디 문장에 감정 이름·예측·조언이 없다', () => {
    const inputs = ['요즘 너무 불안해요', '그냥 외로워', '화나', '피곤해', '아무것도 하기 싫다', '걱정돼', '스트레스 받아', '괜찮아', '기뻐',
      '안녕', '뭐 해?', '너 누구야', '뭐 할 수 있어?', '심심해', '졸려', '오늘 춥다', '배고파', '회사 가기 싫다', '주말에 뭐 할까', '귀여워', '잘 자', '갈게', '미안', '응', '아니'];
    for (const q of inputs) {
      const outs = ALL.map((v) => smallTalk(q, v));
      for (const o of outs) {
        expect(o, q).toBeTruthy();
        for (const re of FORBIDDEN) expect(strip(o!), `${q} / ${o}`).not.toMatch(re);
        expect(o!, q).not.toMatch(/\d/); // 숫자를 지어내지 않는다
      }
      expect(new Set(outs).size, q).toBeGreaterThan(1);
    }
  });
  it('이름이 있으면 {이름}님으로, 없으면 그 문장을 뺀다', () => {
    const named = ALL.map((v) => smallTalk('뭐 해?', v, '보경'));
    expect(named.every((s) => s!.includes('보경님'))).toBe(true);
    for (const v of ALL) expect(smallTalk('뭐 해?', v)).not.toMatch(/님|\{이름\}/);
  });
});
