// 10/23 장면 플로우 ⑥ 나의 공간(P11~P12): 캔 광석이 3개 모이면 안개가 걷히고, 광석 셋으로 섬이나 방을 짓는다.
// 섬 생성 원칙(10/02): 민디는 사실을 펼치고, 결론은 사용자가 말한다. 단어 후보는 고른 광석의 날짜·지표·사용자가 붙인 이름에서만 나오고,
// 원문(글·사진)은 쓰지 않는다. 사용자가 고른 단어와 이름만 이 기기 브라우저에 저장한다(원칙 4: 꾸미지 않고 배치·이름·연결만).
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { dateLabel, josa } from '../mindi/templates';
import { oreMineral, pickedMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { customOreName, oreLabel } from './oreName';
import { ENV, MINERAL_IMG, type EnvId } from './design';
import './space.css';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiMark } from './Icons';
import { kitEnv, sfx } from '../mindi/soundKit';
import { takeNewSpaceRequest } from './SpaceButton';
import { AXES, axisScreen, type Axis, type WeekRecord } from '../types';

export interface SpaceRow { id: string; name: string; kind: 'island' | 'room'; ores: string[]; words: string[]; at: string; env?: EnvId }
/** 옛 데이터(env 없음) 호환: 섬은 바다, 방은 작은 방 */
export const envOf = (r: Pick<SpaceRow, 'kind' | 'env'>): EnvId => r.env ?? (r.kind === 'room' ? 'room' : 'sea');
const envDef = (id: EnvId) => ENV.find((e) => e.id === id) ?? ENV[0];
const KEY = 'mined.spaces.v1';

export function loadSpaces(): SpaceRow[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SpaceRow[]; } catch { return []; }
}
function saveSpaces(rows: SpaceRow[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* 사생활 보호 창: 이번 화면에서만 */ }
}

const SEASON = (m: number) => (m <= 2 || m === 12 ? '겨울' : m <= 5 ? '봄' : m <= 8 ? '여름' : '가을');
const AXIS_WORD: Record<Axis, { up: string; down: string }> = {
  move: { up: '많이 걸은', down: '덜 걸은' }, rest: { up: '오래 잔', down: '덜 잔' },
  lang: { up: '많이 적은', down: '덜 적은' }, talk: { up: '많이 주고받은', down: '조용했던' },
};

/** 광석 하나에서 나오는 사실: 날짜, 계절, 가장 크게 움직인 지표와 방향(데이터 광석은 배지, 고른 광석은 축 대표값) */
export function oreFacts(w: WeekRecord): { month: number; year: number; season: string; moves: { axis: Axis; dir: 'up' | 'down' }[] } {
  const [year, month] = w.date_start.split('-').map(Number);
  let moves: { axis: Axis; dir: 'up' | 'down' }[];
  if (w.candidate && w.badges.length) {
    const seen = new Set<Axis>();
    moves = w.badges.filter((b) => AXES.includes(b.axis) && !seen.has(b.axis) && seen.add(b.axis)).map((b) => ({ axis: b.axis, dir: b.direction }));
  } else {
    const p = pickedMineral(w);
    moves = p ? [{ axis: p.axis, dir: p.dir }] : [];
  }
  return { month, year, season: SEASON(month), moves };
}

/** 단어 후보: 고른 광석들의 계절·달·지표 움직임·사용자가 붙인 광석 이름. 중복 없이, 같은 광석이면 언제나 같은 순서 */
export function wordChoices(ws: WeekRecord[], labelsByWeek: Map<string, string[]>): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => { if (s && !out.includes(s)) out.push(s); };
  for (const w of ws) {
    const f = oreFacts(w);
    add(customOreName(w.week));
    for (const l of labelsByWeek.get(w.week) ?? []) add(l);
    add(f.season);
    add(`${f.month}월`);
    for (const m of f.moves) add(AXIS_WORD[m.axis][m.dir]);
  }
  return out;
}

/** 민디가 펼치는 사실(결론 없이). 마지막은 질문으로 넘긴다 */
export function spreadFacts(ws: WeekRecord[], counts: (w: WeekRecord) => { memos: number; photos: number }): string[] {
  const lines = ws.map((w) => {
    const f = oreFacts(w);
    const c = counts(w);
    // 「걸음이 평소보다 적었고, 수면이 평소보다 많았습니다」처럼 한 문장으로 잇는다
    const mv = f.moves.length
      ? `${f.moves.map((m) => `${josa(axisScreen(m.axis), '이', '가')} 평소보다 ${m.dir === 'up' ? '많았' : '적었'}`).join('고, ')}습니다`
      : '견줄 지표 기록이 없었습니다';
    return `${dateLabel(w.date_start)}부터의 한 주는 ${mv}. 그때 남은 글 ${c.memos}개, 사진 ${c.photos}장이 있습니다.`;
  });
  const axes = new Map<string, number>();
  for (const w of ws) for (const m of oreFacts(w).moves) axes.set(`${m.axis}:${m.dir}`, (axes.get(`${m.axis}:${m.dir}`) ?? 0) + 1);
  const shared = [...axes.entries()].filter(([, n]) => n >= 2);
  if (shared.length) {
    const [k, n] = shared[0];
    const [ax, dir] = k.split(':') as [Axis, 'up' | 'down'];
    lines.push(`세 광석 가운데 ${n}개는 ${josa(axisScreen(ax), '이', '가')} 평소보다 ${dir === 'up' ? '많았던' : '적었던'} 주입니다.`);
  }
  lines.push('이 광석들 곁에 어떤 단어를 두고 싶으세요? 이름은 당신이 정합니다.');
  return lines;
}

function Scene({ row, byKey, big = false }: { row: SpaceRow; byKey: Map<string, WeekRecord>; big?: boolean }) {
  const ores = row.ores.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  const env = envDef(envOf(row));
  return (
    <figure className={`space-scene${big ? ' big' : ''}`} aria-label={`${row.name} · ${env.name}`}>
      <img className="space-bg" src={env.src} alt="" />
      <div className="space-ores">
        {ores.map((w, i) => {
          const m = oreMineral(w) as Mineral | null;
          return (
            <div key={w.week} className="space-ore" style={{ left: `${25 + i * 25}%` }}>
              {m && <img src={MINERAL_IMG[m]} alt="" style={{ filter: `drop-shadow(0 0 12px ${MINERAL_HEX[m]})` }} />}
              <span className="space-pedestal" />
              <small>{m ? oreLabel({ ...w, mineral: m }) : dateLabel(w.date_start)}</small>
            </div>
          );
        })}
      </div>
      {row.words.length > 0 && <div className="space-words">{row.words.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
      {row.name && <figcaption className="space-name">{row.name}</figcaption>}
    </figure>
  );
}

const STEPS = ['환경', '단어', '미리보기', '이름', '열기'] as const;
const NUM = ['①', '②', '③', '④', '⑤'];

export function Space({ onField }: { onField: () => void }) {
  const { byKey, labels, memosByWeek, photosByWeek } = useStore();
  const collected = useCollected();
  const [spaces, setSpaces] = useState<SpaceRow[]>(loadSpaces);
  const [making, setMaking] = useState(() => takeNewSpaceRequest() || spaces.length === 0);
  const [viewing, setViewing] = useState(() => Math.max(0, spaces.length - 1));
  const pool = useMemo(() => collected.map((c) => byKey.get(c.week)).filter(Boolean) as WeekRecord[], [collected, byKey]);
  const [chosen, setChosen] = useState<string[]>(() => pool.slice(-SPACE_NEED).map((w) => w.week));
  const [words, setWords] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const [writing, setWriting] = useState(false);
  const [shift, setShift] = useState(0);
  const [env, setEnv] = useState<EnvId>('sea');
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);
  const [lifting, setLifting] = useState(false);
  const labelsByWeek = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of labels) m.set(l.week, [...(m.get(l.week) ?? []), l.name]);
    return m;
  }, [labels]);
  const shown = spaces[Math.min(viewing, spaces.length - 1)];
  useEffect(() => { kitEnv(making ? env : shown ? envOf(shown) : 'sea'); }, [making, env, shown]);

  if (collected.length < SPACE_NEED) {
    const n = collected.length;
    return (
      <section className="space-lock" aria-labelledby="space-title">
        <div className="space-lock-card">
          <span className="space-lock-icon" aria-hidden="true">🔒</span>
          <h2 id="space-title">나의 공간</h2>
          <p>광석이 {SPACE_NEED}개 모이면 안개가 걷힙니다.</p>
          <div className="space-lock-bar" role="progressbar" aria-valuemin={0} aria-valuemax={SPACE_NEED} aria-valuenow={n} aria-label={`광석 ${n}/${SPACE_NEED}`}>
            <i style={{ width: `${(n / SPACE_NEED) * 100}%` }} />
          </div>
          <p className="space-lock-count">광석 {n}/{SPACE_NEED}</p>
          <p className="small muted">데이터가 표시한 광석과 직접 고른 광석을 함께 셉니다.</p>
          <button className="btn primary" onClick={() => { sfx('tap'); onField(); }}>내려가기</button>
        </div>
      </section>
    );
  }

  const chosenWs = chosen.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  const facts = chosenWs.length === SPACE_NEED
    ? spreadFacts(chosenWs, (w) => ({ memos: memosByWeek.get(w.week)?.length ?? 0, photos: photosByWeek.get(w.week)?.length ?? 0 }))
    : [];
  const all = wordChoices(chosenWs, labelsByWeek);
  const win = Math.min(6, all.length);
  const choices = all.length ? Array.from({ length: win }, (_, i) => all[(i + shift) % all.length]) : [];
  const toggleOre = (k: string) => setChosen((c) => c.includes(k) ? c.filter((x) => x !== k) : c.length < SPACE_NEED ? [...c, k] : c);
  const toggleWord = (t: string) => { sfx('tap'); setWords((ws) => ws.includes(t) ? ws.filter((x) => x !== t) : ws.length < 3 ? [...ws, t] : ws); };
  const can = [true, chosenWs.length === SPACE_NEED, true, name.trim().length > 0, true];
  const go = (i: number) => { if (i < 0 || i >= STEPS.length) return; sfx('tap'); setStep(i); };
  const kind: SpaceRow['kind'] = env === 'room' ? 'room' : 'island';
  const draft: SpaceRow = { id: 'preview', name: step >= 3 ? name.trim() : '', kind, env, ores: step >= 2 ? chosen : [], words: step >= 1 ? words : [], at: '' };
  const open = () => {
    if (!can[1] || !can[3]) return;
    setLifting(true);
    sfx('fogClear');
    setTimeout(() => {
      sfx('spaceOpen');
      const row: SpaceRow = { id: `${Date.now()}`, name: name.trim().slice(0, 20), kind, env, ores: chosen, words, at: new Date().toISOString() };
      const next = [...spaces, row];
      saveSpaces(next); setSpaces(next); setViewing(next.length - 1);
      setMaking(false); setLifting(false); setName(''); setWords([]); setStep(0);
    }, 1400);
  };

  if (!making && shown) {
    // P12 나의 공간: 1인칭 조작은 팀도 잠정이라 내려다보기 장면만. 나가기는 공통 ‹
    return (
      <section className="space-view" aria-labelledby="space-title">
        <h2 id="space-title" className="sr-only">나의 공간 · {shown.name}</h2>
        <div className="space-view-mode" aria-label="보기 방식"><span className="on">내려다보기</span></div>
        <Scene row={shown} byKey={byKey} big />
        <div className="space-view-foot">
          {spaces.length > 1 && (
            <div className="label-row" role="group" aria-label="지은 공간">
              {spaces.map((r, i) => (
                <button key={r.id} className={`chip${i === viewing ? ' on' : ''}`} aria-pressed={i === viewing} onClick={() => { sfx('tap'); setViewing(i); }}>{r.name}</button>
              ))}
            </div>
          )}
          <button className="btn" onClick={() => { sfx('tap'); setStep(0); setMaking(true); }}>새 공간 짓기</button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-make" aria-labelledby="space-title">
      <h2 id="space-title" className="sr-only">나의 공간 만들기</h2>
      <div className={`space-preview${lifting ? ' lifting' : ''}`}>
        <Scene row={draft} byKey={byKey} big />
        <span className="space-preview-tag">미리보기 · {envDef(env).name}</span>
        <div className="space-fog" aria-hidden="true" />
      </div>
      <div className="space-panel">
        <ol className="space-steps" aria-label="단계">
          {STEPS.map((t, i) => (
            <li key={t}>
              <button className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}
                disabled={i > step} onClick={() => go(i)}>{NUM[i]} {t}</button>
            </li>
          ))}
        </ol>
        <div className="space-body">
          {step === 0 && (
            <>
              <p className="space-q">{NUM[0]} 환경 고르기</p>
              <div className="space-envs" role="radiogroup" aria-label="환경">
                {ENV.map((e) => (
                  <button key={e.id} role="radio" aria-checked={env === e.id} className={`space-env${env === e.id ? ' on' : ''}`}
                    onClick={() => { sfx('tap'); setEnv(e.id); kitEnv(e.id); }}>
                    <img src={e.src} alt="" /><span>{e.name}</span>
                  </button>
                ))}
              </div>
              <p className="small muted">섬과 방은 같은 「나의 공간」입니다. 규모만 다릅니다.</p>
            </>
          )}
          {step === 1 && (
            <>
              <p className="space-q">캔 광석 가운데 {SPACE_NEED}개 고르기</p>
              <ul className="space-pool" aria-label="광석 고르기">
                {pool.map((w) => {
                  const m = oreMineral(w) as Mineral | null;
                  const on = chosen.includes(w.week);
                  return (
                    <li key={w.week}>
                      <button className={`space-pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { sfx('tap'); toggleOre(w.week); }}>
                        {m && <img src={MINERAL_IMG[m]} alt="" />}
                        <span>{m ? oreLabel({ ...w, mineral: m }) : dateLabel(w.date_start)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {facts.length > 0 && (
                <div className="bubble space-bubble" role="status"><MindiMark size={32} /><div className="stack">{facts.map((f) => <p key={f}>{f}</p>)}</div></div>
              )}
              {chosenWs.length === SPACE_NEED && (
                <>
                  <p className="space-q">{NUM[1]} 곁에 둘 단어 (세 개까지)</p>
                  <div className="space-words-pick" role="group" aria-label="단어 고르기">
                    {choices.map((t) => <button key={t} className="space-word" aria-pressed={words.includes(t)} onClick={() => toggleWord(t)}>{t}</button>)}
                    {words.filter((t) => !choices.includes(t)).map((t) => <button key={t} className="space-word" aria-pressed onClick={() => toggleWord(t)}>{t}</button>)}
                  </div>
                  <div className="space-word-tools">
                    <button className="space-word" disabled={all.length <= win} onClick={() => { sfx('shuffle'); setShift((x) => (x + 3) % Math.max(1, all.length)); }}>다른 단어 보기 ↻</button>
                    <button className="space-word" aria-expanded={writing} onClick={() => { sfx('tap'); setWriting((x) => !x); }}>직접 쓰기</button>
                  </div>
                  {writing && (
                    <form className="label-row" onSubmit={(e) => { e.preventDefault(); const t = own.trim().slice(0, 12); if (t) { toggleWord(t); setOwn(''); } }}>
                      <input className="input" value={own} maxLength={12} autoFocus onChange={(e) => setOwn(e.target.value)} placeholder="직접 적기" aria-label="단어 직접 적기" />
                      <button className="btn" type="submit" disabled={!own.trim()}>더하기</button>
                    </form>
                  )}
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <p className="space-q">{NUM[2]} 미리보기</p>
              <p>왼쪽 그림처럼 {envDef(env).name}에 광석 {chosenWs.length}개{words.length ? `와 단어 ${words.map((t) => `「${t}」`).join(' ')}` : ''}를 둡니다.</p>
              <p className="small muted">고친 것이 있으면 위 단계 이름을 눌러 돌아갈 수 있습니다.</p>
            </>
          )}
          {step === 3 && (
            <>
              <p className="space-q">{NUM[3]} 이름 붙이기</p>
              <input className="input" value={name} maxLength={20} autoFocus onChange={(e) => setName(e.target.value)} placeholder="이 공간의 이름" aria-label="공간 이름"
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) go(4); }} />
              <p className="small muted">이름은 당신이 정합니다. 이 기기 브라우저에만 저장됩니다.</p>
            </>
          )}
          {step === 4 && (
            <>
              <p className="space-q">{NUM[4]} 열기</p>
              <p>「{name.trim()}」의 안개를 걷습니다.</p>
              <button className="btn primary" onClick={open} disabled={lifting || !can[1] || !can[3]}>안개 걷고 열기</button>
            </>
          )}
        </div>
        <div className="space-nav">
          <button className="btn" onClick={() => (step === 0 ? (spaces.length ? (sfx('back'), setMaking(false)) : undefined) : go(step - 1))} disabled={step === 0 && !spaces.length}>이전</button>
          {step < STEPS.length - 1 && <button className="btn primary" onClick={() => go(step + 1)} disabled={!can[step]}>다음</button>}
        </div>
      </div>
    </section>
  );
}
