// 10/23 장면 플로우 ②·Ⓐ·Ⓒ·Ⓓ: 관측소 허브와 곁가지 화면(오늘 보기 · 민디와 이야기 · 캔 광석 보관함).
// 원칙 3: 앱이 고른 것으로 먼저 말 걸지 않는다. 오늘의 한 마디는 판정이 아니라 지층에 대한 사실 한 줄이고, 닮은 주는 사용자가 「오늘 보기」를 눌렀을 때만 찾는다.
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { dateLabel, rangeLabel, sameDirectionText } from '../mindi/templates';
import { oreMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { oreLabel } from './oreName';
import { MINERAL_IMG } from './design';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiGreeting } from './Mindi';
import { MindiAsk } from './MindiAsk';
import { MindiMark } from './Icons';
import { applyVoice, useVoice } from '../mindi/voices';
import { VoiceChip } from './VoiceChip';
import { requestNewSpace, SpaceButton } from './SpaceButton';
import { GYEOL_TEXT } from './Gyeol';
import type { WeekRecord } from '../types';

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

export function Observatory({ onGo }: { onGo: (to: HubGo) => void }) {
  const { weeks, greeted } = useStore();
  const collected = useCollected();
  const open = collected.length >= SPACE_NEED;
  // 첫 인사는 「찾아가 보기」를 누르는 순간 greeted 가 되므로, 이 화면에 들어올 때 인사 중이었으면 답이 나올 때까지 인사 칸을 남겨 둔다
  const [greeting] = useState(!greeted);
  return (
    <section className="hub" aria-labelledby="hub-title">
      <h2 id="hub-title" className="hub-title">관측소</h2>
      {greeting && <MindiGreeting />}
      {greeted && (
        <div className="mindi-panel" role="note" aria-label="민디의 오늘 한 마디">
          <div className="mindi"><MindiMark /><p className="say">{todayLine(weeks, collected.length)}</p></div>
        </div>
      )}
      <nav className="hub-buttons" aria-label="관측소에서 갈 곳">
        <button className="hub-btn primary" onClick={() => onGo('elevator')}><b>지층으로 내려가기</b><span>연도마다 쌓인 지층에서 광석을 캡니다</span></button>
        <button className="hub-btn" onClick={() => onGo('today')}><b>오늘 보기</b><span>가장 최근 주와 닮은 지난 주 다섯</span></button>
        <button className="hub-btn" onClick={() => onGo('talk')}><b>민디와 이야기</b><span>설명 듣기 · 그냥 이야기하기</span></button>
        <button className="hub-btn" onClick={() => onGo('archive')}><b>캔 광석 보관함</b><span>{collected.length ? `${collected.length}개` : '아직 캔 광석이 없습니다'}</span></button>
        <button className="hub-btn" onClick={() => onGo('space')} aria-describedby="hub-space-note">
          <b>나의 공간</b>
          <span id="hub-space-note">{open ? '안개가 걷혔습니다' : `광석 ${collected.length}/${SPACE_NEED} · ${SPACE_NEED}개가 모이면 열립니다`}</span>
        </button>
      </nav>
    </section>
  );
}

/** Ⓐ 오늘 보기: 가장 최근 주 → 닮은 지난 주 5개 → 그중 하나로 내려가기 */
export function Today({ onDescend }: { onDescend: (week: string) => void }) {
  const { weeks, byKey } = useStore();
  const last = useMemo(() => latestObserved(weeks), [weeks]);
  // 가장 최근 주가 견줄 지표를 덜 갖고 있으면(닮은 주가 계산되지 않음) 견줄 수 있는 가장 최근 주로 본다
  const cur = useMemo(() => [...weeks].reverse().find((w) => w.similar.length > 0) ?? last, [weeks, last]);
  if (!cur) return <p className="muted">아직 기록이 없습니다.</p>;
  const sims = cur.similar.slice(0, 5).map((s) => ({ s, w: byKey.get(s.week) })).filter((x) => x.w) as { s: WeekRecord['similar'][number]; w: WeekRecord }[];
  return (
    <section className="stack" aria-labelledby="today-title">
      <h2 id="today-title" className="h2">오늘 보기</h2>
      {last && last.week !== cur.week
        ? <p>기록이 남은 가장 최근 주({rangeLabel(last)})는 견줄 지표가 모자라, 견줄 수 있는 가장 최근 주인 <b>{rangeLabel(cur)}</b>로 봅니다. 지표의 움직임이 이 주와 가장 가까웠던 지난 주를 가까운 순서로 놓았습니다.</p>
        : <p>기록이 남은 가장 최근 주는 <b>{rangeLabel(cur)}</b>입니다. 지표의 움직임이 이 주와 가장 가까웠던 지난 주를 가까운 순서로 놓았습니다.</p>}
      {sims.length === 0 ? <p className="muted">아직 견줄 만큼 기록이 쌓이지 않았습니다.</p> : (
        <ol className="today-list">
          {sims.map(({ s, w }) => {
            const m = oreMineral(w) as Mineral | null;
            return (
              <li key={w.week} className="today-item">
                {m && w.candidate ? <img src={MINERAL_IMG[m]} alt="" className="today-ore" /> : <span className={`today-ore stone g-${w.gyeol ?? 'none'}`} aria-hidden="true" />}
                <div>
                  <b>{rangeLabel(w)}</b>
                  <p className="small muted">{w.candidate ? '광석이 박힌 주' : w.gyeol ? `${GYEOL_TEXT[w.gyeol].name}의 주` : '평소였던 주'}{s.same_direction.length ? ` · ${sameDirectionText(s.same_direction)}` : ''}</p>
                </div>
                <button className="btn" onClick={() => onDescend(w.week)}>이 주로 내려가기</button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="small muted">닮았다는 것은 숫자의 움직임이 가깝다는 뜻일 뿐, 그때의 마음이 같았다는 뜻은 아닙니다.</p>
    </section>
  );
}

/** Ⓒ 민디와 이야기: 설명 듣기 / 그냥 이야기하기. 상관없는 이야기도 받아 준다(지어내지 않고 모른다고 답한다) */
export function Talk({ onSpace, withWeek, firstText }: { onSpace?: () => void; withWeek?: string; firstText?: string }) {
  void withWeek; void firstText;
  const { weeks } = useStore();
  const [mode, setMode] = useState<'explain' | 'chat'>('explain');
  const cur = useMemo(() => latestObserved(weeks), [weeks]);
  const [voice, setVoice] = useVoice();
  const collected = useCollected();
  const v = (s: string) => applyVoice(s, voice);
  return (
    <section className="stack" aria-labelledby="talk-title">
      <h2 id="talk-title" className="h2">민디와 이야기</h2>
      <div className="talk-head">
      <VoiceChip value={voice} onChange={setVoice} />
      <div className="label-row" role="tablist" aria-label="이야기 방식">
        <button role="tab" aria-selected={mode === 'explain'} className={`btn${mode === 'explain' ? ' primary' : ''}`} onClick={() => setMode('explain')}>설명 듣기</button>
        <button role="tab" aria-selected={mode === 'chat'} className={`btn${mode === 'chat' ? ' primary' : ''}`} onClick={() => setMode('chat')}>그냥 이야기하기</button>
      </div>
      </div>
      {mode === 'explain' ? (
        <div className="bubble"><MindiMark size={36} /><div className="stack">
          <p>{v('이곳은 당신의 기록이 해마다 한 겹씩 쌓인 광산입니다. 아래로 내려갈수록 오래된 해입니다.')}</p>
          <p>{v('모든 주는 지층의 결로 남아 있습니다. 걸음·수면·언어·소통 넷 가운데 기록이 직전 1년의 당신과 견주어 크게 벗어난 주에는 광석이 박혀 있습니다. 아무 주나 골라 캐도 광석이 됩니다.')}</p>
          <p>{v('광석을 캐면 그때 남긴 사진과 글과 숫자가 그대로 열립니다. 저는 그 기록을 꺼내 보여 드릴 뿐, 좋았다거나 나빴다고 말하지 않습니다.')}</p>
          <p>{v(`광석이 ${SPACE_NEED}개 모이면 안개가 걷히고 나의 공간을 지을 수 있습니다.`)}</p>
          <p className="small muted">기록은 이 브라우저 밖으로 나가지 않습니다.</p>
        </div></div>
      ) : cur ? <MindiAsk w={cur} voiceChip={false} /> : <p className="muted">아직 기록이 없습니다.</p>}
      {/* 나의 공간 만들기: 자리는 잠정(「함께 보는 기록」 줄 오른쪽 끝). 열려 있으면 새 공간 짓기부터 연다 */}
      {onSpace && <div className="talk-foot"><SpaceButton count={collected.length} onOpen={() => { requestNewSpace(); onSpace(); }} /></div>}
    </section>
  );
}

/** Ⓓ 캔 광석 보관함: 시간순 격자 · 다시 보기 */
export function Archive({ onSpace }: { onSpace: () => void }) {
  const { byKey, select } = useStore();
  const collected = useCollected();
  const rows = collected.map((c) => ({ c, w: byKey.get(c.week) })).filter((x) => x.w)
    .sort((a, b) => a.w!.week.localeCompare(b.w!.week)) as { c: (typeof collected)[number]; w: WeekRecord }[];
  return (
    <section className="stack" aria-labelledby="arch-title">
      <h2 id="arch-title" className="h2">캔 광석 보관함</h2>
      {rows.length === 0 ? <p className="muted">아직 캔 광석이 없습니다. 지층으로 내려가 광석을 세 번 쳐서 캐 보세요.</p> : (
        <ul className="archive-grid">
          {rows.map(({ c, w }) => {
            const m = oreMineral(w) as Mineral | null;
            return (
              <li key={w.week}>
                <button className="archive-cell" onClick={() => select(w.week)} aria-label={`${oreLabel({ ...w, mineral: m })} 다시 보기`}>
                  {m ? <img src={MINERAL_IMG[m]} alt="" /> : <span className="archive-blank" aria-hidden="true" />}
                  <span className="archive-name">{m ? oreLabel({ ...w, mineral: m }) : rangeLabel(w)}</span>
                  <span className="small muted">{c.picked ? '직접 고른 광석' : w.evidence.cross_validated ? '교차 확인' : '데이터 광석'}</span>
                  {m && <i className="archive-dot" style={{ background: MINERAL_HEX[m] }} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted">광석 {collected.length}/{SPACE_NEED}{collected.length >= SPACE_NEED ? ' · 나의 공간이 열렸습니다' : ''}</p>
      {collected.length >= SPACE_NEED && <button className="btn primary" onClick={onSpace}>나의 공간으로</button>}
    </section>
  );
}
