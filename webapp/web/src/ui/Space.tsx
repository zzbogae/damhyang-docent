// 10/23 장면 플로우 ⑥ 나의 공간(P11~P12): 캔 광석이 3개 모이면 안개가 걷히고, 광석 셋으로 섬이나 방을 짓는다.
// 섬 생성 원칙(10/02): 민디는 사실을 펼치고, 결론은 사용자가 말한다. 단어 후보는 고른 광석의 날짜·지표·사용자가 붙인 이름에서만 나오고,
// 원문(글·사진)은 쓰지 않는다. 사용자가 고른 단어와 이름만 이 기기 브라우저에 저장한다(원칙 4: 꾸미지 않고 배치·이름·연결만).
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { dateLabel, josa } from '../mindi/templates';
import { oreMineral, pickedMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { customOreName, oreLabel } from './oreName';
import { MINERAL_IMG } from './design';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiMark } from './Icons';
import { sfx } from '../mindi/soundKit';
import { takeNewSpaceRequest } from './SpaceButton';
import { AXES, axisScreen, type Axis, type WeekRecord } from '../types';

export interface SpaceRow { id: string; name: string; kind: 'island' | 'room'; ores: string[]; words: string[]; at: string }
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

function Scene({ row, byKey }: { row: SpaceRow; byKey: Map<string, WeekRecord> }) {
  const ores = row.ores.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  return (
    <figure className={`space-scene ${row.kind}`} aria-label={`${row.name} · ${row.kind === 'island' ? '섬' : '방'}`}>
      <svg viewBox="0 0 600 300" aria-hidden="true" className="space-bg">
        {row.kind === 'island' ? (
          <>
            <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3c9a0" /><stop offset="1" stopColor="#7f6a8c" /></linearGradient></defs>
            <rect width="600" height="300" fill="url(#sky)" />
            <ellipse cx="300" cy="250" rx="250" ry="34" fill="#3e3550" opacity=".55" />
            <path d="M80,235 C150,180 450,180 520,235 C440,262 160,262 80,235 Z" fill="#5d4f6b" />
            <path d="M110,232 C190,196 410,196 490,232" fill="none" stroke="#8b7a92" strokeWidth="3" />
          </>
        ) : (
          <>
            <rect width="600" height="300" fill="#2d2533" />
            <path d="M0,210 L600,210 L600,300 L0,300 Z" fill="#3c3243" />
            <rect x="420" y="50" width="120" height="90" rx="6" fill="#f3c9a0" opacity=".35" />
          </>
        )}
      </svg>
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
      <div className="space-words">{row.words.map((t) => <span key={t} className="chip">{t}</span>)}</div>
      <figcaption className="space-name">{row.name}</figcaption>
    </figure>
  );
}

export function Space({ onField }: { onField: () => void }) {
  const { byKey, labels, memosByWeek, photosByWeek } = useStore();
  const collected = useCollected();
  const [spaces, setSpaces] = useState<SpaceRow[]>(loadSpaces);
  const [making, setMaking] = useState(() => takeNewSpaceRequest() || spaces.length === 0);
  const pool = useMemo(() => collected.map((c) => byKey.get(c.week)).filter(Boolean) as WeekRecord[], [collected, byKey]);
  const [chosen, setChosen] = useState<string[]>(() => pool.slice(-SPACE_NEED).map((w) => w.week));
  const [words, setWords] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const [kind, setKind] = useState<'island' | 'room'>('island');
  const [name, setName] = useState('');
  const labelsByWeek = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of labels) m.set(l.week, [...(m.get(l.week) ?? []), l.name]);
    return m;
  }, [labels]);

  if (collected.length < SPACE_NEED) {
    return (
      <section className="stack space-fog" aria-labelledby="space-title">
        <h2 id="space-title" className="h2">나의 공간</h2>
        <p>아직 안개가 짙습니다. 광석이 {SPACE_NEED}개 모이면 안개가 걷힙니다. 지금 {collected.length}개를 캤습니다.</p>
        <p className="small muted">데이터가 표시한 광석과 직접 고른 광석을 함께 셉니다.</p>
        <button className="btn primary" onClick={onField}>지층으로 내려가기</button>
      </section>
    );
  }

  const chosenWs = chosen.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  const facts = chosenWs.length === SPACE_NEED
    ? spreadFacts(chosenWs, (w) => ({ memos: memosByWeek.get(w.week)?.length ?? 0, photos: photosByWeek.get(w.week)?.length ?? 0 }))
    : [];
  const choices = wordChoices(chosenWs, labelsByWeek);
  const toggleOre = (k: string) => setChosen((c) => c.includes(k) ? c.filter((x) => x !== k) : c.length < SPACE_NEED ? [...c, k] : c);
  const toggleWord = (t: string) => setWords((ws) => ws.includes(t) ? ws.filter((x) => x !== t) : ws.length < 3 ? [...ws, t] : ws);
  const ready = chosenWs.length === SPACE_NEED && name.trim().length > 0;

  return (
    <section className="stack" aria-labelledby="space-title">
      <h2 id="space-title" className="h2">나의 공간</h2>
      {spaces.length > 0 && !making && (
        <>
          {spaces.map((r) => <Scene key={r.id} row={r} byKey={byKey} />)}
          <div className="label-row">
            <button className="btn" onClick={() => setMaking(true)}>새 공간 짓기</button>
          </div>
        </>
      )}
      {making && (
        <div className="stack space-make">
          <p>안개가 걷혔습니다. 캔 광석 가운데 {SPACE_NEED}개를 고르세요.</p>
          <ul className="space-pool" aria-label="광석 고르기">
            {pool.map((w) => {
              const m = oreMineral(w) as Mineral | null;
              const on = chosen.includes(w.week);
              return (
                <li key={w.week}>
                  <button className={`space-pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleOre(w.week)}>
                    {m && <img src={MINERAL_IMG[m]} alt="" />}
                    <span>{m ? oreLabel({ ...w, mineral: m }) : dateLabel(w.date_start)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {facts.length > 0 && (
            <div className="bubble" role="status"><MindiMark size={36} /><div className="stack">{facts.map((f) => <p key={f}>{f}</p>)}</div></div>
          )}
          {chosenWs.length === SPACE_NEED && (
            <>
              <h3 className="h3">곁에 둘 단어 (세 개까지)</h3>
              <div className="label-row" role="group" aria-label="단어 고르기">
                {choices.map((t) => <button key={t} className="chip" aria-pressed={words.includes(t)} onClick={() => toggleWord(t)}>{t}</button>)}
                {words.filter((t) => !choices.includes(t)).map((t) => <button key={t} className="chip" aria-pressed onClick={() => toggleWord(t)}>{t}</button>)}
              </div>
              <form className="label-row" onSubmit={(e) => { e.preventDefault(); const t = own.trim().slice(0, 12); if (t) { toggleWord(t); setOwn(''); } }}>
                <input className="input" value={own} maxLength={12} onChange={(e) => setOwn(e.target.value)} placeholder="직접 적기" aria-label="단어 직접 적기" />
                <button className="btn" type="submit" disabled={!own.trim()}>더하기</button>
              </form>
              <h3 className="h3">어떤 곳으로 지을까요</h3>
              <div className="label-row" role="radiogroup" aria-label="공간 종류">
                <button role="radio" aria-checked={kind === 'island'} className={`btn${kind === 'island' ? ' primary' : ''}`} onClick={() => setKind('island')}>섬</button>
                <button role="radio" aria-checked={kind === 'room'} className={`btn${kind === 'room' ? ' primary' : ''}`} onClick={() => setKind('room')}>방</button>
              </div>
              <form className="label-row" onSubmit={(e) => {
                e.preventDefault();
                if (!ready) return;
                const row: SpaceRow = { id: `${Date.now()}`, name: name.trim().slice(0, 20), kind, ores: chosen, words, at: new Date().toISOString() };
                const next = [...spaces, row];
                saveSpaces(next); setSpaces(next); setMaking(false); setName(''); setWords([]); sfx('spaceOpen');
              }}>
                <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="이 공간의 이름" aria-label="공간 이름" />
                <button className="btn primary" type="submit" disabled={!ready}>이름 붙이고 짓기</button>
              </form>
              {name.trim() && <Scene row={{ id: 'preview', name: name.trim(), kind, ores: chosen, words, at: '' }} byKey={byKey} />}
            </>
          )}
          {spaces.length > 0 && <button className="btn quiet" onClick={() => setMaking(false)}>지은 공간 보기</button>}
        </div>
      )}
    </section>
  );
}
