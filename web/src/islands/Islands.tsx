// 이어진 섬 설계 시연(계획서 3-4). 실제 연결은 만들지 않고, 가상 이웃으로 무엇이 보이고 무엇이 보이지 않아야 하는지를 보여 준다.
// 안전선: 남의 원문은 보이지 않음 · 방문은 초대로만 · 순위·비교·랭킹 없음.
// 잇는 기준은 "공개한 방 이름"(권장)이 기본이고, 원페이지 원안인 "광물 분포"는 왜 상태 기준이 되는지와 함께 비교용으로만 보여 준다.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';

const MINERALS = ['호박', '청금석', '자수정', '흑요석'] as const;
type Mineral = (typeof MINERALS)[number];
const MINERAL_HEX: Record<Mineral, string> = { 호박: '#a86a12', 청금석: '#2c5c8a', 자수정: '#6f5a8f', 흑요석: '#2b2931' };

interface NeighborRoom { name: string; specimens: number; minerals: Record<Mineral, number> }
interface Neighbor {
  id: string;
  nickname: string;
  invite_code: string;
  rooms: NeighborRoom[];
  minerals: Record<Mineral, number>;
  guestbook: { from: string; text: string }[];
}
interface Demo { notice: string; fake: boolean; neighbors: Neighbor[] }

type Criterion = 'rooms' | 'minerals';

const SLOTS: [number, number][] = [[150, 108], [610, 108], [150, 318], [610, 318]];
const ME: [number, number] = [380, 214];

function norm(s: string) { return s.normalize('NFC').replace(/\s+/g, ' ').trim(); }

function cosine(a: Record<Mineral, number>, b: Record<Mineral, number>) {
  let ab = 0, aa = 0, bb = 0;
  for (const m of MINERALS) { ab += a[m] * b[m]; aa += a[m] * a[m]; bb += b[m] * b[m]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** 광물 분포가 이만큼 비슷하면 원안은 섬을 잇는다(화면에는 점수를 보이지 않는다). */
const MINERAL_BRIDGE = 0.9;

function useSession<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const s = sessionStorage.getItem(key); return s ? (JSON.parse(s) as T) : init; } catch { return init; }
  });
  return [v, (x: T) => { setV(x); try { sessionStorage.setItem(key, JSON.stringify(x)); } catch { /* 무시 */ } }];
}

/** 섬 모양: 가운데를 기준으로 조금씩 흔든 둥근 다각형(같은 id 는 늘 같은 모양). */
function islandPath(cx: number, cy: number, r: number, seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const k = 0.82 + ((h >>> 8) % 1000) / 1000 * 0.3;
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r * 1.25 * k, cy + Math.sin(a) * r * 0.8 * k]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    d += i === 0 ? `M ${mx} ${my} ` : '';
    const [x2, y2] = pts[(i + 1) % n];
    const [x3, y3] = pts[(i + 2) % n];
    d += `Q ${x2} ${y2} ${(x2 + x3) / 2} ${(y2 + y3) / 2} `;
    void x1; void y1;
  }
  return d + 'Z';
}

function Specimens({ cx, cy, counts, colored, max = 18 }: { cx: number; cy: number; counts: Record<Mineral, number>; colored: boolean; max?: number }) {
  const list: Mineral[] = [];
  for (const m of MINERALS) for (let i = 0; i < counts[m]; i++) list.push(m);
  const shown = list.slice(0, max);
  const cols = 6;
  return (
    <g aria-hidden="true">
      {shown.map((m, i) => {
        const x = cx - ((Math.min(shown.length, cols) - 1) * 11) / 2 + (i % cols) * 11;
        const y = cy + 6 + Math.floor(i / cols) * 11;
        return <rect key={i} x={x - 3.5} y={y - 3.5} width={7} height={7} transform={`rotate(45 ${x} ${y})`}
          fill={colored ? MINERAL_HEX[m] : '#5d5966'} opacity={colored ? 1 : 0.7} />;
      })}
      {list.length > max && <text x={cx} y={cy + 6 + Math.ceil(max / cols) * 11 + 6} textAnchor="middle" className="isl-more">+{list.length - max}</text>}
    </g>
  );
}

export default function Islands({ onClose }: { onClose: () => void }) {
  const { labels, weeks } = useStore();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [err, setErr] = useState('');
  const [published, setPublished] = useSession<string[]>('mined:islands:published', []);
  const [invites, setInvites] = useSession<string[]>('mined:islands:invites', []);
  const [criterion, setCriterion] = useSession<Criterion>('mined:islands:criterion', 'rooms');
  const [notes, setNotes] = useSession<Record<string, string[]>>('mined:islands:guestbook', {});
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [visiting, setVisiting] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'islands/demo.json')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setDemo)
      .catch(() => setErr('시연 데이터를 불러오지 못했습니다.'));
  }, []);

  // 내 섬: 붙인 이름(방)과 판정된 주의 광물
  const myRooms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of labels) { const n = norm(l.name); if (!m.has(n)) m.set(n, new Set()); m.get(n)!.add(l.week); }
    return [...m.entries()].map(([name, ws]) => ({ name, weeks: [...ws] })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [labels]);
  const mineralOf = useMemo(() => new Map(weeks.filter((w) => w.candidate && w.mineral).map((w) => [w.week, w.mineral as Mineral])), [weeks]);
  const myMinerals = useMemo(() => {
    const c = { 호박: 0, 청금석: 0, 자수정: 0, 흑요석: 0 } as Record<Mineral, number>;
    for (const m of mineralOf.values()) c[m]++;
    return c;
  }, [mineralOf]);
  const pubRooms = myRooms.filter((r) => published.includes(r.name));
  const pubSpecimens = pubRooms.reduce((s, r) => s + r.weeks.length, 0);
  const pubCounts = useMemo(() => {
    const c = { 호박: 0, 청금석: 0, 자수정: 0, 흑요석: 0 } as Record<Mineral, number>;
    for (const r of pubRooms) for (const w of r.weeks) { const m = mineralOf.get(w); if (m) c[m]++; else c['호박'] += 0; }
    return c;
  }, [pubRooms, mineralOf]);
  // 공개한 방 표본 수(판정되지 않은 주는 광물이 없어 무늬 없는 표본으로 센다)
  const plainSpecimens = pubSpecimens - MINERALS.reduce((s, m) => s + pubCounts[m], 0);

  const neighbors = useMemo(() => {
    if (!demo) return [];
    return invites.map((c) => demo.neighbors.find((n) => n.invite_code === c)).filter((n): n is Neighbor => !!n);
  }, [demo, invites]);

  const bridges = useMemo(() => neighbors.map((n) => {
    if (criterion === 'rooms') {
      const mine = new Set(pubRooms.map((r) => r.name));
      const shared = n.rooms.map((r) => norm(r.name)).filter((x) => mine.has(x));
      return { id: n.id, on: shared.length > 0, shared };
    }
    return { id: n.id, on: cosine(myMinerals, n.minerals) >= MINERAL_BRIDGE, shared: [] as string[] };
  }), [neighbors, criterion, pubRooms, myMinerals]);

  function accept() {
    const c = code.trim().toUpperCase();
    setCodeMsg('');
    if (!c) return;
    const n = demo?.neighbors.find((x) => x.invite_code === c);
    if (!n) { setCodeMsg('이 코드로 초대한 이웃이 없습니다. 코드를 다시 확인해 주세요.'); return; }
    if (invites.includes(c)) { setCodeMsg(`${n.nickname} 님은 이미 이웃입니다.`); return; }
    if (invites.length >= SLOTS.length) { setCodeMsg('시연에서는 이웃을 네 명까지만 둡니다.'); return; }
    setInvites([...invites, c]);
    setCode('');
    setCodeMsg(`${n.nickname} 님의 초대를 받았습니다.`);
  }

  const visit = neighbors.find((n) => n.id === visiting) ?? null;
  const visitBridge = bridges.find((b) => b.id === visiting);

  const mapLabel = neighbors.length
    ? `내 섬과 이웃 섬 ${neighbors.length}곳. ${bridges.filter((b) => b.on).length}곳과 다리가 놓였습니다.`
    : '내 섬만 있습니다. 초대받은 이웃이 없습니다.';

  return (
    <div className="islands">
      <header className="isl-head">
        <div>
          <div className="isl-title-row">
            <h2 className="section-title">이어진 섬</h2>
            <span className="isl-demo" role="note">설계 시연 · 가상 이웃</span>
          </div>
          <p className="lede">실제 연결은 아직 없습니다. 이웃과 이어질 때 무엇이 보이고 무엇이 보이지 않아야 하는지를 가상 이웃으로 보여 드립니다.</p>
          {demo?.notice && <p className="small muted">{demo.notice}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </div>
        <button className="btn quiet" onClick={onClose}>돌아가기</button>
      </header>

      <div className="isl-body">
        <section className="isl-map" aria-label="섬 지도">
          <svg viewBox="0 0 760 420" role="img" aria-label={mapLabel}>
            <rect x="0" y="0" width="760" height="420" rx="16" fill="#eef1f2" />
            {neighbors.map((n, i) => {
              const b = bridges.find((x) => x.id === n.id)!;
              if (!b.on) return null;
              const [x, y] = SLOTS[i];
              const mx = (x + ME[0]) / 2, my = (y + ME[1]) / 2;
              return (
                <g key={`b-${n.id}`}>
                  <line x1={ME[0]} y1={ME[1]} x2={x} y2={y} stroke="#8f7d63" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" />
                  {criterion === 'rooms' && (
                    <text x={mx} y={my - 8} textAnchor="middle" className="isl-bridge">{b.shared.join(' · ')}</text>
                  )}
                </g>
              );
            })}
            <g>
              <path d={islandPath(ME[0], ME[1], 70, 'me')} fill="#d9cfc0" stroke="#c8bba8" strokeWidth="2" />
              <text x={ME[0]} y={ME[1] - 22} textAnchor="middle" className="isl-name">내 섬</text>
              <Specimens cx={ME[0]} cy={ME[1]} colored={criterion === 'minerals'}
                counts={criterion === 'minerals' ? myMinerals : { ...pubCounts, 호박: pubCounts['호박'] + plainSpecimens }} />
            </g>
            {neighbors.map((n, i) => {
              const [x, y] = SLOTS[i];
              const total = n.rooms.reduce((s, r) => s + r.specimens, 0);
              const plain = { 호박: total, 청금석: 0, 자수정: 0, 흑요석: 0 } as Record<Mineral, number>;
              return (
                <g key={n.id} className={`isl-node${visiting === n.id ? ' on' : ''}`} onClick={() => setVisiting(n.id)} style={{ cursor: 'pointer' }}>
                  <path d={islandPath(x, y, 52, n.id)} fill={visiting === n.id ? '#e6dfd4' : '#efebe4'} stroke="#c8bba8" strokeWidth="2" />
                  <text x={x} y={y - 16} textAnchor="middle" className="isl-name">{n.nickname}</text>
                  <Specimens cx={x} cy={y} colored={criterion === 'minerals'} counts={criterion === 'minerals' ? n.minerals : plain} max={12} />
                </g>
              );
            })}
          </svg>
          <p className="small muted">이웃은 초대를 받은 순서대로 놓습니다. 닮음 점수·순위·정렬은 두지 않습니다.</p>
        </section>

        <aside className="isl-side">
          <section>
            <h3 className="h3">내 섬에서 공개할 방</h3>
            {myRooms.length === 0 && <p className="muted small">아직 이름을 붙인 주가 없습니다. 주 화면에서 이름을 붙이면 여기서 방으로 고를 수 있습니다.</p>}
            <div className="isl-rooms">
              {myRooms.map((r) => (
                <label className="toggle" key={r.name}>
                  <input type="checkbox" checked={published.includes(r.name)}
                    onChange={(e) => setPublished(e.target.checked ? [...published, r.name] : published.filter((x) => x !== r.name))} />
                  <span><span className="t">{r.name}</span> <span className="d">{r.weeks.length}주{r.weeks.length < 5 ? ' · 방은 5주부터 열림' : ''}</span></span>
                </label>
              ))}
            </div>
            <p className="isl-preview" aria-live="polite">
              {pubRooms.length === 0
                ? '아직 아무것도 공개하지 않았습니다. 이웃에게는 별명만 보입니다.'
                : `이웃에게 보이는 것: 방 이름 ${pubRooms.length}개, 광물 표본 ${pubSpecimens}개. 글·사진·날짜는 보이지 않습니다.`}
            </p>
          </section>

          <section>
            <h3 className="h3">섬을 잇는 기준</h3>
            <div className="isl-criteria" role="radiogroup" aria-label="섬을 잇는 기준">
              <label className="toggle">
                <input type="radio" name="crit" checked={criterion === 'rooms'} onChange={() => setCriterion('rooms')} />
                <span><span className="t">공개한 방 이름으로 잇기 (권장)</span><br /><span className="d">서로 공개한 방 가운데 이름이 같은 방이 있을 때만 다리를 놓습니다.</span></span>
              </label>
              <label className="toggle">
                <input type="radio" name="crit" checked={criterion === 'minerals'} onChange={() => setCriterion('minerals')} />
                <span><span className="t">광물 분포로 잇기 (원안, 비교용)</span><br /><span className="d">판정된 주의 광물 비율이 비슷한 섬끼리 다리를 놓습니다.</span></span>
              </label>
            </div>
            {criterion === 'minerals' && (
              <p className="help small" role="note">
                광물은 판정 패턴에서 계산되므로, 광물 분포가 비슷한 사람끼리 잇는 것은 결국 비슷한 상태의 주를 겪은 사람끼리 잇는 것이 됩니다.
                이 방식에서는 공개하지 않은 주의 광물까지 이웃에게 드러납니다.
              </p>
            )}
          </section>

          <section>
            <h3 className="h3">초대 코드로 이웃 받기</h3>
            <form className="label-row" onSubmit={(e) => { e.preventDefault(); accept(); }}>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: MINE-0000" aria-label="초대 코드" maxLength={16} />
              <button className="btn" type="submit" disabled={!code.trim() || !demo}>받기</button>
            </form>
            {codeMsg && <p className="small" aria-live="polite" style={{ marginTop: 6 }}>{codeMsg}</p>}
            {demo && <p className="small muted" style={{ marginTop: 6 }}>시연용 가상 이웃 코드: {demo.neighbors.map((n) => n.invite_code).join(', ')}</p>}
            {neighbors.length === 0 ? (
              <p className="muted small" style={{ marginTop: 8 }}>초대받은 이웃이 없습니다. 초대 코드가 있어야 이웃 섬이 보입니다.</p>
            ) : (
              <ul className="isl-list" aria-label="이웃">
                {neighbors.map((n) => {
                  const b = bridges.find((x) => x.id === n.id)!;
                  return (
                    <li key={n.id}>
                      <span><b>{n.nickname}</b> <span className="small muted">{b.on ? (criterion === 'rooms' ? `다리: ${b.shared.join(' · ')}` : '다리 있음') : '다리 없음'}</span></span>
                      <span className="isl-actions">
                        <button className="btn" onClick={() => setVisiting(n.id)}>섬에 들르기</button>
                        <button className="btn quiet" onClick={() => { setInvites(invites.filter((c) => c !== n.invite_code)); if (visiting === n.id) setVisiting(null); }}>이웃 끊기</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {visit && (
            <section className="isl-visit" aria-label={`${visit.nickname} 님의 섬`}>
              <div className="isl-visit-head">
                <h3 className="h3">{visit.nickname} 님의 섬</h3>
                <button className="btn quiet" onClick={() => setVisiting(null)}>섬에서 나오기</button>
              </div>
              <p className="small muted">이웃이 공개하기로 고른 것만 보입니다. 그 사람의 글·사진·날짜·판정 문장은 보이지 않습니다.</p>
              <ul className="badges">
                {visit.rooms.map((r) => (
                  <li key={r.name}>
                    <span>{r.name}{visitBridge?.shared.includes(norm(r.name)) ? ' · 나와 같은 이름' : ''}</span>
                    <span className="dir">광물 표본 {r.specimens}개</span>
                  </li>
                ))}
              </ul>
              {criterion === 'minerals' && (
                <p className="small" style={{ marginTop: 8 }}>
                  원안에서 드러나는 광물 분포: {MINERALS.map((m) => `${m} ${visit.minerals[m]}`).join(' · ')}
                </p>
              )}
              <h4 className="isl-gb">방명록</h4>
              {[...visit.guestbook.map((g) => `${g.from}: ${g.text}`), ...(notes[visit.id] ?? []).map((t) => `나: ${t}`)].map((t, i) => (
                <p key={i} className="isl-note">{t}</p>
              ))}
              {visit.guestbook.length + (notes[visit.id]?.length ?? 0) === 0 && <p className="muted small">아직 남긴 글이 없습니다.</p>}
              <form className="label-row" onSubmit={(e) => {
                e.preventDefault();
                const t = draft.trim();
                if (!t) return;
                setNotes({ ...notes, [visit.id]: [...(notes[visit.id] ?? []), t] });
                setDraft('');
              }}>
                <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="짧은 인사를 남겨 주세요" aria-label="방명록에 남길 글" maxLength={60} />
                <button className="btn" type="submit" disabled={!draft.trim()}>남기기</button>
              </form>
              <p className="small muted" style={{ marginTop: 6 }}>시연이라 방명록 글은 이 브라우저 창에만 남고, 창을 닫으면 사라집니다.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
