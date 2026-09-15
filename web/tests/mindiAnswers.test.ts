// 민디 답변 템플릿: 판정값에서만 문장을 만들고, 앞일은 "이번은 저도 모릅니다"로 닫는지 본다.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { answer, QUESTIONS } from '../src/mindi/answers';
import { checkTone } from '../src/mindi/tone';

const core = path.resolve(__dirname, '../../core');
const res = JSON.parse(execFileSync(path.join(core, '.venv/bin/python'), ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(core)})
from tests.fixtures import make_daily
from mined_core import run
ev=[("2021-03-08",7,"hard"),("2021-03-15",7,"hard"),("2022-09-12",7,"trip"),("2023-05-15",7,"hard")]
rows, meta = make_daily(years=4, seed=5, events=ev)
print(json.dumps(run(rows, meta)))
`], { cwd: core, maxBuffer: 64 * 1024 * 1024 }).toString());

const byKey = new Map(res.weeks.map((w: any) => [w.week, w]));
const ctx = { result: res, byKey: byKey as any, memosByWeek: new Map() };

describe('민디 답변', () => {
  const cand = res.weeks.filter((w: any) => w.candidate);
  it('판정된 주에 모든 질문이 답을 만든다', () => {
    const w = cand[cand.length - 1];
    for (const q of QUESTIONS) {
      const a = answer(q.id, w, ctx);
      expect(a.text.length).toBeGreaterThan(10);
      // 감정 판정·예측·조언 금지어가 템플릿 자체에도 없다
      expect(checkTone(a.text, a.text).ok).toBe(true);
    }
  });
  it('닮은 주 답은 예측하지 않는다고 덧붙인다', () => {
    const w = cand.find((x: any) => x.similar?.length);
    expect(answer('similar', w, ctx).dontKnow).toBe(true);
  });
  it('연속으로 판정된 주는 에피소드로 묶인다', () => {
    expect((res.episodes ?? []).length).toBeGreaterThan(0);
    const ep = res.episodes[0];
    expect(ep.weeks.length).toBeGreaterThanOrEqual(2);
  });
  it('평소 주에는 고른 이유가 없다고 답한다', () => {
    const w = res.weeks.find((x: any) => !x.candidate && x.ind.steps.pr !== null);
    expect(answer('why', w, ctx).text).toContain('고른 주가 아닙니다');
  });
});
