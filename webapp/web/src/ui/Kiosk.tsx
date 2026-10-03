// 전시용 키오스크 모드(?kiosk 또는 ?kiosk=초): 가짜 샘플을 저절로 불러오고, 아무도 만지지 않은 채 정해진 시간이 지나면
// 관람객이 남긴 것(이름·편지·기록 더하기·연 주)을 모두 지우고 처음 화면으로 돌아간다. 기본 90초.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export function useKiosk(enabled: boolean, idleSec: number, onReset: () => void) {
  const { phase, setPhase, reload, select, relockAll } = useStore();
  const [resetting, setResetting] = useState(false);
  const started = useRef(false);
  const run = async () => {
    setResetting(true);
    setPhase('working');
    const [{ wipeAll }, { runSample }] = await Promise.all([import('../db'), import('../pipeline')]);
    await wipeAll();
    await runSample(() => undefined);
    select(undefined);
    relockAll();
    onReset();
    await reload();
    setResetting(false);
  };
  // 처음 열 때 기록이 없으면 샘플을 불러온다
  useEffect(() => {
    if (!enabled || started.current || phase !== 'empty') return;
    started.current = true;
    run().catch(() => setResetting(false));
  }, [enabled, phase]);
  // 쉬는 시간이 지나면 초기화
  useEffect(() => {
    if (!enabled) return;
    let t = window.setTimeout(tick, idleSec * 1000);
    function tick() { if (!resetting) run().catch(() => setResetting(false)); }
    const poke = () => { window.clearTimeout(t); t = window.setTimeout(tick, idleSec * 1000); };
    for (const e of EVENTS) window.addEventListener(e, poke, { passive: true });
    return () => { window.clearTimeout(t); for (const e of EVENTS) window.removeEventListener(e, poke); };
  }, [enabled, idleSec, resetting]);
  return resetting;
}

export function KioskOverlay() {
  return <div className="kiosk-overlay" role="status">처음 화면을 준비하고 있습니다.</div>;
}

export function FullscreenButton() {
  if (typeof document === 'undefined' || !document.documentElement.requestFullscreen) return null;
  return <button className="btn quiet" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>전체 화면</button>;
}
