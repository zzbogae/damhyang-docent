// 판정 워커: Pyodide 를 한 번 띄워 두고 판정 요청마다 mined_core.run_json 을 부른다.
import * as Comlink from 'comlink';
import { loadPyodide, type PyodideAPI } from 'pyodide';
import { PY_FILES } from './pyBundle';
import { installCore, runFieldReport, runJudge } from './pyRunner';

let ready: Promise<PyodideAPI> | null = null;

function ensure(onStage?: (s: string) => void): Promise<PyodideAPI> {
  if (!ready) {
    ready = (async () => {
      onStage?.('Python 런타임 불러오는 중');
      const base = new URL(import.meta.env.BASE_URL + 'pyodide/', self.location.origin).href;
      const py = await loadPyodide({ indexURL: base });
      onStage?.('numpy 불러오는 중');
      await py.loadPackage('numpy');
      await installCore(py, PY_FILES);
      return py;
    })();
  }
  return ready;
}

const api = {
  async warmup(onStage?: (s: string) => void) {
    const t = performance.now();
    await ensure(onStage);
    return Math.round(performance.now() - t);
  },
  async judge(dailyJson: string, metaJson: string, configJson = '{}', onStage?: (s: string) => void) {
    const py = await ensure(onStage);
    onStage?.('판정 중');
    const t = performance.now();
    const out = runJudge(py, dailyJson, metaJson, configJson);
    return { json: out, ms: Math.round(performance.now() - t) };
  },
  async fieldReport(dailyJson: string, metaJson: string, eventsJson: string, optsJson = '{}', onStage?: (s: string) => void) {
    const py = await ensure(onStage);
    const t = performance.now();
    const out = runFieldReport(py, dailyJson, metaJson, eventsJson, optsJson, (s) => { onStage?.(s); });
    return { json: out, ms: Math.round(performance.now() - t) };
  },
};

export type JudgeAPI = typeof api;
Comlink.expose(api);
