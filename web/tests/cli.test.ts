// 명령줄 가져오기: 공유용 샘플 폴더를 브라우저와 같은 파서로 읽고, 판정·v6·평가 보고서까지 만든다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, parseArgs } from '../src/cli/mined';
import { readJson } from './helpers/synth';

const SAMPLE = path.resolve(__dirname, '../public/sample');

describe('명령줄 가져오기', () => {
  it('선택 읽기', () => {
    expect(parseArgs(['a.zip'])).toMatch('-o 로 출력 폴더');
    expect(parseArgs(['-o', 'x'])).toMatch('읽을 파일');
    expect(parseArgs(['a.zip', '-o', 'x', '--nope'])).toMatch('알 수 없는 선택');
    expect(parseArgs(['a.zip', '-o'])).toMatch('뒤에 값이 없습니다');
    const o = parseArgs(['a.zip', 'b', '-o', 'x', '--v6', '--kakao-me', '서지안']);
    expect(o).toMatchObject({ inputs: ['a.zip', 'b'], out: 'x', v6: true, judge: true, kakaoMe: '서지안' });
  });

  it('샘플 폴더 → 정답과 같은 일 단위 표, 판정, v6, 숫자만 담은 평가 보고서', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mined-cli-'));
    const events = path.join(out, 'events.json');
    fs.writeFileSync(events, JSON.stringify([
      { start: '2025-03-03', end: '2025-03-21', kind: 'hard', note: '독감' },
      { start: '2025-06-23', end: '2025-06-27', kind: 'good' },
      { start: '2025-09-01', kind: 'change' },
      { start: '2099-01-01', kind: 'hard' }, // 미래 날짜는 빼고 계산한다
    ]));
    const logs: string[] = [];
    const code = await main([SAMPLE, '-o', out, '--v6', '--events', events, '--participant', 'P2', '--quick'], (s) => logs.push(s));
    expect(code).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'daily.json'), 'utf8'))).toEqual(readJson('short', 'truth_daily.json'));
    const result = JSON.parse(fs.readFileSync(path.join(out, 'result.json'), 'utf8'));
    const v6 = JSON.parse(fs.readFileSync(path.join(out, 'v6.json'), 'utf8'));
    expect(v6.weeks.length).toBe(result.summary.n_candidates);
    const text = fs.readFileSync(path.join(out, 'mined_eval_P2.json'), 'utf8');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}/);
    expect(text).not.toContain('독감');
    const rep = JSON.parse(text);
    expect(rep).toMatchObject({ participant: 'P2', via: 'cli', seal: { sealed: false } });
    expect(rep.events.n).toBe(3);
    expect(logs.some((l) => l.includes('사건 4') && l.includes('오늘보다'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'memos.json'))).toBe(false); // 원문은 --memos 를 줄 때만
  });
});
