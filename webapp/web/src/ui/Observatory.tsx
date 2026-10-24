// 관측소 허브(P3)와 곁가지 화면: 오늘 보기(P4) · 민디와 이야기(P9) · 캔 광석 보관함(P10).
// 자리는 팀 10/23 버튼배치 확정 시안(P03·P04·P09·P10)과 화면설계 v6 §6 을 따른다.
// 원칙 3: 앱이 고른 것으로 먼저 말 걸지 않는다. 오늘의 한 마디는 판정이 아니라 지층에 대한 사실 한 줄이고, 닮은 주는 사용자가 「비슷한 주 찾기」를 눌렀을 때만 찾는다.
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { dateLabel, rangeLabel } from '../mindi/templates';
import { oreMineral, pickedMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { customOreName } from './oreName';
import { ART, MINERAL_IMG } from './design';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiGreeting } from './Mindi';
import { MindiAsk } from './MindiAsk';
import { MindiMark } from './Icons';
import { applyVoice, useVoice } from '../mindi/voices';
import { VoiceChip } from './VoiceChip';
import { requestNewSpace, SpaceButton } from './SpaceButton';
import { GYEOL_TEXT } from './Gyeol';
import { LABEL } from './format';
import { kitScene, sfx } from '../mindi/soundKit';
import { axisScreen, type Axis, type WeekRecord } from '../types';
import './hub.css';

export type HubGo = 'elevator' | 'today' | 'talk' | 'archive' | 'space';

/** 기록이 남은 가장 최근 주(관측된 계열이 하나라도 있는 주) */
export function latestObserved(weeks: WeekRecord[]): WeekRecord | undefined {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (Object.values(weeks[i].coverage).some((c) => c === 'observed')) return weeks[i];
  }
  return weeks[weeks.length - 1];
}

/** 오늘의 한 마디: 날짜마다 돌아가는 사실 문장. 같은 날 같은 기록이면 같은 문장이다 */
export function todayLine(weeks: WeekRecord[], collected: number, today = new Date()): string {
  if (!weeks.length) return '아직 내려갈 지층이 없습니다.';
  const first = Number(weeks[0].week.slice(0, 4));
  const last = Number(weeks[weeks.length - 1].week.slice(0, 4));
  const ores = weeks.filter((w) => w.candidate).length;
  const latest = latestObserved(weeks);
  const lines = [
    `지층은 ${first}년부터 ${last}년까지, ${last - first + 1}해 깊이입니다.`,
    `지금까지 캔 광석은 ${collected}개입니다.`,
    latest ? `기록이 남은 가장 최근 주는 ${dateLabel(latest.date_start)}부터의 한 주입니다.` : `지층에 남은 주는 ${weeks.length}주입니다.`,
    `기록이 평소 범위를 크게 벗어나 광석으로 박힌 주는 ${ores}주입니다.`,
  ];
  const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
  return lines[day % lines.length];
}

/** 「2024년 4월 2주」 */
export function monthWeekLabel(w: Pick<WeekRecord, 'date_start'>, withYear = true): string {
  const [y, m, d] = w.date_start.split('-').map(Number);
  return `${withYear ? `${y}년 ` : ''}${m}월 ${Math.ceil(d / 7)}주`;
}

// 게이지·요약에 쓰는 지표 순서(시안: 수면·걸음·언어·소통)
const GAUGE_AXES: Axis[] = ['rest', 'move', 'lang', 'talk'];
function axisWord(pr: number) {
  return pr <= 0.1 ? '평소보다 적음' : pr >= 0.9 ? '평소보다 많음' : pr < 0.25 ? '조금 적음' : pr > 0.75 ? '조금 많음' : '평소';
}

/** 관측소 상단 가운데 지표 게이지: 가장 최근 관측 주가 「내 평소」 띠의 어디쯤인지 */
function HubGauge({ w }: { w?: WeekRecord }) {
  if (!w) return null;
  return (
    <div className="obs-gauge" role="list" aria-label={`지표 게이지 · ${monthWeekLabel(w)} · 가운데 띠가 내 평소`}>
      <p className="obs-gauge-title">{GAUGE_AXES.map(axisScreen).join(' · ')} <span>— 내 평소 띠</span></p>
      <div className="obs-gauge-row">
        {GAUGE_AXES.map((ax) => {
          const a = w.axes[ax];
          return (
            <div key={ax} className={`obs-g${a ? '' : ' none'}`} role="listitem" aria-label={`${axisScreen(ax)}: ${a ? axisWord(a.pr) : '기록 없음'}`}>
              <i className="usual" aria-hidden="true" />
              {a && <i className="needle" style={{ left: `${Math.max(3, Math.min(97, a.pr * 100))}%` }} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SCENES = [
  { id: 'lantern', name: '등불' }, { id: 'rain', name: '비' }, { id: 'wind', name: '바람' }, { id: 'none', name: '소리 없음' },
] as const;
type SceneId = (typeof SCENES)[number]['id'];
const SCENE_KEY = 'mined.obsScene';
function loadScene(): SceneId {
  try { const v = localStorage.getItem(SCENE_KEY); if (SCENES.some((s) => s.id === v)) return v as SceneId; } catch { /* 없음 */ }
  return 'lantern';
}

export function Observatory({ onGo }: { onGo: (to: HubGo) => void }) {
  const { weeks, greeted } = useStore();
  const collected = useCollected();
  const open = collected.length >= SPACE_NEED;
  // 첫 인사는 「찾아가 보기」를 누르는 순간 greeted 가 되므로, 이 화면에 들어올 때 인사 중이었으면 답이 나올 때까지 인사 칸을 남겨 둔다
  const [greeting] = useState(!greeted);
  const [bubble, setBubble] = useState(true);
  const [scene, setScene] = useState<SceneId>(loadScene);
  const latest = useMemo(() => latestObserved(weeks), [weeks]);
  const cycle = () => {
    const next = SCENES[(SCENES.findIndex((s) => s.id === scene) + 1) % SCENES.length].id;
    setScene(next);
    try { localStorage.setItem(SCENE_KEY, next); } catch { /* 없음 */ }
    kitScene(next);
    sfx('tap');
  };
  const go = (to: HubGo) => { sfx('tap'); onGo(to); };
  const sceneName = SCENES.find((s) => s.id === scene)!.name;
  return (
    <section className={`obs scene-${scene}`} aria-labelledby="hub-title">
      <div className="obs-bg" style={{ backgroundImage: `url(${ART.observatoryBg})` }} aria-hidden="true" />
      <div className="obs-tint" aria-hidden="true" />
      <h2 id="hub-title" className="sr-only">관측소</h2>
      <button className="obs-scene" onClick={cycle} title="배경과 소리를 바꿔요" aria-label={`배경·소리 바꾸기 · 지금 ${sceneName}`}>
        배경·소리 <span>{sceneName}</span>
      </button>
      <HubGauge w={latest} />
      <div className="obs-stage">
        <div className="obs-say">
          {greeting && <MindiGreeting />}
          {greeted && bubble && (
            <div className="obs-bubble" role="note" aria-label="민디의 오늘 한 마디">
              <MindiMark size={30} />
              <p className="say">{todayLine(weeks, collected.length)}</p>
              <button className="obs-bubble-x" onClick={() => { sfx('close'); setBubble(false); }} aria-label="말풍선 닫기">×</button>
            </div>
          )}
        </div>
        <img className="obs-mindi" src={ART.mindiFull} alt="민디" />
        <nav className="obs-arc" aria-label="관측소에서 갈 곳">
          <button className="obs-btn a" onClick={() => go('today')} title="오늘 기록을 먼저 보여 줘요"><i>Ⓐ</i>오늘 보기</button>
          <button className="obs-btn b" onClick={() => go('elevator')} title="지난 연도의 지층으로 내려가요"><i>Ⓑ</i>내려가기</button>
          <button className="obs-btn c" onClick={() => go('talk')} title="기록 이야기든 그냥 이야기든 나눠요"><i>Ⓒ</i>민디와 이야기</button>
          <button className="obs-btn d" onClick={() => go('archive')} title={`지금까지 캔 광석을 모아 봐요 (${collected.length}개)`}><i>Ⓓ</i>캔 광석 · {collected.length}개</button>
          <button className={`obs-btn e${open ? '' : ' locked'}`} title={`광석을 모으면 열려요 (지금 ${Math.min(collected.length, SPACE_NEED)}/${SPACE_NEED})`}
            onClick={() => { if (open) go('space'); else { sfx('locked'); onGo('space'); } }}
            aria-label={open ? '나의 공간' : `나의 공간 · 잠김 · 광석 ${collected.length}/${SPACE_NEED}`}>
            <i>Ⓔ</i>나의 공간{!open && <> · <span aria-hidden="true">🔒</span> {collected.length}/{SPACE_NEED}</>}
          </button>
        </nav>
      </div>
    </section>
  );
}

/** Ⓐ 오늘 보기(P4): 왼쪽 판 = 고른 주(‹ › 로 한 주씩) + 지표·기록 요약 + 「비슷한 주 찾기」 / 오른쪽 판 = 닮은 주 5개 */
export function Today({ onDescend }: { onDescend: (week: string) => void }) {
  const { weeks, byKey, memosByWeek, photosByWeek } = useStore();
  // 기본은 견줄 수 있는 가장 최근 주(가장 최근 주가 견줄 지표를 덜 갖고 있으면 그 앞의 주)
  const start = useMemo(() => {
    for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].similar.length) return i;
    return weeks.length - 1;
  }, [weeks]);
  const [idx, setIdx] = useState(start);
  const [found, setFound] = useState<string>();
  const [hidden, setHidden] = useState<string[]>([]);
  const cur = weeks[Math.max(0, Math.min(weeks.length - 1, idx))];
  if (!cur) return <p className="muted">아직 기록이 없습니다.</p>;
  const move = (d: number) => { sfx('floor'); setIdx((i) => Math.max(0, Math.min(weeks.length - 1, i + d))); };
  const sims = found === cur.week
    ? cur.similar.slice(0, 5).map((s) => ({ s, w: byKey.get(s.week) })).filter((x) => x.w && !hidden.includes(x.w.week)) as { s: WeekRecord['similar'][number]; w: WeekRecord }[]
    : [];
  const memoN = memosByWeek.get(cur.week)?.length ?? 0;
  const photoN = photosByWeek.get(cur.week)?.length ?? 0;
  return (
    <section className="side-screen today" aria-labelledby="today-title">
      <div className="side-bg" style={{ backgroundImage: `url(${ART.observatoryBg})` }} aria-hidden="true" />
      <h2 id="today-title" className="sr-only">오늘 보기</h2>
      <div className="today-panels">
        <div className="side-panel today-left">
          <div className="today-date">
            <button className="tb-btn" onClick={() => move(-1)} disabled={idx <= 0} aria-label="한 주 앞">‹</button>
            <b>{dateLabel(cur.date_start)} 주</b>
            <button className="tb-btn" onClick={() => move(1)} disabled={idx >= weeks.length - 1} aria-label="한 주 뒤">›</button>
          </div>
          <p className="today-sub">{rangeLabel(cur)}의 기록</p>
          <ul className="today-axes">
            {GAUGE_AXES.map((ax) => {
              const a = cur.axes[ax];
              return <li key={ax}><span>{axisScreen(ax)}</span><b>{a ? axisWord(a.pr) : '기록 없음'}</b></li>;
            })}
          </ul>
          <p className="today-sub">글 {memoN} · 사진 {photoN}</p>
          <button className="btn primary today-find" onClick={() => { sfx('confirm'); setFound(cur.week); setHidden([]); }}
            disabled={!cur.similar.length}>비슷한 주 찾기</button>
          {!cur.similar.length && <p className="small muted">이 주는 견줄 지표가 모자라 닮은 주를 찾을 수 없습니다.</p>}
        </div>
        <div className="side-panel today-right" aria-live="polite">
          <p className="today-head">비슷한 주 {found === cur.week ? sims.length : 5}개</p>
          {found !== cur.week ? <p className="small muted">왼쪽에서 「비슷한 주 찾기」를 누르면 여기에 놓입니다.</p>
            : sims.length === 0 ? <p className="small muted">보여 드릴 주가 없습니다.</p> : (
            <ol className="today-list">
              {sims.map(({ s, w }) => {
                const m = oreMineral(w) as Mineral | null;
                const same = [...new Set(s.same_direction.map((x) => LABEL[x.split(':')[0]] ?? x.split(':')[0]))].slice(0, 2);
                return (
                  <li key={w.week} className="today-item">
                    {m && w.candidate ? <img src={MINERAL_IMG[m]} alt="" className="today-ore" /> : <span className={`today-ore stone g-${w.gyeol ?? 'none'}`} aria-hidden="true" />}
                    <div>
                      <b>{monthWeekLabel(w)}{same.length ? ` · ${same.join('·')}` : ''}</b>
                      <p className="small muted">{w.candidate ? '광석이 박힌 주' : w.gyeol ? `${GYEOL_TEXT[w.gyeol].name}의 주` : '평소였던 주'}</p>
                    </div>
                    <button className="btn" onClick={() => { sfx('confirm'); onDescend(w.week); }}>지층에서 보기</button>
                    <button className="tb-btn" onClick={() => { sfx('hide'); setHidden((h) => [...h, w.week]); }} aria-label={`${monthWeekLabel(w)} 이 기간 숨기기`} title="이 기간 숨기기">⋯</button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="small muted today-note">닮았다는 것은 숫자의 움직임이 가깝다는 뜻일 뿐, 그때의 마음이 같았다는 뜻은 아닙니다.</p>
        </div>
      </div>
    </section>
  );
}

/** Ⓒ 민디와 이야기(P9): 위 `설명 듣기 | 이야기 나누기` · 오른쪽 위 ⋯ · 대화창 · 입력창 바로 위 「함께 보는 기록」 칩 · 입력창은 아래 */
export function Talk({ onSpace, withWeek, firstText }: { onSpace?: () => void; withWeek?: string; firstText?: string }) {
  const { weeks, byKey } = useStore();
  const [mode, setMode] = useState<'explain' | 'chat'>(withWeek || firstText ? 'chat' : 'explain');
  const [chip, setChip] = useState<string | undefined>(withWeek);
  const [pending, setPending] = useState<string | undefined>(firstText);
  const [round, setRound] = useState(0);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = useMemo(() => latestObserved(weeks), [weeks]);
  const base = (chip && byKey.get(chip)) || latest;
  const [voice, setVoice] = useVoice();
  const collected = useCollected();
  const v = (s: string) => applyVoice(s, voice);
  const chipEl = chip && byKey.get(chip) ? (
    <div className="talk-chip-row">
      <span className="talk-chip">함께 보는 기록 · {monthWeekLabel(byKey.get(chip)!)}
        <button onClick={() => { sfx('erase'); setChip(undefined); }} aria-label="함께 보는 기록 빼기">×</button>
      </span>
    </div>
  ) : null;
  const tab = (m: 'explain' | 'chat') => { sfx('tap'); setMode(m); };
  return (
    <section className="side-screen talk" aria-labelledby="talk-title">
      <div className="side-bg" style={{ backgroundImage: `url(${ART.observatoryBg})` }} aria-hidden="true" />
      <img className="talk-mindi" src={ART.mindiFull} alt="" />
      <h2 id="talk-title" className="sr-only">민디와 이야기</h2>
      <div className="side-panel talk-panel">
        <div className="talk-top">
          <VoiceChip value={voice} onChange={setVoice} />
          <div className="talk-seg" role="tablist" aria-label="이야기 방식">
            <button role="tab" aria-selected={mode === 'explain'} className={mode === 'explain' ? 'on' : ''} onClick={() => tab('explain')}>설명 듣기</button>
            <button role="tab" aria-selected={mode === 'chat'} className={mode === 'chat' ? 'on' : ''} onClick={() => tab('chat')}>이야기 나누기</button>
          </div>
          <div className="talk-more">
            <button className="tb-btn" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu((x) => !x)}>⋯</button>
            {menu && (
              <div className="talk-menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(false); setPending(undefined); setRound((r) => r + 1); setMode('chat'); }}>새 대화</button>
                <button role="menuitem" onClick={() => { setMenu(false); setMode('explain'); }}>민디 설명 다시 보기</button>
              </div>
            )}
          </div>
        </div>
        {mode === 'explain' ? (
          <>
            <div className="talk-log">
              <div className="bubble"><MindiMark size={36} /><div className="stack">
                <p>{v('이곳은 당신의 기록이 해마다 한 겹씩 쌓인 광산입니다. 아래로 내려갈수록 오래된 해입니다.')}</p>
                <p>{v('모든 주는 지층의 결로 남아 있습니다. 걸음·수면·언어·소통 넷 가운데 기록이 직전 1년의 당신과 견주어 크게 벗어난 주에는 광석이 박혀 있습니다. 아무 주나 골라 캐도 광석이 됩니다.')}</p>
                <p>{v('광석을 캐면 그때 남긴 사진과 글과 숫자가 그대로 열립니다. 저는 그 기록을 꺼내 보여 드릴 뿐, 좋았다거나 나빴다고 말하지 않습니다.')}</p>
                <p>{v(`광석이 ${SPACE_NEED}개 모이면 안개가 걷히고 나의 공간을 지을 수 있습니다.`)}</p>
                <p className="small muted">기록은 이 브라우저 밖으로 나가지 않습니다.</p>
              </div></div>
            </div>
            {chipEl}
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (!t) return; sfx('send'); setPending(t); setDraft(''); setRound((r) => r + 1); setMode('chat'); }}>
              <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="이야기하기…" aria-label="민디에게 이야기하기" />
              <button className="btn primary" type="submit" disabled={!draft.trim()}>보내기</button>
            </form>
          </>
        ) : base ? (
          <MindiAsk key={`${base.week}-${round}`} w={base} voiceChip={false} chat initial={pending} chip={chipEl} />
        ) : <p className="muted">아직 기록이 없습니다.</p>}
        {/* 나의 공간 만들기: 자리는 잠정(「함께 보는 기록」 줄 오른쪽 끝). 열려 있으면 새 공간 짓기부터 연다 */}
        {onSpace && <div className="talk-foot"><SpaceButton count={collected.length} onOpen={() => { requestNewSpace(); onSpace(); }} /></div>}
      </div>
    </section>
  );
}

/** Ⓓ 캔 광석 보관함(P10): 판 하나 · 우상단 필터(연도·지표) · 시간순 격자 · 오른쪽 아래 「나의 공간 보기 · N/3」 */
export function Archive({ onSpace }: { onSpace: () => void }) {
  const { byKey, select } = useStore();
  const collected = useCollected();
  const [year, setYear] = useState('');
  const [axis, setAxis] = useState('');
  const rows = collected.map((c) => ({ c, w: byKey.get(c.week) })).filter((x) => x.w)
    .sort((a, b) => a.w!.week.localeCompare(b.w!.week)) as { c: (typeof collected)[number]; w: WeekRecord }[];
  const years = [...new Set(rows.map(({ w }) => w.week.slice(0, 4)))];
  const shown = rows.filter(({ w }) => (!year || w.week.startsWith(year)) && (!axis || pickedMineral(w)?.axis === axis));
  const open = collected.length >= SPACE_NEED;
  return (
    <section className="side-screen archive" aria-labelledby="arch-title">
      <div className="side-bg" style={{ backgroundImage: `url(${ART.observatoryBg})` }} aria-hidden="true" />
      <div className="side-panel arch-panel">
        <header className="arch-head">
          <h2 id="arch-title">캔 광석 {collected.length}개 <span>· 나의 공간까지 {Math.min(collected.length, SPACE_NEED)}/{SPACE_NEED}</span></h2>
          <div className="arch-filters">
            <label className="sr-only" htmlFor="arch-year">연도</label>
            <select id="arch-year" value={year} onChange={(e) => { sfx('tap'); setYear(e.target.value); }}>
              <option value="">연도 ▾</option>
              {years.map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
            <label className="sr-only" htmlFor="arch-axis">지표</label>
            <select id="arch-axis" value={axis} onChange={(e) => { sfx('tap'); setAxis(e.target.value); }}>
              <option value="">지표 ▾</option>
              {GAUGE_AXES.map((a) => <option key={a} value={a}>{axisScreen(a)}</option>)}
            </select>
          </div>
        </header>
        {rows.length === 0 ? <p className="muted">아직 캔 광석이 없습니다. 지층으로 내려가 광석을 세 번 쳐서 캐 보세요.</p>
          : shown.length === 0 ? <p className="muted">고른 조건에 맞는 광석이 없습니다.</p> : (
          <ul className="archive-grid">
            {shown.map(({ c, w }) => {
              const m = oreMineral(w) as Mineral | null;
              const name = customOreName(w.week);
              return (
                <li key={w.week}>
                  <button className="archive-cell" onClick={() => { sfx('tap'); select(w.week); }} aria-label={`${monthWeekLabel(w)}${name ? ` · ${name}` : ''} 다시 보기`}>
                    {m ? <img src={MINERAL_IMG[m]} alt="" /> : <img src={ART.stoneBasic} alt="" className="archive-stone" />}
                    <span className="archive-name">{w.week.slice(0, 4)} · {monthWeekLabel(w, false)}</span>
                    {name && <span className="archive-own">{name}</span>}
                    <span className="small muted">{c.picked ? '직접 고른 광석' : w.evidence.cross_validated ? '교차 확인' : '데이터 광석'}</span>
                    {m && <i className="archive-dot" style={{ background: MINERAL_HEX[m] }} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="arch-foot">
          <button className={`btn${open ? ' primary' : ''}`} onClick={() => { if (open) { sfx('tap'); onSpace(); } else sfx('locked'); }}
            aria-disabled={!open} title={open ? '나의 공간으로 가요' : '광석을 모으면 열려요'}>
            나의 공간 보기 · {Math.min(collected.length, SPACE_NEED)}/{SPACE_NEED}{!open && ' 🔒'}
          </button>
        </div>
      </div>
    </section>
  );
}
