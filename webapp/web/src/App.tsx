import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Strata } from './ui/Strata';
import { Summary } from './ui/Summary';
import { WeekDetail } from './ui/WeekDetail';
import { Overview } from './ui/Overview';
import { ImportPanel } from './ui/ImportPanel';
import { Settings } from './ui/Settings';
import { IconRoom, IconSettings } from './ui/Icons';
import { Letters } from './ui/Letters';
import { Collect } from './ui/Collect';
import { FullscreenButton, KioskOverlay, useKiosk } from './ui/Kiosk';
import { useEn } from './i18n/useEn';
import { FOOTER_EN } from './i18n/en';

function Door109En() {
  return useEn() ? <span lang="en" className="muted"> · {FOOTER_EN}</span> : null;
}
import type { Axis } from './types';
import { arrivedCount, loadLetters } from './letters/letters';

// 발표·일반 흐름에서는 감추고 주소로만 여는 화면(팀 9/23 §2-2, 회의 질문 5).
// 평가: ?eval — 팀원 실기록 평가용 / 이어진 갱도(옛 이어진 섬): ?islands — 확장 가능성 시연용
const FLAGS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const SHOW_EVAL = FLAGS.has('eval');
export const SHOW_ISLANDS = FLAGS.has('islands');
// 전시용(?kiosk 또는 ?kiosk=초): 샘플 자동 불러오기, 쉬는 시간 뒤 초기화, 다시 가져오기 숨김
export const KIOSK = FLAGS.has('kiosk');
const KIOSK_IDLE = Math.max(5, Number(FLAGS.get('kiosk')) || 90);

const Room = lazy(() => import('./room/Room'));
const Islands = lazy(() => import('./islands/Islands'));
const Eras = lazy(() => import('./ui/Eras'));
const Eval = lazy(() => import('./ui/Eval'));

type Panel = 'week' | 'settings' | 'import' | 'room' | 'islands' | 'eras' | 'eval' | 'letters' | 'collect';

function Shell() {
  const { phase, selected, byKey, select, labels, result } = useStore();
  // 안드로이드 공유로 사진이 넘어오면 가져오기 화면부터 연다
  const [panel, setPanel] = useState<Panel>(FLAGS.has('shared') ? 'import' : 'week');
  const [roomName, setRoomName] = useState<string>();
  const [collectOf, setCollectOf] = useState<{ axis: Axis; dir: 'up' | 'down' }>();
  const rooms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of labels) { if (!m.has(l.name)) m.set(l.name, new Set()); m.get(l.name)!.add(l.week); }
    return [...m.entries()].filter(([, ws]) => ws.size >= 5).map(([n]) => n);
  }, [labels]);
  useEffect(() => {
    const open = (e: Event) => { setRoomName((e as CustomEvent<string>).detail); setPanel('room'); };
    const collect = (e: Event) => { setCollectOf((e as CustomEvent<{ axis: Axis; dir: 'up' | 'down' }>).detail); setPanel('collect'); };
    const showWeek = () => setPanel('week');
    const openEval = () => setPanel('eval');
    window.addEventListener('mined:open-eval', openEval);
    window.addEventListener('mined:open-room', open);
    window.addEventListener('mined:collect', collect);
    window.addEventListener('mined:show-week', showWeek);
    return () => {
      window.removeEventListener('mined:open-room', open);
      window.removeEventListener('mined:collect', collect);
      window.removeEventListener('mined:show-week', showWeek);
      window.removeEventListener('mined:open-eval', openEval);
    };
  }, []);
  const [arrived, setArrived] = useState(0);
  const resetting = useKiosk(KIOSK, KIOSK_IDLE, () => { setPanel('week'); setArrived(0); });
  const refreshLetters = () => { loadLetters().then((ls) => setArrived(arrivedCount(ls))); };
  useEffect(refreshLetters, []);
  const rightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) setPanel('week');
    rightRef.current?.scrollTo({ top: 0 });
    if (selected && window.innerWidth <= 1080) rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  const header = (
    <header className="top">
      <div className="wordmark">Mine D</div>
      <p className="promise">기록은 이 브라우저 밖으로 나가지 않습니다.</p>
      <div className="spacer" />
      {phase === 'ready' && (
        <div className="actions">
          <button className="btn quiet" onClick={() => { select(undefined); setPanel('week'); }}>처음 화면</button>
          {rooms.length > 0 && (
            <button className="btn quiet" onClick={() => { setRoomName(rooms[0]); setPanel('room'); }}><IconRoom />나의 방</button>
          )}
          <button className="btn quiet" onClick={() => setPanel('eras')}>시기</button>
          <button className="btn quiet" onClick={() => setPanel('letters')}>{arrived ? `편지 ${arrived}통` : '편지'}</button>
          {SHOW_ISLANDS && <button className="btn quiet" onClick={() => setPanel('islands')}>이어진 갱도</button>}
          {SHOW_EVAL && <button className="btn quiet" onClick={() => setPanel('eval')}>평가</button>}
          {!KIOSK && <button className="btn quiet" onClick={() => setPanel('import')}>다시 가져오기</button>}
          {KIOSK && <FullscreenButton />}
          <button className="btn quiet" onClick={() => setPanel('settings')} aria-label="설정"><IconSettings />설정</button>
        </div>
      )}
    </header>
  );

  const door = <>{resetting && <KioskOverlay />}<footer className="door" role="note">이야기를 들어 줄 곳 · <b>자살예방상담전화 109</b> (24시간)<Door109En /></footer></>;
  if (phase === 'boot') return <div className="app">{header}<main />{door}</div>;
  if (panel === 'eval' && phase !== 'working') {
    return (
      <div className="app">
        {header}
        <main style={{ overflow: 'auto' }}>
          <Suspense fallback={null}>
            <Eval onClose={() => setPanel('week')} onImport={() => setPanel('import')} />
          </Suspense>
        </main>
        {door}
      </div>
    );
  }
  if (phase !== 'ready' || panel === 'import') {
    return (
      <div className="app">
        {header}
        <main style={{ overflow: 'auto' }}><ImportPanel onDone={() => setPanel('week')} onEval={SHOW_EVAL ? () => setPanel('eval') : undefined} /></main>
        {door}
      </div>
    );
  }
  const w = selected ? byKey.get(selected) : undefined;
  if (panel === 'room' && roomName) {
    return (
      <div className="app">
        {header}
        <main style={{ minHeight: 0 }}>
          <Suspense fallback={<p className="muted" style={{ padding: 28 }}>방을 준비하는 중입니다.</p>}>
            <Room name={roomName} onClose={() => setPanel('week')} />
          </Suspense>
        </main>
        {door}
      </div>
    );
  }
  if (panel === 'islands') {
    return (
      <div className="app">
        {header}
        <main style={{ minHeight: 0, overflow: 'auto' }}>
          <Suspense fallback={<p className="muted" style={{ padding: 28 }}>갱도를 준비하는 중입니다.</p>}>
            <Islands onClose={() => setPanel('week')} />
          </Suspense>
        </main>
        {door}
      </div>
    );
  }
  return (
    <div className="app">
      {header}
      <main className="main">
        <div className="col left">
          <Strata />
          {/* 9/12 회의 5번: 숫자가 많은 요약은 접어 둔다 */}
          <details className="why summary-fold" open={!!(result?.summary as { imported_v6?: boolean } | undefined)?.imported_v6}>
            <summary>가져온 기록과 요약</summary>
            <Summary />
          </details>
        </div>
        <div className="col right" ref={rightRef}>
          {panel === 'settings' ? <Settings />
            : panel === 'eras' ? <Suspense fallback={null}><Eras /></Suspense>
            : panel === 'letters' ? <Letters onChange={refreshLetters} />
            : panel === 'collect' && collectOf ? <Collect axis={collectOf.axis} dir={collectOf.dir} onClose={() => setPanel('week')} />
            : w ? <WeekDetail w={w} key={w.week} /> : <Overview />}
        </div>
      </main>
      {door}
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
