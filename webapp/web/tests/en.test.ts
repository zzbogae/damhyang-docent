// 영어 자막: 같은 판정값에서 문장을 조립하고, 판정·위로 표현을 쓰지 않는다
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { answerEn, axisDirEn, badgeEn, weekSentenceEn } from '../src/i18n/en';
import { QUESTIONS } from '../src/mindi/answers';

const core = path.resolve(__dirname, '../../core');
const res = JSON.parse(execFileSync(path.join(core, '.venv/bin/python'), ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(core)})
from tests.fixtures import make_daily
from mined_core import run
rows, meta = make_daily(years=4, seed=5, events=[("2021-03-08",7,"hard"),("2022-09-12",7,"trip"),("2023-05-15",7,"hard")])
print(json.dumps(run(rows, meta, {"null_iter": 0})))
`], { cwd: core, maxBuffer: 64 * 1024 * 1024 }).toString());
const byKey = new Map(res.weeks.map((w: any) => [w.week, w]));
const ctx = { result: res, byKey: byKey as any, memosByWeek: new Map() };
const BANNED = /(recover|heal|better|worse|sad|depress|stress|okay|fine now|feel)/i;

describe('영어 자막', () => {
  it('배지는 이름표 형식으로 쓴다', () => {
    expect(badgeEn({ indicator: 'steps', direction: 'down', rank: 1, n_base: 52 } as any)).toBe('Steps: the lowest in the previous 52 weeks');
    expect(badgeEn({ indicator: 'memo_len', direction: 'up', rank: 4, n_base: 34 } as any)).toBe('Note length: the 4th highest in the previous 34 weeks');
  });
  it('판정된 주의 문장과 모든 질문의 답이 나오고, 판정·위로 단어가 없다', () => {
    const cand = res.weeks.filter((w: any) => w.candidate);
    for (const w of cand) expect(weekSentenceEn(w)).not.toMatch(BANNED);
    const w = cand[cand.length - 1];
    for (const q of QUESTIONS) {
      const t = answerEn(q.id, w, ctx);
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(BANNED);
    }
    expect(axisDirEn('move', 'down', w, ctx)).toMatch(/weeks/);
  });
});
