// 10/23 버튼배치 확정(v6 §5 전역 요소): 왼쪽 세로 레일(관측소·민디·나의 공간·설정, 모바일은 하단 탭) +
// 좌상단 ‹ 와 현재 위치 + 모든 화면 우상단 한 묶음 [?] [⚙] [관측소의 문].
// 몰입 화면(엘리베이터·지층·캐기·상세·나의 공간 만들기)은 레일을 접고 ‹ 와 현재 위치만 남긴다(버튼배치 §2 제안).
import { useEffect, useState, type ReactNode } from 'react';
import { kitOverlay, sfx } from '../mindi/soundKit';
import { IconSettings } from './Icons';
import './frame.css';

export type RailId = 'hub' | 'talk' | 'space' | 'settings';
const RAIL: { id: RailId; label: string }[] = [
  { id: 'hub', label: '관측소' }, { id: 'talk', label: '민디' }, { id: 'space', label: '나의 공간' }, { id: 'settings', label: '설정' },
];

export function Rail({ on, onGo }: { on?: RailId; onGo: (id: RailId) => void }) {
  return (
    <nav className="rail" aria-label="주 메뉴">
      {RAIL.map((r) => (
        <button key={r.id} className={`rail-btn${on === r.id ? ' on' : ''}`} aria-current={on === r.id ? 'page' : undefined}
          onClick={() => { sfx('tap'); onGo(r.id); }}>
          <i aria-hidden="true" />{r.label}
        </button>
      ))}
    </nav>
  );
}

export function TopBar({ crumbs, onBack, onSettings, extra }: { crumbs: string[]; onBack?: () => void; onSettings: () => void; extra?: ReactNode }) {
  const [win, setWin] = useState<'help' | 'door'>();
  useEffect(() => {
    if (!win) return;
    kitOverlay(win, true);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setWin(undefined); };
    window.addEventListener('keydown', esc);
    return () => { kitOverlay(win, false); window.removeEventListener('keydown', esc); };
  }, [win]);
  const open = (w: 'help' | 'door') => setWin(w);
  const close = () => setWin(undefined);
  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          {onBack && <button className="tb-back" onClick={() => { sfx('back'); onBack(); }} aria-label="뒤로 가기">‹</button>}
          <p className="crumbs" aria-label="현재 위치">{crumbs.join(' › ')}</p>
        </div>
        <div className="topbar-right" role="group" aria-label="안내·설정·나가기">
          {extra}
          <button className="tb-btn" onClick={() => open('help')} aria-label="안내">?</button>
          <button className="tb-btn" onClick={() => { sfx('tap'); onSettings(); }} aria-label="설정"><IconSettings /></button>
          <button className="tb-door" onClick={() => open('door')}>관측소의 문</button>
        </div>
      </div>
      {win === 'help' && (
        <div className="fw-scrim" onClick={close}>
          <div className="fw" role="dialog" aria-modal="true" aria-labelledby="fw-help" onClick={(e) => e.stopPropagation()}>
            <button className="fw-x" onClick={close} aria-label="닫기">×</button>
            <h2 id="fw-help">안내</h2>
            <dl className="fw-list">
              <dt>관측소</dt><dd>민디가 있는 곳입니다. 둘레의 버튼 다섯 개로 오늘 보기·내려가기·민디와 이야기·캔 광석·나의 공간에 갑니다.</dd>
              <dt>내려가기</dt><dd>엘리베이터에서 연도를 골라 그해 지층으로 내려갑니다. 아래로 갈수록 오래된 해입니다.</dd>
              <dt>광석 읽는 법</dt><dd>걸음·수면·언어·소통 넷 가운데 기록이 직전 1년의 내 평소 범위를 크게 벗어난 주에 광석이 박혀 있습니다. 좋고 나쁨을 뜻하지 않습니다.</dd>
              <dt>캐기</dt><dd>광석을 세 번 누르면 깨지고, 그 주에 남은 사진·글·숫자가 열립니다.</dd>
              <dt>기록</dt><dd>기록은 이 브라우저 밖으로 나가지 않습니다. 설정에서 언제든 지울 수 있습니다.</dd>
            </dl>
          </div>
        </div>
      )}
      {win === 'door' && (
        <div className="fw-scrim" onClick={close}>
          <div className="fw" role="dialog" aria-modal="true" aria-labelledby="fw-door" onClick={(e) => e.stopPropagation()}>
            <button className="fw-x" onClick={close} aria-label="닫기">×</button>
            <h2 id="fw-door">관측소의 문</h2>
            <p>언제든 여기서 나갈 수 있습니다. 이야기를 들어 줄 사람이 필요하면 아래로 연락할 수 있습니다.</p>
            <ul className="fw-lines">
              <li><b>109</b> 자살예방상담전화 (24시간)</li>
              <li><b>1577-0199</b> 정신건강위기상담전화 (24시간)</li>
              <li><b>1388</b> 청소년상담전화 (24시간)</li>
              <li><b>112 · 119</b> 긴급 신고</li>
            </ul>
            <div className="fw-actions">
              <button className="btn" onClick={close}>닫기</button>
              <button className="btn primary" onClick={() => { sfx('back'); sessionStorage.removeItem('mined.entered'); location.assign(location.pathname + '?intro'); }}>지금 나가기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
