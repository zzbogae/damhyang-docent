import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Strata } from './ui/Strata';
import { MineField } from './ui/MineField';
import { Intro } from './ui/Intro';
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
import { ART } from './ui/design';
import { Archive, Observatory, Talk, Today, type HubGo } from './ui/Observatory';
// 현재 위치의 주 표기: 「4월 2주」
const rangeLabelShort = (d: string) => { const [, m, day] = d.split('-').map(Number); return `${m}월 ${Math.ceil(day / 7)}주`; };
import { Space } from './ui/Space';
import { Rail, TopBar, type RailId } from './ui/Frame';
import { Lift } from './ui/Lift';
import { Mine } from './ui/Mine';
import { collect } from './ore/collection';
import { panelScene, sceneSound } from './mindi/soundKit';

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
// 기본 화면은 드라이브 디자인(광물 지하 → 상세). ?grid 는 이전 두 칸 화면(주 격자 + 상세): 모든 주를 격자로 훑거나 키보드로 옮겨 다닐 때, 시험용
export const GRID = FLAGS.has('grid');
const KIOSK_IDLE = Math.max(5, Number(FLAGS.get('kiosk')) || 90);

const Room = lazy(() => import('./room/Room'));
const Islands = lazy(() => import('./islands/Islands'));
const Eras = lazy(() => import('./ui/Eras'));
const Eval = lazy(() => import('./ui/Eval'));

type Panel = 'week' | 'settings' | 'import' | 'room' | 'islands' | 'eras' | 'eval' | 'letters' | 'collect'
  // 10/23 장면 플로우(기본 화면만): 관측소 허브와 곁가지
  | 'hub' | 'field' | 'today' | 'talk' | 'archive' | 'space'
  // 10/23 버튼배치 확정: P5 엘리베이터 · P7 광석 캐기는 따로 된 화면
  | 'elevator' | 'mine';

function Shell() {
  const { phase, selected, byKey, select, labels, result } = useStore();
  // 안드로이드 공유로 사진이 넘어오면 가져오기 화면부터 연다
  const [panel, setPanel] = useState<Panel>(FLAGS.has('shared') ? 'import' : GRID ? 'week' : 'hub');
  // 관측소에서 지층으로 내려갈 때만 엘리베이터를 보여 주고, 오늘 보기에서 고른 주가 있으면 그 주로 내려간다
  const [descent, setDescent] = useState<{ n: number; focus?: string; year?: number }>({ n: 0 });
  const [mining, setMining] = useState<string>();
  const [talkWith, setTalkWith] = useState<{ week: string; text?: string }>();
  const home: Panel = GRID ? 'week' : 'hub';
  // 관측소 Ⓑ 내려가기는 P5 엘리베이터부터(연도를 고르고 내려간다)
  const goHub = (to: HubGo) => {
    if (to === 'talk') setTalkWith(undefined);
    setPanel(to);
  };
  const [roomName, setRoomName] = useState<string>();
  useEffect(() => { sceneSound(phase !== 'ready' ? 'import' : panelScene(panel, !!selected)); }, [phase, panel, selected]);
  const [collectOf, setCollectOf] = useState<{ axis: Axis; dir: 'up' | 'down' }>();
  const rooms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of labels) { if (!m.has(l.name)) m.set(l.name, new Set()); m.get(l.name)!.add(l.week); }
    return [...m.entries()].filter(([, ws]) => ws.size >= 5).map(([n]) => n);
  }, [labels]);
  useEffect(() => {
    const open = (e: Event) => { setRoomName((e as CustomEvent<string>).detail); setPanel('room'); };
    const collect = (e: Event) => { setCollectOf((e as CustomEvent<{ axis: Axis; dir: 'up' | 'down' }>).detail); setPanel('collect'); };
    const showWeek = () => setPanel(GRID ? 'week' : 'field');
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
  const resetting = useKiosk(KIOSK, KIOSK_IDLE, () => { setPanel(home); setArrived(0); });
  const refreshLetters = () => { loadLetters().then((ls) => setArrived(arrivedCount(ls))); };
  useEffect(refreshLetters, []);
  const rightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) { setPanel('week'); setMining(undefined); }
    rightRef.current?.scrollTo({ top: 0 });
    if (selected && window.innerWidth <= 1080) rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  const header = (
    <header className="top">
      <div className="wordmark"><img src={ART.logoLight} alt="" /><span className="sr-only">Mine D</span></div>
      <p className="promise">기록은 이 브라우저 밖으로 나가지 않습니다.</p>
      <div className="spacer" />
      {phase === 'ready' && (
        <div className="actions">
          <button className="btn quiet" onClick={() => { select(undefined); setPanel(home); }}>{GRID ? '처음 화면' : '관측소'}</button>
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
        <main style={{ overflow: 'auto' }}><ImportPanel onDone={() => setPanel(home)} onEval={SHOW_EVAL ? () => setPanel('eval') : undefined} /></main>
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
  if (!GRID) {
    // 10/23 버튼배치 확정(P0~P13 시안): 관측소(허브) → Ⓑ 엘리베이터(P5) → 연도 지층(P6) → 광석 캐기(P7) → 광석 상세(P8).
    // 왼쪽 레일 + 우상단 [?][⚙][관측소의 문] + 좌상단 ‹ 와 현재 위치. 몰입 화면은 레일을 접는다.
    const toField = () => { select(undefined); setPanel('field'); };
    const toHub = () => { select(undefined); setPanel('hub'); };
    const toSpace = () => { select(undefined); setPanel('space'); };
    const yearOf = (k?: string) => (k ? Number(k.split('-W')[0]) : undefined);
    const crumbs: string[] = (() => {
      switch (panel) {
        case 'hub': return ['관측소'];
        case 'today': return ['관측소', '오늘'];
        case 'elevator': return ['관측소', '엘리베이터'];
        case 'field': return ['관측소', '지층'];
        case 'mine': return ['관측소', `${yearOf(mining) ?? ''}년 지층`, '광석 캐기'];
        case 'week': return w ? ['관측소', `${yearOf(w.week)}년 지층`, rangeLabelShort(w.date_start)] : ['관측소'];
        case 'talk': return ['관측소', '민디와 이야기'];
        case 'archive': return ['관측소', '캔 광석'];
        case 'space': return ['관측소', '나의 공간'];
        case 'settings': return ['설정'];
        case 'eras': return ['관측소', '시기'];
        case 'letters': return ['관측소', '편지'];
        case 'collect': return ['관측소', '지층', '모아 보기'];
        default: return ['관측소'];
      }
    })();
    // P8 은 시안의 「‹ 되돌아가기」(세 갈래)가 뒤로 가기를 맡는다
    const back: (() => void) | undefined = panel === 'hub' || panel === 'week' ? undefined
      : panel === 'collect' || panel === 'mine' ? toField
      : toHub;
    const railOn: RailId | undefined = panel === 'hub' || panel === 'today' || panel === 'archive' || panel === 'eras' || panel === 'letters' ? 'hub'
      : panel === 'talk' ? 'talk' : panel === 'space' ? 'space' : panel === 'settings' ? 'settings' : undefined;
    const immersive = panel === 'elevator' || panel === 'field' || panel === 'mine' || panel === 'week' || panel === 'collect' || panel === 'space';
    const onRail = (id: RailId) => { select(undefined); if (id === 'talk') setTalkWith(undefined); setPanel(id); };
    const page = panel === 'settings' ? <Settings extra={(
        <div className="label-row">
          <button className="btn" onClick={() => setPanel('eras')}>시기</button>
          <button className="btn" onClick={() => setPanel('letters')}>{arrived ? `편지 ${arrived}통` : '편지'}</button>
          {rooms.length > 0 && <button className="btn" onClick={() => { setRoomName(rooms[0]); setPanel('room'); }}>나의 방</button>}
          {SHOW_ISLANDS && <button className="btn" onClick={() => setPanel('islands')}>이어진 갱도</button>}
          {SHOW_EVAL && <button className="btn" onClick={() => setPanel('eval')}>평가</button>}
          {!KIOSK && <button className="btn" onClick={() => setPanel('import')}>기록 다시 가져오기</button>}
        </div>
      )} />
      : panel === 'eras' ? <Suspense fallback={null}><Eras /></Suspense>
      : panel === 'letters' ? <Letters onChange={refreshLetters} />
      : panel === 'collect' && collectOf ? <Collect axis={collectOf.axis} dir={collectOf.dir} onClose={toField} />
      : null;
    const body = page ? <div className="team-page">{page}</div>
      : panel === 'hub' ? <Observatory onGo={goHub} />
      : panel === 'today' ? <Today onDescend={(week) => { setDescent((d) => ({ n: d.n + 1, focus: week })); setPanel('field'); }} />
      : panel === 'talk' ? <Talk onSpace={toSpace} withWeek={talkWith?.week} firstText={talkWith?.text} />
      : panel === 'archive' ? <Archive onSpace={toSpace} />
      : panel === 'space' ? <Space onField={() => setPanel('elevator')} />
      : panel === 'elevator' ? <Lift onBack={toHub} onDescend={(year) => { setDescent((d) => ({ n: d.n + 1, year })); setPanel('field'); }} />
      : panel === 'mine' && mining && byKey.get(mining) ? (
        <Mine w={byKey.get(mining)!}
          onCarry={() => { collect(byKey.get(mining)!); setMining(undefined); toHub(); }}
          onView={() => { const k = mining; collect(byKey.get(k)!); setMining(undefined); select(k); }} />
      )
      : panel === 'week' && w ? (
        <WeekDetail w={w} key={w.week} team
          onBack={(to) => (to === 'hub' ? toHub() : to === 'space' ? toSpace() : toField())}
          onAsk={(text) => { setTalkWith({ week: w.week, text }); select(undefined); setPanel('talk'); }} />
      )
      : <MineField descent={descent.n} focusWeek={descent.focus} focusYear={descent.year} onMine={(k) => { setMining(k); setPanel('mine'); }} />;
    const padded = !!page || panel === 'today' || panel === 'talk' || panel === 'archive' || panel === 'space';
    return (
      <div className={`app team framed${immersive ? ' immersive' : ''}${panel === 'field' ? ' on-field' : ''}`}>
        {!immersive && <Rail on={railOn} onGo={onRail} />}
        <div className="stage">
          <TopBar crumbs={crumbs} onBack={back} onSettings={() => { select(undefined); setPanel('settings'); }} />
          <main className={`stage-body team-main${padded ? ' padded' : ''}`} ref={rightRef}>{body}</main>
        </div>
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

// 입장 인트로는 이 탭에서 처음 열 때 한 번. 자동 시험(webdriver)에서는 건너뛰고, 주소에 ?intro 를 붙이면 언제든 다시 본다.
function useIntro() {
  const force = FLAGS.has('intro');
  const auto = typeof navigator !== 'undefined' && navigator.webdriver;
  const seen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mined.entered') === '1';
  const [show, setShow] = useState(force || (!auto && !seen));
  return [show, () => { sessionStorage.setItem('mined.entered', '1'); setShow(false); }] as const;
}

export default function App() {
  const [intro, done] = useIntro();
  return <StoreProvider><Shell />{intro && <Intro onDone={done} />}</StoreProvider>;
}
