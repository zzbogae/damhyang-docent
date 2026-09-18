import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Strata } from './ui/Strata';
import { Summary } from './ui/Summary';
import { WeekDetail } from './ui/WeekDetail';
import { Overview } from './ui/Overview';
import { ImportPanel } from './ui/ImportPanel';
import { Settings } from './ui/Settings';
import { IconRoom, IconSettings } from './ui/Icons';

const Room = lazy(() => import('./room/Room'));
const Islands = lazy(() => import('./islands/Islands'));
const Eras = lazy(() => import('./ui/Eras'));
const Eval = lazy(() => import('./ui/Eval'));

type Panel = 'week' | 'settings' | 'import' | 'room' | 'islands' | 'eras' | 'eval';

function Shell() {
  const { phase, selected, byKey, select, labels } = useStore();
  const [panel, setPanel] = useState<Panel>('week');
  const [roomName, setRoomName] = useState<string>();
  const rooms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of labels) { if (!m.has(l.name)) m.set(l.name, new Set()); m.get(l.name)!.add(l.week); }
    return [...m.entries()].filter(([, ws]) => ws.size >= 5).map(([n]) => n);
  }, [labels]);
  useEffect(() => {
    const open = (e: Event) => { setRoomName((e as CustomEvent<string>).detail); setPanel('room'); };
    window.addEventListener('mined:open-room', open);
    return () => window.removeEventListener('mined:open-room', open);
  }, []);
  const rightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) setPanel('week');
    rightRef.current?.scrollTo({ top: 0 });
    if (selected && window.innerWidth <= 1080) rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  const header = (
    <header className="top">
      <div className="wordmark">Mine D<small>마 인 디</small></div>
      <p className="promise">기록은 이 브라우저 밖으로 나가지 않습니다.</p>
      <div className="spacer" />
      {phase === 'ready' && (
        <div className="actions">
          <button className="btn quiet" onClick={() => { select(undefined); setPanel('week'); }}>처음 화면</button>
          {rooms.length > 0 && (
            <button className="btn quiet" onClick={() => { setRoomName(rooms[0]); setPanel('room'); }}><IconRoom />나의 방</button>
          )}
          <button className="btn quiet" onClick={() => setPanel('eras')}>시기</button>
          <button className="btn quiet" onClick={() => setPanel('islands')}>이어진 섬</button>
          <button className="btn quiet" onClick={() => setPanel('eval')}>평가</button>
          <button className="btn quiet" onClick={() => setPanel('import')}>다시 가져오기</button>
          <button className="btn quiet" onClick={() => setPanel('settings')} aria-label="설정"><IconSettings />설정</button>
        </div>
      )}
    </header>
  );

  if (phase === 'boot') return <div className="app">{header}<main /></div>;
  if (panel === 'eval' && phase !== 'working') {
    return (
      <div className="app">
        {header}
        <main style={{ overflow: 'auto' }}>
          <Suspense fallback={null}>
            <Eval onClose={() => setPanel('week')} onImport={() => setPanel('import')} />
          </Suspense>
        </main>
      </div>
    );
  }
  if (phase !== 'ready' || panel === 'import') {
    return (
      <div className="app">
        {header}
        <main style={{ overflow: 'auto' }}><ImportPanel onDone={() => setPanel('week')} onEval={() => setPanel('eval')} /></main>
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
      </div>
    );
  }
  if (panel === 'islands') {
    return (
      <div className="app">
        {header}
        <main style={{ minHeight: 0, overflow: 'auto' }}>
          <Suspense fallback={<p className="muted" style={{ padding: 28 }}>섬을 준비하는 중입니다.</p>}>
            <Islands onClose={() => setPanel('week')} />
          </Suspense>
        </main>
      </div>
    );
  }
  return (
    <div className="app">
      {header}
      <main className="main">
        <div className="col left">
          <Strata />
          <Summary />
        </div>
        <div className="col right" ref={rightRef}>
          {panel === 'settings' ? <Settings />
            : panel === 'eras' ? <Suspense fallback={null}><Eras /></Suspense>
            : w ? <WeekDetail w={w} key={w.week} /> : <Overview />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
