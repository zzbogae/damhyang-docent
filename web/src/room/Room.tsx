// 나의 방 v0: 같은 이름을 다섯 주에 붙이면 열린다. 꾸미지 않고 배치만 한다.
// 벽 액자 = 그 주들에 찍은 사진(필터 통과분), 책상 위 다이어리 = 그 주들에 쓴 글, 선반 = 주마다 광물 표본 하나.
// 시점은 고정하고 마우스를 따라 조금만 움직인다(멀미 방지). 외부 글꼴·환경맵을 불러오지 않는다.
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { createXRStore, XR, useXR } from '@react-three/xr';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { db } from '../db';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { selectRelic } from '../relic/select';
import type { MemoRecord, WeekRecord } from '../types';

const MINERAL_HEX: Record<string, string> = { 호박: '#a86a12', 청금석: '#2c5c8a', 자수정: '#6f5a8f', 흑요석: '#2b2931' };

// WebXR: 실제 헤드셋 브라우저(퀘스트 등)에서만 "VR로 보기"가 보인다. 주소에 ?xr-emulate 가 있으면 데스크톱에서
// IWER 에뮬레이터로 시험한다(합성 환경은 끔: 외부에서 3D 파일을 받지 않게). 시점 고정·이동 없음(멀미 방지).
const xrEmulate = typeof location !== 'undefined' && new URLSearchParams(location.search).has('xr-emulate');
if (xrEmulate && typeof navigator !== 'undefined' && 'xr' in navigator) {
  // 데스크톱 크롬은 헤드셋이 없어도 navigator.xr 을 노출해서 에뮬레이터가 설치를 건너뛴다. 시험 모드에서만 가린다.
  try { Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true, writable: true }); } catch { /* 무시 */ }
}
const xrStore = createXRStore({
  emulate: xrEmulate ? { type: 'metaQuest3', syntheticEnvironment: false } : false,
  offerSession: false,
  controller: { teleportPointer: false },
  hand: { teleportPointer: false },
});

/** 가상현실 안에서 보이는 글판: 기기 글꼴로 캔버스에 글을 그려 텍스처로 쓴다(외부 글꼴을 받지 않음). */
function TextBoard({ title, lines }: { title: string; lines: string[] }) {
  const tex = useMemo(() => {
    const W = 1024, H = 640;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fbfaf8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5d5966'; g.font = '32px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    g.fillText(title, 48, 72);
    g.fillStyle = '#16151a'; g.font = '38px "Apple SD Gothic Neo", "Malgun Gothic", serif';
    let y = 140;
    for (const raw of lines) {
      let line = '';
      for (const ch of raw) {
        if (g.measureText(line + ch).width > W - 96) { g.fillText(line, 48, y); y += 54; line = ''; if (y > H - 40) break; }
        line += ch;
      }
      if (y > H - 40) break;
      g.fillText(line, 48, y); y += 70;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [title, lines]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 1.45, -1.0]}>
      <planeGeometry args={[1.2, 0.75]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Rig() {
  const { camera, pointer } = useThree();
  const inXR = useXR((x) => x.session != null);
  const base = useRef(new THREE.Vector3(0, 1.55, 4.2));
  useFrame(() => {
    if (inXR) return;
    camera.position.x += (base.current.x + pointer.x * 0.25 - camera.position.x) * 0.05;
    camera.position.y += (base.current.y + pointer.y * 0.12 - camera.position.y) * 0.05;
    camera.lookAt(0, 1.2, 0);
  });
  return null;
}

function Frame({ x, y, url, color, label, onOpen }: { x: number; y: number; url?: string; color: string; label: string; onOpen: () => void }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!url) return;
    const t = new THREE.TextureLoader().load(url, () => setTex(t));
    t.colorSpace = THREE.SRGBColorSpace;
    return () => t.dispose();
  }, [url]);
  return (
    <group position={[x, y, -1.97]}>
      <mesh castShadow>
        <boxGeometry args={[0.78, 0.6, 0.04]} />
        <meshStandardMaterial color={hover ? '#5d5966' : '#3b3842'} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.025]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        onClick={onOpen}>
        <planeGeometry args={[0.68, 0.5]} />
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.9} />}
      </mesh>
      <Html position={[0, -0.42, 0]} center distanceFactor={6} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <span className="room-cap">{label}</span>
      </Html>
    </group>
  );
}

/** 광물 표본: 판정 모양(각진=팔면체, 둥근=십이면체, 다이아몬드=세로로 늘인 팔면체)을 그대로 쓴다. */
function Crystal({ x, color, shape }: { x: number; color: string; shape: string | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.25; });
  return (
    <mesh ref={ref} position={[x, 1.58, -1.72]} scale={shape === 'diamond' ? [0.8, 1.5, 0.8] : [1, 1, 1]} castShadow>
      {shape === 'round' ? <dodecahedronGeometry args={[0.085, 0]} /> : <octahedronGeometry args={[0.09, 0]} />}
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} flatShading />
    </mesh>
  );
}

function Scene({ weeks, thumbs, onDiary, onAlbum, onFrame, board }: {
  weeks: WeekRecord[]; thumbs: Map<string, string>; onDiary: () => void; onAlbum: () => void; onFrame: (w: WeekRecord) => void;
  board: { title: string; lines: string[] } | null;
}) {
  const inXR = useXR((x) => x.session != null);
  const frames = weeks.slice(0, 5);
  const [hover, setHover] = useState<'diary' | 'album' | null>(null);
  const hoverProps = (k: 'diary' | 'album') => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(k); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { setHover(null); document.body.style.cursor = ''; },
  });
  return (
    <>
      <color attach="background" args={['#fbfaf8']} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={['#fffaf2', '#d9cfc0', 0.5]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <Rig />
      {inXR && board && <TextBoard title={board.title} lines={board.lines} />}
      {/* 바닥·벽 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#d9cfc0" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.6, -2]} receiveShadow>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#f3f1ed" roughness={1} />
      </mesh>
      <mesh position={[-3, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 3.2]} />
        <meshStandardMaterial color="#efebe4" roughness={1} />
      </mesh>
      {/* 액자 */}
      {frames.map((w, i) => (
        <Frame key={w.week} x={-1.7 + i * 0.85} y={2.25} url={thumbs.get(w.week)} color={MINERAL_HEX[w.mineral ?? '호박'] ?? '#c8bba8'}
          label={w.date_start.slice(0, 7).replace('-', '.')} onOpen={() => onFrame(w)} />
      ))}
      {/* 선반과 광물 표본 */}
      <mesh position={[0, 1.48, -1.78]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.05, 0.36]} />
        <meshStandardMaterial color="#c8bba8" roughness={0.8} />
      </mesh>
      {weeks.map((w, i) => <Crystal key={w.week} x={-1.1 + (i * 2.2) / Math.max(1, weeks.length - 1)} color={MINERAL_HEX[w.mineral ?? '호박'] ?? '#a86a12'} shape={w.shape} />)}
      {/* 책상 */}
      <mesh position={[0.9, 0.72, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.06, 0.8]} />
        <meshStandardMaterial color="#b8a58a" roughness={0.7} />
      </mesh>
      {[[-0.72, -0.32], [0.72, -0.32], [-0.72, 0.32], [0.72, 0.32]].map(([dx, dz], k) => (
        <mesh key={k} position={[0.9 + dx, 0.36, -1.2 + dz]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshStandardMaterial color="#8f7d63" />
        </mesh>
      ))}
      {/* 다이어리 */}
      <group position={[0.55, 0.78, -1.1]} rotation={[0, 0.25, 0]} onClick={onDiary} {...hoverProps('diary')}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.06, 0.3]} />
          <meshStandardMaterial color={hover === 'diary' ? '#c98a2c' : '#a86a12'} roughness={0.5} />
        </mesh>
        <mesh position={[0.012, 0.031, 0]}>
          <boxGeometry args={[0.38, 0.004, 0.27]} />
          <meshStandardMaterial color="#fbfaf8" />
        </mesh>
      </group>
      {/* 앨범 */}
      <group position={[1.25, 0.8, -1.25]} rotation={[0, -0.2, 0]} onClick={onAlbum} {...hoverProps('album')}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.1, 0.3]} />
          <meshStandardMaterial color={hover === 'album' ? '#3d6f9e' : '#2c5c8a'} roughness={0.55} />
        </mesh>
      </group>
    </>
  );
}

export default function Room({ name, onClose }: { name: string; onClose: () => void }) {
  const { labels, byKey, memosByWeek, photosByWeek } = useStore();
  const weeks = useMemo(() => {
    const ks = [...new Set(labels.filter((l) => l.name === name).map((l) => l.week))];
    return ks.map((k) => byKey.get(k)).filter((w): w is WeekRecord => !!w).sort((a, b) => a.week.localeCompare(b.week));
  }, [labels, name, byKey]);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [album, setAlbum] = useState<{ week: string; url: string }[]>([]);
  const [panel, setPanel] = useState<{ kind: 'diary' | 'album' | 'week'; week?: WeekRecord } | null>(null);
  const [vrOK, setVrOK] = useState(false);
  const [inVR, setInVR] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = !!(await (navigator as any).xr?.isSessionSupported?.('immersive-vr').catch(() => false));
      if (alive) setVrOK(ok);
      return ok;
    };
    check();
    // 에뮬레이터는 조금 늦게 끼워진다. 끼워지면 스토어에 emulator 가 생긴다
    if ((xrStore.getState() as any).emulator) setVrOK(true);
    const unsub = xrStore.subscribe((st) => {
      setInVR(st.session != null);
      if ((st as any).emulator) setVrOK(true);
    });
    return () => { alive = false; unsub(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    (async () => {
      const first = new Map<string, string>();
      const all: { week: string; url: string }[] = [];
      for (const w of weeks) {
        const ps = (photosByWeek.get(w.week) ?? []).filter((p) => p.filter?.status === 'ok');
        const ths = await db.thumbs.bulkGet(ps.map((p) => p.id));
        for (const t of ths) {
          if (!t || t.blurred) continue;
          const u = URL.createObjectURL(t.blob);
          urls.push(u);
          all.push({ week: w.week, url: u });
          if (!first.has(w.week)) first.set(w.week, u);
        }
      }
      if (alive) { setThumbs(first); setAlbum(all); }
    })();
    return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [weeks, photosByWeek]);

  const diary = useMemo(() => {
    const out: { w: WeekRecord; memos: MemoRecord[]; gated: Set<string> }[] = [];
    for (const w of weeks) {
      const all = memosByWeek.get(w.week) ?? [];
      const sel = selectRelic(w, all, [], { maxMemos: 3 });
      const byId = new Map(all.map((m) => [m.id, m]));
      out.push({ w, memos: sel.memo_ids.map((id) => byId.get(id)!).filter(Boolean), gated: new Set(sel.gated_memo_ids) });
    }
    return out;
  }, [weeks, memosByWeek]);

  const board = useMemo(() => {
    if (!panel) return null;
    if (panel.kind === 'diary') {
      const lines = diary.flatMap(({ w, memos, gated }) => memos.filter((m) => !gated.has(m.id)).slice(0, 1).map((m) => `${w.date_start.slice(0, 7).replace('-', '.')} · ${m.text}`));
      return { title: '다이어리', lines: lines.length ? lines.slice(0, 6) : ['이 방에 놓인 글이 없습니다.'] };
    }
    if (panel.kind === 'week' && panel.week) return { title: rangeLabel(panel.week), lines: [panel.week.sentence ?? '이 주는 평소 범위 안에 있었습니다.'] };
    return { title: '앨범', lines: [`사진 ${album.length}장. 사진은 헤드셋을 벗고 앨범에서 보실 수 있습니다.`] };
  }, [panel, diary, album.length]);

  return (
    <div className="room">
      <div className="room-bar">
        <h2 className="section-title">나의 방 · {name}</h2>
        <p className="lede">"{name}"이라고 이름 붙인 {weeks.length}주의 기록을 배치했습니다. 새로 만든 것은 없습니다.</p>
        <div className="room-actions">
          <button className="btn" onClick={() => setPanel({ kind: 'diary' })}>다이어리 펼치기</button>
          <button className="btn" onClick={() => setPanel({ kind: 'album' })}>앨범 보기 ({album.length})</button>
          {vrOK && (
            <button className="btn" onClick={async () => {
              if (inVR) { xrStore.getState().session?.end(); return; }
              await xrStore.enterVR();
            }}>{inVR ? 'VR에서 나오기' : 'VR로 보기'}</button>
          )}
          <button className="btn quiet" onClick={onClose}>방에서 나가기</button>
        </div>
      </div>
      <div className="room-stage">
        <Canvas flat shadows dpr={[1, 2]} camera={{ position: [0, 1.55, 4.2], fov: 42 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <XR store={xrStore}>
            <Scene weeks={weeks} thumbs={thumbs} board={board}
              onDiary={() => setPanel({ kind: 'diary' })}
              onAlbum={() => setPanel({ kind: 'album' })}
              onFrame={(w) => setPanel({ kind: 'week', week: w })} />
          </XR>
        </Canvas>
        {inVR && <p className="sr-only" role="status">VR 화면으로 들어갔습니다</p>}
        {panel && (
          <aside className="room-panel" aria-label={panel.kind === 'diary' ? '다이어리' : panel.kind === 'album' ? '앨범' : '액자'}>
            <button className="btn quiet room-close" onClick={() => setPanel(null)}>닫기</button>
            {panel.kind === 'diary' && diary.map(({ w, memos, gated }) => (
              <section key={w.week} className="room-page">
                <p className="when">{rangeLabel(w)}</p>
                {memos.length === 0 && <p className="muted small">이 주에 남은 글이 없습니다.</p>}
                {memos.map((m) => <p key={m.id} className={`text${gated.has(m.id) ? ' veiled' : ''}`}>{gated.has(m.id) ? '마음이 힘들 때 쓴 것처럼 보이는 글이라 방에서는 가려 둡니다. 주 화면에서 열 수 있습니다.' : m.text}</p>)}
              </section>
            ))}
            {panel.kind === 'album' && (album.length ? (
              <div className="photos">{album.map((a, i) => <figure key={i}><img src={a.url} alt={`${a.week}에 찍은 사진`} /></figure>)}</div>
            ) : <p className="muted">필터를 거친 사진이 아직 없습니다. 주 화면에서 사진을 한 번 열면 여기에 놓입니다.</p>)}
            {panel.kind === 'week' && panel.week && (
              <section className="room-page">
                <p className="when">{rangeLabel(panel.week)}</p>
                <p className="text">{panel.week.sentence ?? '이 주는 평소 범위 안에 있었습니다.'}</p>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
