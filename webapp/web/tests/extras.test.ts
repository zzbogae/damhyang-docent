import { describe, expect, it } from 'vitest';
import { commitsByDate, parseGitLog } from '../src/import/parsers/git';
import { mergeExtras } from '../src/extras/extras';

describe('깃 커밋 기록', () => {
  it('iso-strict 와 기본 git log 출력을 모두 읽고 한국 날짜로 센다', () => {
    const t = parseGitLog(['2025-03-04T23:30:00+09:00', '2025-03-04T15:10:00Z', 'commit abc', 'Author: me',
      'Date:   Tue Mar 4 22:12:01 2025 +0900', '', '    message 2025-01-01 은 날짜가 아니라 메시지'].join('\n'));
    const by = commitsByDate(t.slice(0, 3));
    expect(by.get('2025-03-04')).toBe(2);
    expect(by.get('2025-03-05')).toBe(1); // 15:10Z = 한국 3/5 00:10
  });
});

describe('기록 더하기 합치기', () => {
  const meta = { tz: 'Asia/Seoul', night_hours: [0, 5] as [number, number], channels: {} };
  it('주 평균은 그 주 일곱 날에, 하루 값은 그날에 넣고 하루 값이 이긴다', () => {
    const r = mergeExtras([{ date: '2025-03-05', memo_n: 1 }], meta, {
      screen: [{ id: 'a', date: '2025-03-06', minutes: 263, kind: 'week_avg', file: 'a' }, { id: 'b', date: '2025-03-05', minutes: 90, kind: 'day', file: 'b' }],
      git: [{ date: '2025-03-05', n: 3 }],
    });
    const by = new Map(r.daily.map((d) => [d.date, d]));
    expect(by.get('2025-03-03')!.screen_min).toBe(263);
    expect(by.get('2025-03-09')!.screen_min).toBe(263);
    expect(by.get('2025-03-05')).toMatchObject({ memo_n: 1, screen_min: 90, git_commits: 3 });
    expect(r.meta.channels.screen).toMatchObject({ first: '2025-03-03', last: '2025-03-09' });
  });
});
