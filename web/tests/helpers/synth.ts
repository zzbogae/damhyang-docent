// 테스트용: synth/out/<persona> 가 없으면 생성기를 돌리고, 원천 파일을 ImportInput 으로 읽는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ImportInput } from '../../src/import/sources';

export const ROOT = path.resolve(__dirname, '../../..');
export const SYNTH_OUT = path.join(ROOT, 'synth/out');
const PY = path.join(ROOT, 'core/.venv/bin/python');

export function ensureSynth(persona: string) {
  if (fs.existsSync(path.join(SYNTH_OUT, persona, 'truth_daily.json'))) return;
  execFileSync(PY, [path.join(ROOT, 'synth/make_persona.py'), persona], { stdio: 'inherit' });
}

function walk(dir: string, base: string, out: string[]) {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p));
  }
}

const MIME: Record<string, string> = { zip: 'application/zip', txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

/** exports 폴더 전체를 사용자가 고른 파일처럼 만든다. 경로는 exports 기준 상대 경로(폴더 선택의 webkitRelativePath 와 같은 모양). */
export function exportInputs(persona: string): ImportInput[] {
  const base = path.join(SYNTH_OUT, persona, 'exports');
  const rels: string[] = [];
  walk(base, base, rels);
  return rels.map((rel) => {
    const buf = fs.readFileSync(path.join(base, rel));
    const name = path.basename(rel);
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    return { file: new File([buf], name, { type: MIME[ext] ?? '' }), path: rel.normalize('NFC') };
  });
}

export function readJson<T = any>(persona: string, file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SYNTH_OUT, persona, file), 'utf8'));
}
