// 10/23 장면 플로우·광물 규칙 v4: 직접 고른 광석의 겉색, 비어 있는 기록 알림, 오늘의 한 마디, 나의 공간 단어 후보, 열린 광석의 네 질문
import { describe, expect, it } from 'vitest';
import { missingUsual, oreMineral, pickedMineral } from '../src/ore/collection';
import { todayLine } from '../src/ui/Observatory';
import { oreFacts, spreadFacts, wordChoices } from '../src/ui/Space';
import { vibeAnswer } from '../src/ui/OreGuide';
import { CHANNELS, type Channel, type WeekRecord } from '../src/types';

function wk(i: number, over: Partial<WeekRecord> = {}): WeekRecord {
  const d = new Date(Date.UTC(2020, 0, 6 + i * 7));
  const iso = d.toISOString().slice(0, 10);
  const year = d.getUTCFullYear();
  const n = String(Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / 6048e5) + 1).padStart(2, '0');
  const coverage = Object.fromEntries(CHANNELS.map((c) => [c, c === 'health' || c === 'memo' || c === 'kakao' ? 'observed' : 'structural_missing'])) as Record<Channel, 'observed'>;
  return {
    schema: 'mined.week/8', week: `${year}-W${n}`, date_start: iso, date_end: iso, candidate: false, coverage, ind: {},
    axes: { move: { pr: 0.5, n_base: 52, z: 0.1 }, rest: { pr: 0.5, n_base: 52, z: -0.2 }, lang: null, talk: { pr: 0.5, n_base: 52, z: 0 } },
    gyeol: 'regular', badges: [], evidence: { families: [], independent: 0, cross_validated: false }, grade: null, grade_history: [],
    access: 'auto', era: null, mineral: null, shape: null, similar: [], sentence: null, ...over,
  } as WeekRecord;
}

describe('직접 고른 광석의 겉색(§4)', () => {
  it('가장 크게 벗어난 축과 방향으로 정한다', () => {
    const w = wk(60, { axes: { move: { pr: 0.6, n_base: 52, z: 0.4 }, rest: { pr: 0.1, n_base: 52, z: -1.7 }, lang: null, talk: { pr: 0.8, n_base: 52, z: 1.2 } } });
    expect(pickedMineral(w)).toEqual({ mineral: '월장석', axis: 'rest', dir: 'down' });
  });
  it('z 가 없으면 백분위로 견주고, 같은 값이면 언제나 같은 광석이다', () => {
    const w = wk(60, { axes: { move: { pr: 0.95, n_base: 52 }, rest: null, lang: { pr: 0.3, n_base: 52 }, talk: null } });
    expect(pickedMineral(w)?.mineral).toBe('호박');
    expect(pickedMineral(w)).toEqual(pickedMineral({ ...w }));
  });
  it('견줄 축이 없으면 색을 정하지 않는다', () => {
    expect(pickedMineral(wk(60, { axes: { move: null, rest: null, lang: null, talk: null } }))).toBeNull();
  });
  it('데이터 광석은 코어가 정한 광물을 그대로 쓴다', () => {
    expect(oreMineral(wk(60, { candidate: true, mineral: '형석' }))).toBe('형석');
  });
});

describe('비어 있는 기록 알림(§9)', () => {
  it('직전 52주 중 절반 넘게 있던 기록이 그 주에 없으면 센다', () => {
    const weeks = Array.from({ length: 60 }, (_, i) => wk(i));
    const last = weeks[59];
    last.coverage = { ...last.coverage, kakao: 'structural_missing', memo: 'partial' };
    expect(missingUsual(last, weeks).sort()).toEqual(['kakao', 'memo']);
    expect(missingUsual(weeks[58], weeks)).toEqual([]);
  });
});

describe('관측소 오늘의 한 마디', () => {
  const weeks = Array.from({ length: 120 }, (_, i) => wk(i, { candidate: i % 30 === 0 }));
  it('날짜마다 사실 문장 하나를 고르고, 같은 날이면 같은 문장이다', () => {
    const a = todayLine(weeks, 2, new Date(2026, 9, 24));
    expect(a).toBe(todayLine(weeks, 2, new Date(2026, 9, 24)));
    const four = new Set([0, 1, 2, 3].map((k) => todayLine(weeks, 2, new Date(2026, 9, 24 + k))));
    expect(four.size).toBe(4);
    for (const t of four) expect(t).not.toMatch(/좋|나쁘|힘들|우울/);
  });
});

describe('나의 공간', () => {
  const a = wk(70, { candidate: true, mineral: '호박', badges: [{ indicator: 'steps', label: '걸음수', family: 'health', axis: 'move', direction: 'up', pr: 0.97, rank: 1, n_base: 52, extreme: 1 }] });
  const b = wk(80, { axes: { move: { pr: 0.9, n_base: 52, z: 1.5 }, rest: null, lang: null, talk: null } });
  const c = wk(95, { axes: { move: null, rest: { pr: 0.1, n_base: 52, z: -1.4 }, lang: null, talk: null } });
  it('광석마다 계절·달·지표 움직임을 꺼낸다', () => {
    expect(oreFacts(a).moves).toEqual([{ axis: 'move', dir: 'up' }]);
    expect(oreFacts(c).moves).toEqual([{ axis: 'rest', dir: 'down' }]);
  });
  it('단어 후보는 광석의 사실과 사용자가 붙인 이름에서만 나온다', () => {
    const words = wordChoices([a, b, c], new Map([[b.week, ['이사한 주']]]));
    expect(words).toContain('이사한 주');
    expect(words).toContain('많이 걸은');
    expect(words).toContain('덜 잔');
    expect(new Set(words).size).toBe(words.length);
  });
  it('민디는 사실을 펼치고 결론 대신 질문으로 넘긴다', () => {
    const lines = spreadFacts([a, b, c], () => ({ memos: 2, photos: 5 }));
    expect(lines.some((l) => l.includes('세 광석 가운데 2개는 걸음이 평소보다 많았던 주'))).toBe(true);
    expect(lines[lines.length - 1]).toContain('?');
    expect(lines.join(' ')).not.toMatch(/좋았|나빴|행복|우울/);
  });
});

describe('열린 광석의 네 질문', () => {
  it('개수만 말하고 대화 내용은 읽지 않았다고 밝힌다', () => {
    const w = wk(10, { ind: { kakao_n: { v: 41, pr: 0.5, n_base: 52, rank_low: null, rank_high: null }, cal_n: { v: 0, pr: 0.5, n_base: 52, rank_low: null, rank_high: null } } });
    expect(vibeAnswer('talk', w, { memos: 0, photos: 0, shown: 0 }).text).toBe('이 주에 카톡을 41번 보냈습니다. 무슨 말을 했는지는 읽지 않았습니다.');
    expect(vibeAnswer('cal', w, { memos: 0, photos: 0, shown: 0 }).text).toBe('이 주에는 적어 둔 일정이 없었습니다.');
    expect(vibeAnswer('photo', w, { memos: 0, photos: 7, shown: 5 }).text).toContain('그중 2장은');
    expect(vibeAnswer('memo', w, { memos: 0, photos: 0, shown: 0 }).text).toBe('이 주에 남은 메모는 없습니다.');
  });
});
