// 10/23 장면 플로우 ⑥ 나의 공간(P11~P12): 캔 광석이 3개 모이면 안개가 걷히고, 광석 셋으로 섬이나 방을 짓는다.
// 섬 생성 원칙(10/02): 민디는 사실을 펼치고, 결론은 사용자가 말한다. 단어 후보는 고른 광석의 날짜·지표·사용자가 붙인 이름에서만 나오고,
// 원문(글·사진)은 쓰지 않는다. 사용자가 고른 단어와 이름만 이 기기 브라우저에 저장한다(원칙 4: 꾸미지 않고 배치·이름·연결만).
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { dateLabel, josa } from '../mindi/templates';
import { oreMineral, pickedMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { customOreName, oreLabel } from './oreName';
import { ISLAND_ART, MINERAL_IMG } from './design';
import { artFor, IslandMake, optsLine, type IslandOpts } from './IslandMake';
import { IslandVisit } from './IslandVisit';
import { IslandPick } from './IslandPick';
import { clipOf, type ClipKey } from './islandClips';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiMark } from './Icons';
import { sfx } from '../mindi/soundKit';
import { clearChatIsland, peekChatIsland } from '../mindi/lifebot';
import { takeNewSpaceRequest, takeVisitRequest } from './SpaceButton';
import { AXES, axisScreen, type Axis, type WeekRecord } from '../types';

export interface SpaceRow { id: string; name: string; kind: 'island' | 'room'; ores: string[]; words: string[]; at: string; /** v2: 민디와 고른 여섯 가지 */ opts?: IslandOpts; /** v2: 넷 가운데 고른 섬 영상 */ clip?: ClipKey }
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
  lang: { up: '글을 많이 쓴', down: '글을 덜 쓴' }, talk: { up: '많이 주고받은', down: '조용했던' },
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

function Scene({ row, byKey, onVisit }: { row: SpaceRow; byKey: Map<string, WeekRecord>; onVisit?: () => void }) {
  const ores = row.ores.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  if (row.opts) {
    const art = ISLAND_ART[artFor(row.opts.place)];
    const clip = clipOf(row.clip);
    return (
      <figure className="space-scene island v2" aria-label={`${row.name} · 섬`}>
        {clip ? <video className="space-bg" src={clip.src} poster={clip.poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" /> : <img className="space-bg" src={art.reveal} alt="" />}
        <div className="space-words">{row.words.map((t) => <span key={t} className="chip">{t}</span>)}</div>
        <figcaption><span className="space-name">{row.name}</span><small>{optsLine(row.opts)}</small></figcaption>
        {onVisit && <button className="btn primary space-go" onClick={onVisit}>섬으로 가기</button>}
      </figure>
    );
  }
  return (
    <figure className={`space-scene ${row.kind}`} aria-label={`${row.name} · ${row.kind === 'island' ? '섬' : '방'}`}>
      {onVisit && <button className="btn primary space-go" onClick={onVisit}>섬으로 가기</button>}
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
  const [talking, setTalking] = useState(false);
  const [built, setBuilt] = useState<SpaceRow | null>(null);
  const [building, setBuilding] = useState(false);
  const [visit, setVisit] = useState<SpaceRow | null>(() => (takeVisitRequest() ? spaces[spaces.length - 1] ?? null : null));
  useEffect(() => { if (!building) return; const t = setTimeout(() => { setBuilding(false); sfx('spaceOpen'); }, 2600); return () => clearTimeout(t); }, [building]);
  const labelsByWeek = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of labels) m.set(l.week, [...(m.get(l.week) ?? []), l.name]);
    return m;
  }, [labels]);

  // 11/10 보별: 민디와 이야기에서 「이 대화로 섬 만들기」로 받은 단어가 있으면, 광석 수와 상관없이 그 단어로 바로 섬을 짓는다.
  // 광석이 3개 이상이면 마지막 세 개를 곁에 두고, 모자라면 광석 없이 단어만으로 짓는다.
  const chatIsland = peekChatIsland();
  const viaChat = !!chatIsland && chatIsland.keywords.length > 0;
  // 방금 지은 섬(built)이나 지난 섬이 있으면 안개 화면이 가리지 않는다 — 대화로 지은 섬은 광석 없이도 남는다
  if (collected.length < SPACE_NEED && !viaChat && !built) {
    return (
      <section className="stack space-page space-fog" aria-labelledby="space-title">
        <h2 id="space-title" className="h2">나의 공간</h2>
        {visit && <IslandVisit row={visit} byKey={byKey} onExit={() => setVisit(null)} />}
        {spaces.map((r) => <Scene key={r.id} row={r} byKey={byKey} onVisit={() => setVisit(r)} />)}
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
  // 추천 단어: 고른 세 광석의 단어 후보를, 캔 광석 전체에서 많이 나온 순으로(같으면 원래 순서)
  const choices = (() => {
    const base = wordChoices(chosenWs, labelsByWeek);
    const freq = new Map<string, number>();
    for (const w of pool) for (const t of wordChoices([w], labelsByWeek)) freq.set(t, (freq.get(t) ?? 0) + 1);
    // 「2월」처럼 달 이름만 있는 단어는 뒤로 미룬다(단어가 모자랄 때만 쓴다)
    const dateOnly = (t: string) => /^\d{1,2}월$|^\d{4}년?$/.test(t);
    const sorted = base.map((t, i) => ({ t, i, n: freq.get(t) ?? 0 })).sort((a, b) => Number(dateOnly(a.t)) - Number(dateOnly(b.t)) || b.n - a.n || a.i - b.i).map((x) => x.t);
    // 11/10: 민디와 이야기에서 「이 대화로 섬 만들기」로 받은 단어가 있으면 앞에 둔다(챗봇 연결 시에만 생긴다)
    const fromChat = chatIsland?.keywords ?? [];
    return [...fromChat, ...sorted.filter((t) => !fromChat.includes(t))];
  })();
  const chatWords = chatIsland?.keywords.length ?? 0;
  // 대화에서 온 단어로 짓는 길: 광석 고르기를 건너뛰고 바로 민디와 섬 만들기
  const chatMake = viaChat && (making || !built);
  const chatOres = chosenWs.length === SPACE_NEED ? chosen : [];
  const toggleOre = (k: string) => { setTalking(false); setChosen((c) => c.includes(k) ? c.filter((x) => x !== k) : c.length < SPACE_NEED ? [...c, k] : c); };
  const today = new Date();
  const defaultName = `${today.getMonth() + 1}월 ${today.getDate()}일의 섬`;
  const build = (opts: IslandOpts, words: string[], name: string) => {
    const row: SpaceRow = { id: `${Date.now()}`, name, kind: 'island', ores: viaChat ? chatOres : chosen, words, at: new Date().toISOString(), opts };
    const next = [...spaces, row];
    saveSpaces(next); setSpaces(next); setBuilt(row); setBuilding(true); setTalking(false);
    clearChatIsland();
  };

  return (
    <section className="stack space-page" aria-labelledby="space-title">
      <h2 id="space-title" className="h2">나의 공간</h2>
      {visit && <IslandVisit row={visit} byKey={byKey} onExit={() => setVisit(null)} />}
      {built && (
        <div className="stack isl-built" role="status">
          {building ? (
            <div className="isl-msg mindi building"><MindiMark size={36} mood="thinking" /><p>안개 속에 섬을 놓을 자리를 찾고 있어요…</p></div>
          ) : (
            <>
              {built.opts && !built.clip ? (
                <IslandPick opts={built.opts} onGo={(k) => {
                  const row = { ...built, clip: k };
                  const next = spaces.map((r) => r.id === row.id ? row : r);
                  saveSpaces(next); setSpaces(next); setBuilt(row); setVisit(row);
                }} />
              ) : (
                <>
                  <div className="isl-msg mindi"><MindiMark size={36} mood="found" /><p>섬이 준비됐어요. 안개 너머에 있어요.</p></div>
                  <Scene row={built} byKey={byKey} onVisit={() => setVisit(built)} />
                </>
              )}
              <div className="label-row">
                <button className="btn quiet" onClick={() => { setBuilt(null); setMaking(false); }}>지은 공간 모두 보기</button>
              </div>
            </>
          )}
        </div>
      )}
      {!built && chatMake && (
        <div className="stack space-make">
          <p>이야기에서 받은 단어로 섬을 짓습니다.{chatOres.length === SPACE_NEED ? ' 마지막에 캔 광석 셋을 곁에 둘게요.' : ''}</p>
          <IslandMake key={`chat-${chatIsland!.at}`} suggestions={choices} fromChat={chatWords} defaultName={defaultName} onDone={build} />
          <button className="btn quiet" onClick={() => { clearChatIsland(); setMaking(false); }}>단어 두고 나가기</button>
        </div>
      )}
      {!built && !chatMake && spaces.length > 0 && !making && (
        <>
          {spaces.map((r) => <Scene key={r.id} row={r} byKey={byKey} onVisit={() => setVisit(r)} />)}
          <div className="label-row">
            <button className="btn" onClick={() => { setMaking(true); setTalking(false); }}>민디와 새 섬 만들기</button>
          </div>
        </>
      )}
      {!built && !chatMake && making && (
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
            <div className="bubble" role="status"><MindiMark size={36} /><div className="stack">{facts.slice(0, -1).map((f) => <p key={f}>{f}</p>)}</div></div>
          )}
          {chosenWs.length === SPACE_NEED && !talking && (
            <div><button className="btn primary" onClick={() => { sfx('confirm'); setTalking(true); }}>민디와 섬 만들기 시작</button></div>
          )}
          {chosenWs.length === SPACE_NEED && talking && (
            <IslandMake key={chosen.join()} suggestions={choices} fromChat={chatWords} defaultName={defaultName} onDone={build} />
          )}
          {spaces.length > 0 && <button className="btn quiet" onClick={() => setMaking(false)}>지은 공간 보기</button>}
        </div>
      )}
    </section>
  );
}
