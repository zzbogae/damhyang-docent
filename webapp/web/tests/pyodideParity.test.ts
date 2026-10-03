// 같은 입력에서 CPython(CLI)과 Pyodide(브라우저와 같은 런타임)의 판정 결과가 같은지 본다(골든 테스트, 계획서 1-4).
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { installCore, runJudge } from '../src/judge/pyRunner';

const core = path.resolve(__dirname, '../../core');
const pyBin = path.join(core, '.venv/bin/python');

function coreFiles(): Record<string, string> {
  const dir = path.join(core, 'mined_core');
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.py')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
}

describe('CPython 과 Pyodide 판정 일치', () => {
  it('합성 4년 데이터에서 주별 판정 JSON 이 같다', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mined-parity-'));
    execFileSync(pyBin, ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(core)})
from tests.fixtures import make_daily
from mined_core import run_json
ev=[("2021-03-08",7,"hard"),("2022-09-12",7,"trip"),("2023-05-15",7,"hard")]
rows, meta = make_daily(years=4, seed=5, events=ev, gap=("photo","2021-06-01","2021-11-30"))
open(${JSON.stringify(tmp)}+"/daily.json","w").write(json.dumps(rows))
open(${JSON.stringify(tmp)}+"/meta.json","w").write(json.dumps(meta))
open(${JSON.stringify(tmp)}+"/cpython.json","w").write(run_json(json.dumps(rows), json.dumps(meta)))
`], { cwd: core });
    const daily = fs.readFileSync(path.join(tmp, 'daily.json'), 'utf8');
    const meta = fs.readFileSync(path.join(tmp, 'meta.json'), 'utf8');
    const expected = JSON.parse(fs.readFileSync(path.join(tmp, 'cpython.json'), 'utf8'));

    const pub = path.resolve(__dirname, '../public/pyodide');
    const py = await loadPyodide({ indexURL: pub + '/' });
    await py.loadPackage('numpy');
    await installCore(py, coreFiles());
    const t = Date.now();
    const got = JSON.parse(runJudge(py, daily, meta));
    const ms = Date.now() - t;
    console.log(`pyodide judge ${ms}ms, weeks=${got.weeks.length}, candidates=${got.summary.n_candidates}`);
    expect(got.weeks.length).toBe(expected.weeks.length);
    expect(got.weeks.map((w: any) => w.candidate)).toEqual(expected.weeks.map((w: any) => w.candidate));
    expect(got.weeks.map((w: any) => w.sentence)).toEqual(expected.weeks.map((w: any) => w.sentence));
    expect(got).toEqual(expected);
  });
});
