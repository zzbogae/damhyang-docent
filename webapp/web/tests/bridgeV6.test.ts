// 팀 v6 JSON(원페이지 공유용 샘플) ↔ v7. 팀 샘플을 그대로 불러오고, 다시 v6 로 내보내면 같은 값이 나오는지 본다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fromV6, isV6, toV6, v6Pct, type V6Json } from '../src/bridge/v6';
import { selectRelic } from '../src/relic/select';

// 멘토 작업 폴더의 팀 원본 샘플이 있으면 그것을, 팀 저장소에서는 samples/ 의 합성 샘플을 읽는다
const teamFile = [path.resolve(__dirname, '../../../team_files_20260911/sample_data.json'), path.resolve(__dirname, '../../../samples/sample_data_synthetic.json')].find((f) => fs.existsSync(f))!;
const team = JSON.parse(fs.readFileSync(teamFile, 'utf8')) as V6Json;

describe('팀 v6 JSON 불러오기', () => {
  const { result, memos } = fromV6(team);
  it('v6 로 알아보고 판정 주 80개와 원문을 옮긴다', () => {
    expect(isV6(team)).toBe(true);
    expect(result.weeks.filter((w) => w.candidate)).toHaveLength(team.weeks.length);
    expect(memos).toHaveLength(team.weeks.reduce((n, w) => n + (w.relic?.q.length ?? 0), 0));
    // 판정되지 않은 주도 채워서 지층이 끊기지 않는다
    expect(result.weeks.length).toBeGreaterThan(team.weeks.length * 5);
  });
  it('문장에서 배지 방향을 읽는다', () => {
    // 팀 원본에서는 2012-W10("검색이 평소보다 많았습니다 … 걸음수가 평소보다 적었습니다"), 합성 샘플에서는 걸음이 적었던 첫 주
    const src = team.weeks.find((x) => x.week === '2012-W10' && x.sentence.includes('걸음수가 평소보다 적었'))
      ?? team.weeks.find((x) => x.sentence.includes('걸음수가 평소보다 적었') && x.badges.some((b) => b.label === '걸음수'))!;
    const w = result.weeks.find((x) => x.week === src.week)!;
    const dir = Object.fromEntries(w.badges.map((b) => [b.indicator, b.direction]));
    // 유튜브는 10/22 지표 넷 밖(근거 전용)이라 배지로 옮기지 않는다
    expect(dir.yt_search).toBeUndefined();
    expect(dir.steps).toBe('down');
  });
  it('다시 v6 로 내보내면 원래 값과 같다', () => {
    const byWeek = new Map<string, typeof memos>();
    for (const m of memos) { const a = byWeek.get(m.week) ?? []; a.push(m); byWeek.set(m.week, a); }
    const back = toV6(result, (w) => (byWeek.get(w.week) ?? []).filter((m) => m.id.startsWith(`v6-${w.week}-`)), { sample: true, notice: team.notice });
    expect(back.weeks).toHaveLength(team.weeks.length);
    const strip = (w: any) => ({ week: w.week, date_start: w.date_start, date_end: w.date_end, tier: w.tier, sentence: w.sentence,
      cross_validated: w.cross_validated, badges: w.badges, mineral: w.mineral, shape: w.shape, access: w.access,
      relic: w.relic ? w.relic.q.map((q: any) => [q.t, q.d, q.h, q.mi]) : null });
    // 근거 전용 지표(유튜브·사진·일정)의 배지는 불러올 때 빠지므로 원본에서도 빼고 비교한다
    const EVIDENCE = new Set(['사진 촬영 수', '심야 촬영 비율', '유튜브 시청 수', '유튜브 심야 비율', '유튜브 검색량', '일정 개수']);
    const want = [...team.weeks].sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((w) => ({ ...w, badges: w.badges.filter((b) => !EVIDENCE.has(b.label)) }));
    expect(back.weeks.map(strip)).toEqual(want.map(strip));
  });
});

describe('v7 판정 결과를 팀 v6 로 내보내기', () => {
  const core = path.resolve(__dirname, '../../core');
  const res = JSON.parse(execFileSync(path.join(core, '.venv/bin/python'), ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(core)})
from tests.fixtures import make_daily
from mined_core import run
rows, meta = make_daily(years=4, seed=5, events=[("2021-03-08",7,"hard"),("2022-09-12",7,"trip"),("2023-05-15",7,"hard")])
print(json.dumps(run(rows, meta)))
`], { cwd: core, maxBuffer: 64 * 1024 * 1024 }).toString());
  it('판정된 주만, 팀 표기로 내보내고 비밀 메모는 넣지 않는다', () => {
    const secret = { id: 's', ts: '2023-05-16T02:00', date: '2023-05-16', week: '2023-W20', hour: 2, text: '비번 qW8#kLm2@xZ', chars: 15, source: 'keep' };
    const normal = { id: 'n', ts: '2023-05-17T13:05', date: '2023-05-17', week: '2023-W20', hour: 13, text: '산책길 자전거', chars: 7, source: 'keep' };
    const v6 = toV6(res, (w) => {
      const ms = w.week === '2023-W20' ? [secret, normal] : [];
      const sel = selectRelic(w, ms as any, []);
      return ms.filter((m) => sel.memo_ids.includes(m.id)) as any;
    });
    expect(v6.weeks.length).toBe(res.summary.n_candidates);
    for (const w of v6.weeks) for (const b of w.badges) expect(b.pct).toMatch(/^(상위 \d+%|직전 1년 중 가장 두드러진 주)$/);
    const w20 = v6.weeks.find((w) => w.week === '2023-W20')!;
    expect(w20.relic?.q.map((q) => q.t)).toEqual(['산책길 자전거']);
    expect(v6Pct({ direction: 'down', pr: 0.02, extreme: 1 } as any)).toBe('상위 2%');
  });
});
