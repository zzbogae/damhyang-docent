import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyVoice, checkVoice, toHaeyo, toPlain, VOICES, type Voice } from '../src/mindi/voices';
import { facts } from '../src/mindi/tone';
import { nextVoice, VoicePicker, VoiceChip } from '../src/ui/VoiceChip';
import { SpaceButton, spaceState } from '../src/ui/SpaceButton';

const T = '2019년 3월 4일부터의 한 주가 이번 주와 가장 닮았습니다. 두 주 모두 걸음수·수면 시간은 평소보다 적은 편이었습니다. 그 주에 쓴 글이 3개 남아 있습니다. 그때는 약 5주 뒤부터 평소의 흐름이 이어졌습니다.';
const ALL: Voice[] = VOICES.map((v) => v.id);

describe('말투 4종(대본집 v1.1 §18)', () => {
  it('네 가지, 기본은 조용한', () => {
    expect(ALL).toEqual(['quiet', 'warm', 'plain', 'dry']);
    expect(applyVoice(T, 'quiet')).toBe(T);
  });

  it('어떤 말투에서도 숫자·날짜·순위가 그대로이고 검사를 통과', () => {
    for (const v of ALL) {
      const out = applyVoice(T, v);
      expect(facts(out)).toEqual(facts(T));
      expect(checkVoice(T, out, v)).toEqual({ ok: true, reasons: [] });
    }
  });

  it('해요체', () => {
    expect(toHaeyo('평소보다 많았습니다.')).toBe('평소보다 많았어요.');
    expect(toHaeyo('기록이 없습니다.')).toBe('기록이 없어요.');
    expect(toHaeyo('3개 남아 있습니다.')).toBe('3개 남아 있어요.');
    expect(toHaeyo('벗어난 주입니다.')).toBe('벗어난 주예요.');
    expect(toHaeyo('그 산입니다.')).toBe('그 산이에요.');
    expect(toHaeyo('진단이 아닙니다.')).toBe('진단이 아니에요.');
    expect(toHaeyo('안개가 열립니다.')).toBe('안개가 열려요.');
    expect(toHaeyo('직접 고릅니다.')).toBe('직접 골라요.');
    expect(toHaeyo('이번은 저도 모릅니다.')).toBe('이번은 저도 몰라요.');
    expect(toHaeyo('기록이 됩니다.')).toBe('기록이 돼요.');
    expect(toHaeyo('이 해에 속합니다.')).toBe('이 해에 속해요.');
    expect(toHaeyo('다시 봅니다.')).toBe('다시 봐요.');
    expect(toHaeyo('비교하지 않습니다.')).toBe('비교하지 않아요.');
    expect(toHaeyo('흐름이 이어졌습니다.')).toBe('흐름이 이어졌어요.');
    expect(toHaeyo('메모를 했습니다.')).toBe('메모를 했어요.');
  });

  it('괄호가 붙은 문장 끝도 바꾼다(민디에게 묻기 답)', () => {
    const A = '2026년 11월 2일 ~ 8일에는 검색이 평소보다 적었습니다 (직전 1년 중 가장 두드러진 주) 그리고 걸음수가 평소보다 적었습니다 (상위 15%).';
    expect(toHaeyo(A)).toBe('2026년 11월 2일 ~ 8일에는 검색이 평소보다 적었어요 (직전 1년 중 가장 두드러진 주) 그리고 걸음수가 평소보다 적었어요 (상위 15%).');
    for (const v of ALL) expect(checkVoice(A, applyVoice(A, v), v).ok).toBe(true);
    expect(toHaeyo('합니다만 그렇습니다.')).toBe('합니다만 그래요.');
    expect(toHaeyo('평소와 같습니다. 기분이 좋습니다.')).toBe('평소와 같아요. 기분이 좋아요.');
  });

  it('담백한은 「입니다」 문장을 명사로 끝낸다', () => {
    expect(toPlain('평소 범위 위로 벗어난 주입니다. 기록이 없습니다.')).toBe('평소 범위 위로 벗어난 주. 기록이 없습니다.');
    expect(toPlain('진단이 아닙니다.')).toBe('진단이 아닙니다.');
  });

  it('시니컬한은 지난 일을 「더라고요」로, 숫자로 감정을 짐작하면 거절', () => {
    expect(applyVoice('걸음이 적었습니다.', 'dry')).toBe('걸음이 적었더라고요.');
    expect(applyVoice('흐름이 이어졌습니다. 3개 남아 있습니다.', 'dry')).toBe('흐름이 이어졌더라고요. 3개 남아 있어요.');
    expect(checkVoice(T, T + ' 숫자만 봐도 좀 그렇더라고요.', 'dry').ok).toBe(false);
  });
});

describe('말투 칩', () => {
  it('방향키로 돌아가며 고른다', () => {
    expect(nextVoice('quiet', 'ArrowRight')).toBe('warm');
    expect(nextVoice('quiet', 'ArrowUp')).toBe('dry');
    expect(nextVoice('warm', 'End')).toBe('dry');
    expect(nextVoice('dry', 'a')).toBeNull();
  });

  it('칩은 현재 말투를 보이고, 목록은 radiogroup', () => {
    const chip = renderToStaticMarkup(createElement(VoiceChip, { value: 'warm', onChange: () => {} }));
    expect(chip).toContain('다정한');
    expect(chip).toContain('aria-haspopup="dialog"');
    const list = renderToStaticMarkup(createElement(VoicePicker, { value: 'dry', onChange: () => {}, withSample: true }));
    expect(list).toContain('role="radiogroup"');
    expect(list.match(/role="radio"/g)).toHaveLength(4);
    expect(list.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(list).toContain('세 번이요.');
  });
});

describe('나만의 섬으로 가기', () => {
  it('광석 3개로 열린다', () => {
    expect(spaceState(2)).toEqual({ open: false, have: 2, need: 3 });
    expect(spaceState(3)).toEqual({ open: true });
    expect(spaceState(7)).toEqual({ open: true });
  });

  it('잠김은 N/3 과 대본집 §13 민디 한 줄(말투 따라), 카운트다운은 없다', () => {
    const one = renderToStaticMarkup(createElement(SpaceButton, { count: 1, onOpen: () => {} }));
    expect(one).toContain('나만의 섬 · <span aria-hidden="true">🔒</span> 1/3');
    expect(one).toContain('aria-disabled="true"');
    expect(one).toContain('아직 자리가 안 생겼어요. 조금만 더 파 보죠.');
    const two = renderToStaticMarkup(createElement(SpaceButton, { count: 2, onOpen: () => {}, voice: 'plain' }));
    expect(two).toContain('광석 두 개. 하나 더면 열림.');
    for (const h of [one, two]) expect(h).not.toMatch(/남았|빨리|까지/);
  });

  it('열리면 대화로 만들기', () => {
    const html = renderToStaticMarkup(createElement(SpaceButton, { count: 3, onOpen: () => {} }));
    expect(html).toContain('나만의 섬으로 가기');
    expect(html).not.toContain('aria-disabled');
  });
});
