// 참가자 평가 보고서가 Pyodide(브라우저와 같은 런타임)와 CPython 에서 같은 숫자를 내는지, 진행 단계를 알려 주는지 본다.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { installCore, runFieldReport } from '../src/judge/pyRunner';

const core = path.resolve(__dirname, '../../core');
const synth = path.resolve(__dirname, '../../synth/out/short');
const pyBin = path.join(core, '.venv/bin/python');

function coreFiles(): Record<string, string> {
  const dir = path.join(core, 'mined_core');
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.py')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
}

describe('참가자 평가 보고서(Pyodide)', () => {
  it('합성 short 인물에서 CPython 과 같은 보고서를 만든다', async () => {
    const daily = fs.readFileSync(path.join(synth, 'truth_daily.json'), 'utf8');
    const meta = fs.readFileSync(path.join(synth, 'truth_meta.json'), 'utf8');
    const kind: Record<string, string> = { hard: 'hard', trip: 'good', busy: 'good' };
    const events = JSON.stringify(JSON.parse(fs.readFileSync(path.join(synth, 'events.json'), 'utf8')).events
      .map((e: any) => ({ start: e.start, end: e.end, kind: e.persistent ? 'change' : kind[e.type] ?? 'good' })));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mined-field-'));
    fs.writeFileSync(path.join(tmp, 'events.json'), events);
    execFileSync(pyBin, ['-m', 'mined_core.cli', 'field', path.join(synth, 'truth_daily.json'), path.join(synth, 'truth_meta.json'),
      path.join(tmp, 'events.json'), '--quick', '-o', path.join(tmp, 'cpython.json')], { cwd: core, stdio: 'pipe' });
    const expected = JSON.parse(fs.readFileSync(path.join(tmp, 'cpython.json'), 'utf8'));

    const py = await loadPyodide({ indexURL: path.resolve(__dirname, '../public/pyodide') + '/' });
    await py.loadPackage('numpy');
    await installCore(py, coreFiles());
    const stages: string[] = [];
    const got = JSON.parse(runFieldReport(py, daily, meta, events, JSON.stringify({ quick: true }), (s) => stages.push(s)));
    delete got.seconds;
    delete expected.seconds;
    expect(got).toEqual(expected);
    expect(stages[0]).toBe('판정 다시 하는 중');
    expect(stages).toContain('채널 하나씩 빼고 판정하는 중');
    expect(got.anchors.n_events).toBe(6);
  });
});
