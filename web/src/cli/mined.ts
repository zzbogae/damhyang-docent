// 명령줄 가져오기: 브라우저와 같은 파서로 내보내기 파일을 읽어 일 단위 표·채널 메타를 만들고,
// 원하면 판정(Pyodide, 브라우저와 같은 런타임)·팀 v6 JSON·참가자 평가 보고서까지 만든다. 네트워크를 쓰지 않는다.
//
//   npm run cli -- <파일·폴더...> -o <출력 폴더> [--kakao-me 이름] [--judge] [--v6] [--memos]
//                  [--events events.json --participant P1 [--quick]]
//
// 사진 필터(얼굴·글자)는 브라우저에서만 돈다. 명령줄은 사진의 찍은 날짜만 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MinedResult } from '../types';
import { type ImportInput, type ImportProgress, runImport } from '../import/importer';
import { scanMemo, toMemoFlags } from '../filter/memoFilter';

export interface CliOptions {
  inputs: string[];
  out: string;
  kakaoMe?: string;
  judge: boolean;
  v6: boolean;
  memos: boolean;
  events?: string;
  participant?: string;
  quick: boolean;
  pyodideDir?: string;
  quiet: boolean;
}

const HELP = `mined 명령줄 가져오기

  npm run cli -- <파일·폴더...> -o <출력 폴더> [선택]

  -o, --out <폴더>        결과를 쓸 폴더(없으면 만든다)
  --kakao-me <이름>       카카오톡에서 "나"로 볼 이름(없으면 메시지를 가장 많이 보낸 사람)
  --judge                 판정까지 한다(result.json). public/pyodide 가 있어야 한다(npm run assets)
  --v6                    판정 결과를 팀 뷰어용 v6 JSON(v6.json)으로도 쓴다. 메모 원문이 들어간다
  --memos                 메모 원문(memos.json)도 쓴다. 다른 사람에게 보내지 않는다
  --events <파일>         결과를 보기 전에 적어 둔 사건 JSON 으로 평가 보고서를 만든다(숫자만)
  --participant <코드>    평가 보고서에 적을 참가 코드(예: P1)
  --quick                 평가 보고서에서 설정 비교·변화 넣어 보기를 건너뛴다

만드는 파일: daily.json, meta.json(판정 코어 입력), summary.json(채널별 건수·경고)`;

export function parseArgs(argv: string[]): CliOptions | string {
  const o: CliOptions = { inputs: [], out: '', judge: false, v6: false, memos: false, quick: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} 뒤에 값이 없습니다`);
      return v;
    };
    try {
      if (a === '-h' || a === '--help') return HELP;
      else if (a === '-o' || a === '--out') o.out = next();
      else if (a === '--kakao-me') o.kakaoMe = next();
      else if (a === '--judge') o.judge = true;
      else if (a === '--v6') { o.v6 = true; o.judge = true; }
      else if (a === '--memos') o.memos = true;
      else if (a === '--events') { o.events = next(); o.judge = true; }
      else if (a === '--participant') o.participant = next();
      else if (a === '--quick') o.quick = true;
      else if (a === '--pyodide') o.pyodideDir = next();
      else if (a === '--quiet') o.quiet = true;
      else if (a.startsWith('-')) return `알 수 없는 선택: ${a}\n\n${HELP}`;
      else o.inputs.push(a);
    } catch (e) {
      return (e as Error).message;
    }
  }
  if (!o.inputs.length) return `읽을 파일이나 폴더를 적어 주세요.\n\n${HELP}`;
  if (!o.out) return `-o 로 출력 폴더를 적어 주세요.\n\n${HELP}`;
  return o;
}

const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|\._[^/]*)$/i;

/** 파일은 그대로, 폴더는 안의 파일을 모두(숨김 파일 제외) 폴더 이름부터 시작하는 상대 경로로 모은다. */
export async function collectInputs(paths: string[]): Promise<ImportInput[]> {
  const out: ImportInput[] = [];
  const add = async (abs: string, rel: string) => {
    const blob = await fs.openAsBlob(abs); // 파일 내용을 한꺼번에 읽지 않는다
    out.push({ file: new File([blob], path.basename(abs)), path: rel.split(path.sep).join('/') });
  };
  for (const p of paths) {
    const abs = path.resolve(p);
    const st = fs.statSync(abs);
    if (st.isFile()) { await add(abs, path.basename(abs)); continue; }
    const root = path.dirname(abs);
    const walk = async (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, ent.name);
        const rel = path.relative(root, full);
        if (ent.name.startsWith('.') || SKIP.test(rel)) continue;
        if (ent.isDirectory()) await walk(full);
        else if (ent.isFile()) await add(full, rel);
      }
    };
    await walk(abs);
  }
  return out;
}

async function loadCore(dir: string) {
  const { loadPyodide } = await import('pyodide');
  const { PY_FILES } = await import('../judge/pyBundle');
  const { installCore } = await import('../judge/pyRunner');
  const py = await loadPyodide({ indexURL: dir.endsWith('/') ? dir : `${dir}/`, stdout: () => undefined, stderr: () => undefined });
  await py.loadPackage('numpy', { messageCallback: () => undefined });
  await installCore(py, PY_FILES);
  return py;
}

function defaultPyodideDir(): string {
  // 빌드한 파일(web/dist-cli/mined.mjs)과 소스(web/src/cli/mined.ts) 어디서 불러도 web/public/pyodide 를 찾는다
  const here = import.meta.dirname ?? process.cwd();
  for (const c of [path.resolve(here, '../public/pyodide'), path.resolve(here, '../../public/pyodide'), path.resolve('public/pyodide')]) {
    if (fs.existsSync(path.join(c, 'pyodide.asm.wasm'))) return c;
  }
  return path.resolve(here, '../public/pyodide');
}

const write = (dir: string, name: string, v: unknown) => fs.writeFileSync(path.join(dir, name), JSON.stringify(v, null, 1), 'utf8');

export async function main(argv: string[], log: (s: string) => void = (s) => process.stderr.write(`${s}\n`)): Promise<number> {
  const parsed = parseArgs(argv);
  if (typeof parsed === 'string') { log(parsed); return parsed === HELP ? 0 : 2; }
  const o = parsed;
  const say = o.quiet ? () => undefined : log;
  const inputs = await collectInputs(o.inputs);
  say(`파일 ${inputs.length}개를 읽습니다.`);
  let last = '';
  const t0 = Date.now();
  const imp = await runImport(inputs, { kakaoMe: o.kakaoMe }, (p: ImportProgress) => {
    const line = `  ${p.phase} ${p.filesDone}/${p.filesTotal}`;
    if (p.phase !== last || p.filesDone === p.filesTotal) { say(line); last = p.phase; }
  });
  if (!imp.daily.length) { log('읽을 수 있는 기록을 찾지 못했습니다. 내보내기 형식을 확인해 주세요.'); return 1; }
  fs.mkdirSync(o.out, { recursive: true });
  write(o.out, 'daily.json', imp.daily);
  write(o.out, 'meta.json', imp.meta);
  const memos = imp.memos.map((m) => ({ ...m, flags: toMemoFlags(scanMemo(m.text)) }));
  const channels = Object.fromEntries(Object.entries(imp.meta.channels).map(([k, v]) => [k, v && { first: v.first, last: v.last, records: v.records, sources: v.sources }]));
  write(o.out, 'summary.json', {
    days: imp.daily.length, memos: memos.length, photos: imp.photos.length, channels, files: imp.files,
    skipped: imp.skipped, warnings: imp.warnings, kakaoMe: imp.kakaoMe,
    kakaoParticipants: imp.kakaoParticipants.slice(0, 20),
    memo_flags: { secret: memos.filter((m) => m.flags.secret).length, crisis: memos.filter((m) => m.flags.crisis).length },
    seconds: Math.round((Date.now() - t0) / 100) / 10,
  });
  say(`일 단위 표 ${imp.daily.length}일, 채널 ${Object.keys(channels).join('·')} → ${o.out}/daily.json, meta.json`);
  for (const w of imp.warnings.slice(0, 10)) say(`  경고: ${w}`);
  if (o.memos) {
    write(o.out, 'memos.json', memos);
    say('memos.json 에는 메모 원문이 들어 있습니다. 다른 사람에게 보내지 마세요.');
  }
  if (!o.judge) return 0;

  const dir = o.pyodideDir ?? defaultPyodideDir();
  if (!fs.existsSync(path.join(dir, 'pyodide.asm.wasm'))) {
    log(`판정 런타임이 없습니다(${dir}). web 폴더에서 npm run assets 를 먼저 실행해 주세요.`);
    return 1;
  }
  say('판정 런타임을 불러옵니다.');
  const py = await loadCore(dir);
  const { runJudge, runFieldReport } = await import('../judge/pyRunner');
  const t1 = Date.now();
  const result = JSON.parse(runJudge(py, JSON.stringify(imp.daily), JSON.stringify(imp.meta))) as MinedResult;
  write(o.out, 'result.json', result);
  const s = result.summary as Record<string, number>;
  say(`판정: ${s.n_weeks}주 중 ${s.n_candidates}주 (${((Date.now() - t1) / 1000).toFixed(1)}초) → result.json`);

  if (o.v6) {
    const [{ toV6 }, { selectRelic }] = await Promise.all([import('../bridge/v6'), import('../relic/select')]);
    const byWeek = new Map<string, typeof memos>();
    for (const m of memos) byWeek.set(m.week, [...(byWeek.get(m.week) ?? []), m]);
    const v6 = toV6(result, (w) => {
      const all = byWeek.get(w.week) ?? [];
      const sel = selectRelic(w, all, []);
      return all.filter((m) => sel.memo_ids.includes(m.id) && !sel.gated_memo_ids.includes(m.id));
    });
    write(o.out, 'v6.json', v6);
    say(`팀 뷰어용 v6.json: 판정된 주 ${v6.weeks.length}개. 메모 원문이 들어 있으니 다른 사람에게 보내지 마세요.`);
  }

  if (o.events) {
    const { buildReport, participantOk, checkEvent, EMPTY_STATE } = await import('../eval/field');
    const raw = JSON.parse(fs.readFileSync(o.events, 'utf8'));
    const events = (Array.isArray(raw) ? raw : raw.events ?? []) as { start: string; end?: string; kind: 'hard' | 'good' | 'change' }[];
    const today = new Date().toISOString().slice(0, 10);
    const bad = events.map((e, i) => [i, checkEvent(e, today)] as const).filter(([, m]) => m);
    for (const [i, m] of bad) log(`  사건 ${i + 1}: ${m} (빼고 계산합니다)`);
    const ok = events.filter((e) => !checkEvent(e, today));
    const code = o.participant ?? 'cli';
    if (!participantOk(code)) { log('참가 코드는 영문·숫자 16자 이내로, 연도처럼 보이는 숫자 없이 적어 주세요.'); return 2; }
    const core = JSON.parse(runFieldReport(py, JSON.stringify(imp.daily), JSON.stringify(imp.meta), JSON.stringify(ok),
      JSON.stringify({ quick: o.quick }), (st) => say(`  ${st}`)));
    // 명령줄에서는 봉인 절차를 거치지 않았으므로 봉인 안 함으로 적는다
    const rep = buildReport({ ...core, via: 'cli' }, { ...EMPTY_STATE, participant: code });
    write(o.out, `mined_eval_${code}.json`, rep);
    say(`평가 보고서(숫자만) → mined_eval_${code}.json`);
  }
  return 0;
}

const isEntry = (() => {
  try { return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isEntry) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { process.stderr.write(`${e?.stack ?? e}\n`); process.exit(1); });
}
