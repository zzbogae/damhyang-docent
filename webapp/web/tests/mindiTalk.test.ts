import { describe, expect, it } from 'vitest';
import { DAILY, EMPATHY, FIXED, NOTICE_FIRST_CHAT, OPENERS } from '../src/mindi/scripts.gen';
import { dailyLine, fixedKind, fixedLine, islandLockedLine, openerLine, scriptedReply, withName } from '../src/mindi/talk';
import { VOICES } from '../src/mindi/voices';

const ALL = VOICES.map((v) => v.id);

describe('대본집 v1.1 → scripts.gen.ts', () => {
  it('오늘의 한 마디 44 × 4, 오프너 10 × 4, 첫 대화 고지', () => {
    for (const v of ALL) { expect(DAILY[v]).toHaveLength(44); expect(OPENERS[v]).toHaveLength(10); }
    expect(DAILY.quiet[0]).toBe('오늘도 한 층 쌓였습니다.');
    expect(DAILY.plain[0]).toBe('오늘 한 층 추가.');
    expect(NOTICE_FIRST_CHAT).toContain('저는 AI예요');
    expect(EMPATHY['(먼저) 요즘 너무 힘들어'].quiet).toContain('힘드시군요');
  });

  it('대본집에서 고친 줄(★ 10/24) 표시와 「(같음)」 같은 메모는 문장에 남지 않는다', () => {
    const every = [...Object.values(DAILY).flat(), ...Object.values(OPENERS).flat()];
    for (const s of every) expect(s).not.toMatch(/★|\(같음|`/);
  });
});

describe('진단·치료·위기 고정형(§17)', () => {
  it('알아듣는다', () => {
    expect(fixedKind('요즘 다 의미 없는 것 같아')).toBe('crisis');
    expect(fixedKind('죽고 싶어')).toBe('crisis');
    expect(fixedKind('약 줄여도 돼?')).toBe('treatment');
    expect(fixedKind('나 우울증인가?')).toBe('diagnosis');
    expect(fixedKind('ADHD 같아?')).toBe('diagnosis');
    expect(fixedKind('잠을 못 잔 주는 언제였어?')).toBeNull();
  });
  it('문장은 대본집 그대로, 관측소의 문을 가리킨다', () => {
    expect(fixedLine('crisis')).toBe(FIXED.crisis);
    expect(fixedLine('crisis')).toContain('「관측소의 문」');
    expect(fixedLine('treatment')).toContain('의사 선생님');
  });
});

describe('공감·돌려 답하기(§11-5·§11-6)', () => {
  it('사용자의 말을 대본집 줄로 받고, 말투 따라 결이 바뀐다', () => {
    expect(scriptedReply('요즘 너무 힘들어', 'quiet')).toContain('힘드시군요. 꺼내 주셔서 고마워요.');
    expect(scriptedReply('요즘 너무 힘들어', 'plain')).toBe('힘드시군요. 제일 무거운 게 뭐예요?');
    expect(scriptedReply('그래서 내가 맞아 틀려?', 'dry')).toContain('지하에 법원이 없어서요');
  });
  it('호칭이 없으면 {이름}님이 든 문장을 빼고, 지어낸 숫자가 든 줄은 쓰지 않는다', () => {
    expect(scriptedReply('고마워', 'quiet')).toBe('저는 지켜두기만 했어요.');
    expect(scriptedReply('고마워', 'quiet', '새벽돌')).toContain('열어본 건 새벽돌님이고요');
    const fun = scriptedReply('이때 진짜 재밌었는데', 'quiet')!;
    expect(fun).not.toMatch(/사진/);
    expect(withName('{이름}님은 어떠셨어요?')).toBeNull();
  });
  it('받을 말이 없으면 null(판정값 답으로 넘어감)', () => {
    expect(scriptedReply('잠을 못 잔 주는 언제였어?', 'quiet')).toBeNull();
  });
});

describe('오늘의 한 마디 · 첫 한 마디 · 섬 잠김', () => {
  it('같은 날이면 같은 줄, 날마다 바뀐다', () => {
    const d = new Date(2026, 9, 24);
    expect(dailyLine('warm', d)).toBe(dailyLine('warm', d));
    expect(dailyLine('quiet', d)).not.toBe(dailyLine('quiet', new Date(2026, 9, 25)));
  });
  it('첫 한 마디는 호칭이 없으면 {이름}이 남지 않는다', () => {
    for (let k = 0; k < 10; k++) for (const v of ALL) expect(openerLine(v, new Date(2026, 9, 24 + k))).not.toContain('{이름}');
  });
  it('섬 잠김 한 줄: 두 개면 「하나 더」, 그보다 적으면 「조금만 더」', () => {
    expect(islandLockedLine(2, 'quiet')).toBe('광석이 두 개 있네요. 하나 더 캐시면 열립니다.');
    expect(islandLockedLine(0, 'dry')).toContain('안개가 좀 고집이 세요');
  });
});
