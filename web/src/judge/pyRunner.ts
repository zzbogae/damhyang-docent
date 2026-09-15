// Pyodide 위에서 mined_core 를 준비하고 run_json 을 부르는 공용 코드(브라우저 워커와 Node 테스트가 함께 쓴다).
import type { PyodideAPI } from 'pyodide';

export async function installCore(py: PyodideAPI, files: Record<string, string>) {
  py.FS.mkdirTree('/home/pyodide/mined_core');
  for (const [name, src] of Object.entries(files)) {
    py.FS.writeFile(`/home/pyodide/mined_core/${name}`, src);
  }
  py.runPython('import sys\nif "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")');
}

export function runJudge(py: PyodideAPI, dailyJson: string, metaJson: string, configJson = '{}'): string {
  py.globals.set('_d', dailyJson);
  py.globals.set('_m', metaJson);
  py.globals.set('_c', configJson);
  const out = py.runPython('import mined_core\nmined_core.run_json(_d, _m, _c)');
  return out as string;
}

/** 참가자 평가 보고서(숫자만). progress 는 단계 이름을 받는다. */
export function runFieldReport(py: PyodideAPI, dailyJson: string, metaJson: string, eventsJson: string, optsJson = '{}',
  progress?: (s: string) => void): string {
  py.globals.set('_d', dailyJson);
  py.globals.set('_m', metaJson);
  py.globals.set('_e', eventsJson);
  py.globals.set('_o', optsJson);
  py.globals.set('_p', progress ?? null);
  try {
    return py.runPython('from mined_core.field_eval import field_report_json\nfield_report_json(_d, _m, _e, _o, _p)') as string;
  } finally {
    py.globals.delete('_p');
  }
}
