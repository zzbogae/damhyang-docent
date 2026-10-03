// 주 상세: 판정 문장 → 4축 게이지 → 채널 → 그때 쓴 글·찍은 사진 → 닮은 주 → 이름 붙이기.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { AXES, axisScreen, CHANNEL_LABEL, CHANNELS, type Badge, type Grade, type MemoRecord, type WeekRecord } from '../types';
import { gradeText, rangeLabel, sameDirectionText } from '../mindi/templates';
import { ScreenReadButton } from './ScreenRead';
import { GyeolChip } from './Gyeol';
import { useEn } from '../i18n/useEn';
import { weekSentenceEn } from '../i18n/en';
import { MindiAsk } from './MindiAsk';
import { IconCheck, IconEye, IconHalf, IconNone } from './Icons';
import { selectRelic } from '../relic/select';
import { checkWeekPhotos, orderPhotos, type WeekPhotoResult } from '../photos/service';
import { groupSimilar } from '../photos/similar';
import { LABEL as LABELS } from './format';

import { MINERAL_COLOR } from './minerals';
import { MINERAL_IMG, ART } from './design';
import { playCue } from '../mindi/sound';
const GRADE_SHORT: Partial<Record<Grade, string>> = {
  open: '아직 확인 전', returned: '돌아옴, 그 뒤 미확인', held: '그 뒤도 평소 범위', insufficient: '기록이 비어 알 수 없음',
  broken: '돌아옴, 다시 벗어남',
};
const ORD = ['', '', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function rankText(b: Badge) {
  if (b.pct_text) return `${b.pct_text} (팀 v6 표기)`;
  const r = b.rank === 1 ? '가장' : b.rank <= 10 ? `${ORD[b.rank]} 번째로` : `${b.rank}번째로`;
  const dir = b.direction === 'up' ? '많음' : '적음';
  return `직전 ${b.n_base}주 중 ${r} ${dir}`;
}

function whenText(m: MemoRecord) {
  const d = new Date(m.ts + ':00');
  const h = m.hour;
  const part = h < 5 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = m.ts.slice(14, 16);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]}) ${part} ${hh}시 ${mm}분`;
}

function Gauges({ w }: { w: WeekRecord }) {
  return (
    <div className="gauges" role="list" aria-label="4축 게이지">
      {AXES.map((ax) => {
        const a = w.axes[ax];
        if (!a) {
          return (
            <div className="gauge none" role="listitem" key={ax}>
              <span className="name">{axisScreen(ax)}</span>
              <div className="track" aria-hidden="true" />
              <span className="word">기록 없음</span>
            </div>
          );
        }
        const pos = Math.max(2, Math.min(98, a.pr * 100));
        const word = a.pr <= 0.1 ? '평소보다 적음' : a.pr >= 0.9 ? '평소보다 많음' : a.pr < 0.25 ? '조금 적음' : a.pr > 0.75 ? '조금 많음' : '평소';
        const cls = a.pr <= 0.1 ? 'down' : a.pr >= 0.9 ? 'up' : '';
        return (
          <div className="gauge" role="listitem" key={ax} aria-label={`${axisScreen(ax)}: ${word}`}>
            <span className="name">{axisScreen(ax)}</span>
            <div className="track" aria-hidden="true">
              <div className="usual" />
              <div className={`needle ${cls}`} style={{ left: `${pos}%` }} />
            </div>
            <span className="word">{word}{a.via === 'quiet' && <small className="muted"> · 밤 기록 공백으로 봄</small>}</span>
          </div>
        );
      })}
      <p className="small muted">가운데 옅은 띠가 직전 1년 동안의 내 평소 범위입니다. 남과 비교하지 않습니다.</p>
    </div>
  );
}

function Coverage({ w }: { w: WeekRecord }) {
  const word = { observed: '있음', partial: '일부', structural_missing: '없음' } as const;
  return (
    <div className="cov" aria-label="이 주에 가져온 기록">
      {CHANNELS.map((ch) => {
        const c = w.coverage[ch];
        return (
          <span key={ch} className={c}>
            {c === 'observed' ? <IconCheck /> : c === 'partial' ? <IconHalf /> : <IconNone />}
            {CHANNEL_LABEL[ch]} {word[c]}
          </span>
        );
      })}
    </div>
  );
}

function Memos({ w, locked }: { w: WeekRecord; locked: boolean }) {
  const { memosByWeek } = useStore();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { memos, hiddenSecret, gated } = useMemo(() => {
    const all = memosByWeek.get(w.week) ?? [];
    const sel = selectRelic(w, all, []);
    const byId = new Map(all.map((m) => [m.id, m]));
    return {
      memos: sel.memo_ids.map((id) => byId.get(id)!).filter(Boolean).sort((a, b) => a.ts.localeCompare(b.ts)),
      hiddenSecret: sel.hidden.secret ?? 0,
      gated: new Set(sel.gated_memo_ids),
    };
  }, [w, memosByWeek]);
  const crisis = memos.filter((m) => gated.has(m.id)).length;
  if (locked) return null;
  if (!memos.length && !hiddenSecret) return <p className="muted">이 주에 남은 메모가 없습니다.</p>;
  return (
    <div>
      {crisis > 0 && (
        // 판정처럼 들리지 않게 사실만 말한다. 도움 안내(109)는 이 자리가 아니라 모든 화면 아래쪽에 늘 있다.
        <p className="small muted" role="note" style={{ marginBottom: 8 }}>
          가려 둔 글이 {crisis}개 있습니다. 누르면 열립니다.
        </p>
      )}
      {memos.map((m) => {
        const veiled = gated.has(m.id) && !open.has(m.id);
        return (
          <article className={`memo${veiled ? ' veiled' : ''}`} key={m.id}>
            <p className="when">{whenText(m)}</p>
            <p className="text" aria-hidden={veiled}>{m.text}</p>
            {veiled && <button className="linkish" onClick={() => setOpen(new Set(open).add(m.id))}>이 글 열어 보기</button>}
          </article>
        );
      })}
      {hiddenSecret > 0 && <p className="small muted" style={{ marginTop: 8 }}>비밀번호나 계좌번호처럼 보이는 메모 {hiddenSecret}개는 보여 주지 않았습니다.</p>}
    </div>
  );
}

function Photos({ w, locked }: { w: WeekRecord; locked: boolean }) {
  const { photosByWeek } = useStore();
  const photos = photosByWeek.get(w.week) ?? [];
  const [res, setRes] = useState<WeekPhotoResult>();
  const [prog, setProg] = useState<[number, number]>([0, 0]);
  const [showFaces, setShowFaces] = useState(false);
  const [retry, setRetry] = useState(0);
  const [batch, setBatch] = useState(24);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const groups = useMemo(() => (res ? groupSimilar(res.shown) : []), [res]);
  const folded = groups.reduce((a, g) => a + g.members.length - 1, 0);
  useEffect(() => {
    setRes(undefined); setShowFaces(false); setOpen(new Set());
    if (locked || !photos.length) return;
    let alive = true;
    const ordered = orderPhotos(photos, w.badges.some((b) => b.indicator === 'photo_night' && b.direction === 'up'));
    checkWeekPhotos(ordered, (d, t) => alive && setProg([d, t]), { limit: batch }).then((r) => alive && setRes(r));
    return () => { alive = false; };
  }, [w.week, locked, photos.length, retry, batch]);
  if (locked) return null;
  if (!photos.length) return <p className="muted">이 주에 찍은 사진이 없습니다.</p>;
  if (!res) {
    return (
      <div>
        <p className="small muted">사진 {photos.length}장을 이 기기 안에서 확인하는 중입니다{prog[1] ? ` (${prog[0]}/${prog[1]})` : ''}. 사람 얼굴이나 글자가 많은 사진은 먼저 가립니다.</p>
        <div className="photos">{photos.slice(0, 6).map((p) => <figure key={p.id} className="skeleton" />)}</div>
      </div>
    );
  }
  if (res.status === 'unavailable') {
    return <Reconnect n={photos.length} onDone={() => setRetry((x) => x + 1)} />;
  }
  const h = res.hidden;
  const notes = [
    h.face ? `사람이 찍힌 사진 ${h.face}장` : '',
    h.text ? `글자가 많은 사진 ${h.text}장` : '',
    h.screenshot ? `화면 캡처 ${h.screenshot}장` : '',
    h.error ? `확인하지 못한 사진 ${h.error}장` : '',
  ].filter(Boolean);
  return (
    <div>
      {res.shown.length > 0 ? (
        <div className="photos">
          {groups.flatMap((g) => {
            const on = open.has(g.rep.id);
            const more = g.members.length - 1;
            return (on ? g.members : [g.rep]).map((p, i) => (
              <figure key={p.id} className={more && i === 0 ? 'has-more' : undefined}>
                <img src={p.url} alt="그 주에 찍은 사진" loading="lazy" />
                {more > 0 && i === 0 && (
                  <button className="more" aria-expanded={on}
                    onClick={() => setOpen((s) => { const n = new Set(s); if (on) n.delete(g.rep.id); else n.add(g.rep.id); return n; })}>
                    {on ? '접기' : `비슷한 사진 ${more}장`}
                  </button>
                )}
              </figure>
            ));
          })}
        </div>
      ) : <p className="muted">보여 드릴 수 있는 사진이 없습니다.</p>}
      {folded > 0 && <p className="small muted" style={{ marginTop: 8 }}>거의 같은 사진 {folded}장은 한 장만 보여 드립니다. 사진 아래 버튼을 누르면 펼쳐집니다.</p>}
      {notes.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>{notes.join(', ')}은 가려 두었습니다.</p>}
      {res.faces.length > 0 && !showFaces && (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowFaces(true)}><IconEye />사람이 찍힌 사진 보기 (얼굴은 흐리게)</button>
      )}
      {showFaces && <div className="photos">{res.faces.map((p) => <figure key={p.id}><img src={p.url} alt="얼굴을 흐리게 처리한 사진" /></figure>)}</div>}
      {res.remaining > 0 && (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setBatch((b) => b + 24)}>사진 {Math.min(24, res.remaining)}장 더 확인하기 (남은 사진 {res.remaining}장)</button>
      )}
    </div>
  );
}

function Reconnect({ n, onDone }: { n: number; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { import('../importBridge').then((m) => m.hasPersistedPhotoFolder()).then(setSaved).catch(() => setSaved(false)); }, []);
  return (
    <div>
      <p className="small muted">이 주의 사진 {n}장은 지금 열 수 없습니다. {saved ? '전에 고른 사진 폴더에 다시 연결하면' : '"다시 가져오기"에서 사진 폴더를 다시 고르면'} 이 기기 안에서 확인한 뒤 보여 드립니다.</p>
      {saved && (
        <button className="btn" style={{ marginTop: 8 }} onClick={async () => {
          const m = await import('../importBridge');
          const ok = await m.reconnectPhotoFolder();
          if (ok) onDone(); else setMsg('폴더 권한을 받지 못했습니다. 다시 눌러 허용해 주세요.');
        }}>사진 폴더 다시 연결</button>
      )}
      {msg && <p className="err small">{msg}</p>}
    </div>
  );
}

function Similar({ w }: { w: WeekRecord }) {
  const { byKey, select } = useStore();
  if (!w.similar?.length) return <p className="muted">비교할 만큼 지난 기록이 쌓이지 않았습니다.</p>;
  return (
    <div className="sim">
      {w.similar.map((s) => {
        const sw = byKey.get(s.week);
        if (!sw) return null;
        return (
          <button key={s.week} onClick={() => select(s.week)}>
            <span>{rangeLabel(sw)}</span>
            <span className="muted small">{sw.candidate ? '광물이 나온 주' : '평소였던 주'}</span>
            <span className="why">{sameDirectionText(s.same_direction)} 비교한 기록 {s.shared_families}종.</span>
          </button>
        );
      })}
    </div>
  );
}

function Labels({ w }: { w: WeekRecord }) {
  const { labels, addLabel, removeLabel } = useStore();
  const [name, setName] = useState('');
  const mine = labels.filter((l) => l.week === w.week);
  const count = (n: string) => new Set(labels.filter((l) => l.name === n).map((l) => l.week)).size;
  const recent = [...new Set(labels.map((l) => l.name))].slice(-6);
  const now = Date.now();
  return (
    <div>
      <div className="labels">
        {mine.map((l) => {
          const days = (now - new Date(l.createdAt).getTime()) / 864e5;
          const fade = Math.max(0.35, 1 - days / 365);
          return (
            <span className="label-pill" key={l.id} style={{ opacity: fade }} title={`${l.createdAt.slice(0, 10)}에 붙인 이름`}>
              {l.name}
              <button className="linkish small" aria-label={`${l.name} 지우기`} onClick={() => l.id && removeLabel(l.id)}>지우기</button>
              {count(l.name) >= 5
                ? <button className="linkish small" onClick={() => window.dispatchEvent(new CustomEvent('mined:open-room', { detail: l.name }))}>나의 방 열기</button>
                : <span className="small muted">{count(l.name)}/5</span>}
            </span>
          );
        })}
        {!mine.length && <span className="muted small">아직 붙인 이름이 없습니다. 같은 이름을 다섯 주에 붙이면 나의 방이 열립니다.</span>}
      </div>
      <form className="label-row" onSubmit={(e) => { e.preventDefault(); addLabel(w.week, name); setName(''); }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="이 주에 붙일 이름" aria-label="이 주에 붙일 이름" maxLength={24} />
        <button className="btn" type="submit" disabled={!name.trim()}>붙이기</button>
      </form>
      {recent.length > 0 && (
        <div className="labels">
          {recent.map((n) => <button key={n} className="btn quiet small" onClick={() => addLabel(w.week, n)}>{n}</button>)}
        </div>
      )}
    </div>
  );
}

function EpisodeLine({ w }: { w: WeekRecord }) {
  const { result, byKey, select } = useStore();
  const ep = w.episode ? result?.episodes?.find((e) => e.id === w.episode) : undefined;
  if (!ep) return null;
  const [y1, m1, d1] = ep.date_start.split('-').map(Number);
  const [, m2, d2] = ep.date_end.split('-').map(Number);
  return (
    <p className="episode-line">
      이 주는 {ep.span_weeks}주 동안 이어진 변화({y1}년 {m1}월 {d1}일 ~ {m2}월 {d2}일)의 일부입니다.{' '}
      {ep.weeks.filter((k) => k !== w.week).map((k) => {
        const x = byKey.get(k);
        return x ? <button key={k} className="linkish small" style={{ marginRight: 8 }} onClick={() => select(k)}>{rangeLabel(x)}</button> : null;
      })}
    </p>
  );
}

/**
 * 광물 채굴(팀 UI 시트 「광물 채굴 — 세 번 치면 깨집니다」, 웹 데모 v5 「3회 채굴」).
 * 1·2번은 톡톡 흔들리고 3번째에 깨지며 「그때 쓴 글」로 내려간다. 보여 주는 내용을 막지는 않는다(원문은 아래에 그대로 있다).
 */
function MineralDig({ mineral, sound }: { mineral: keyof typeof MINERAL_IMG; sound: boolean }) {
  const [hits, setHits] = useState(0);
  const [shake, setShake] = useState(0);
  const hit = () => {
    if (hits >= 3) return;
    const n = hits + 1;
    setHits(n); setShake((k) => k + 1);
    if (n === 3) {
      if (sound) playCue('mined');
      setTimeout(() => document.getElementById('wk-memos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
    }
  };
  return (
    <div className="dig">
      <button className={`dig-ore${hits >= 3 ? ' cracked' : ''}`} key={shake} onClick={hit} aria-label={`${mineral} 캐기 (${hits}/3)`} data-hit={hits}>
        <img src={MINERAL_IMG[mineral]} alt="" />
        <img className="dig-pick" src={ART.pickaxe} alt="" />
      </button>
      <span className="dig-count">HIT_{hits} / 3</span>
    </div>
  );
}

export function WeekDetail({ w, team = false }: { w: WeekRecord; team?: boolean }) {
  const { unlocked, unlock, settings } = useStore();
  const en = useEn();
  // 9/12 회의 5번: 주 단위 「한 번 더 묻기」는 없앴다. 위기 표현이 걸린 글만 하나씩 가려 두고 누르면 연다(Memos)
  const locked = false;
  void unlocked; void unlock;
  const fam = w.evidence.families.map((f) => CHANNEL_LABEL[f as keyof typeof CHANNEL_LABEL] ?? f);
  const lead = w.candidate ? (w.sentence_plain ?? w.sentence) : null;
  return (
    <article className={`stack${team ? ' team-detail' : ''}`} aria-labelledby="wk-title">
      {team && (
        <header className="td-head">
          {w.mineral && w.mineral in MINERAL_IMG && <img className="td-core" src={MINERAL_IMG[w.mineral as keyof typeof MINERAL_IMG]} alt={w.mineral} />}
          <h2 id="wk-title" className="td-date">{rangeLabel(w)}</h2>
          <div className="td-tag">{[w.grade ? gradeText(w) : '', w.mineral].filter(Boolean).join(' · ')}</div>
          <div className="td-gauges"><div className="td-legend" aria-hidden="true"><span>적음</span><span>평소</span><span>많음</span></div><Gauges w={w} /></div>
          {lead ? <p className="sentence">{lead}</p> : <p className="sentence muted">평소와 크게 다르지 않았던 주입니다. 그때 남은 기록을 그대로 보여 드립니다.</p>}
          {en && lead && <p className="sub-en" lang="en">{weekSentenceEn(w)}</p>}
          {w.candidate && <p className="td-evidence">{w.evidence.cross_validated ? `근거: ${fam.join('·')} · 서로 다른 기록 ${w.evidence.independent}종이 함께 가리킴` : `근거: ${fam.join('·')} · 기록 한 종류에서만 나와 근거가 얇습니다`}</p>}
          {lead && <ScreenReadButton text={lead} />}
        </header>
      )}
      {!team && <header>
        {w.mineral && w.mineral in MINERAL_IMG && <MineralDig mineral={w.mineral as keyof typeof MINERAL_IMG} sound={!!settings.sound} />}
        <div className="week-head">
          <h2 id="wk-title">{rangeLabel(w)}</h2>
          {w.mineral && <span className="chip"><i style={{ background: MINERAL_COLOR[w.mineral] }} />{w.mineral}</span>}
          {w.gyeol && <GyeolChip g={w.gyeol} />}
        </div>
        {lead ? (
          <>
            <div className="sentence-row"><p className="sentence">{lead}</p></div>
            {en && <p className="sub-en" lang="en">{weekSentenceEn(w)}</p>}
            <EpisodeLine w={w} />
            <div style={{ marginTop: 8 }}><ScreenReadButton text={lead} /></div>
          </>
        ) : (
          <p className="sentence muted">평소와 크게 다르지 않았던 주입니다. 그때 남은 기록을 그대로 보여 드립니다.</p>
        )}
      </header>}

      <section id="wk-memos"><h3 className="h3">그때 쓴 글</h3><Memos w={w} locked={locked} /></section>
      <section><h3 className="h3">그때 찍은 사진</h3><Photos w={w} locked={locked} /></section>
      <MindiAsk w={w} />
      <section><h3 className="h3">닮은 지난 주</h3><Similar w={w} /></section>
      <section><h3 className="h3">이름 붙이기</h3><Labels w={w} /></section>

      <details className="why">
        <summary>왜 이 주인가</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          {w.candidate && w.sentence && <p>{w.sentence}</p>}
          {w.candidate && (
            <div className="evidence">
              {w.evidence.cross_validated
                ? <span>근거: {fam.join('·')} (서로 다른 기록 {w.evidence.independent}종이 함께 가리킴)</span>
                : <span className="thin">근거가 얇습니다: {fam.join('·')} 기록 한 종류에서만 나왔습니다</span>}
              {w.evidence.linked && w.evidence.linked.length > 0 && (
                <span>함께 움직이는 지표: {w.evidence.linked.map((l) => `${LABELS[l.a] ?? l.a}·${LABELS[l.b] ?? l.b}(상관 ${l.rho.toFixed(2)})`).join(', ')} → 근거 하나로 셈</span>
              )}
              {(() => {
                // not_returned 는 팀 문안이 정해질 때까지 화면에 이름을 붙이지 않는다.
                // 최종 등급이 그 둘이면 이력 줄 전체를 감춘다(앞 단계 「그 뒤 미확인」이 지금 상태처럼 읽히지 않게)
                if (!w.grade || !GRADE_SHORT[w.grade]) return null;
                const hist = w.grade_history.filter((h) => GRADE_SHORT[h.grade]);
                return hist.length > 1 && (
                  <span>확인 이력: {hist.map((h) => `${h.as_of.slice(0, 10)} ${GRADE_SHORT[h.grade]}`).join(' → ')}</span>
                );
              })()}
            </div>
          )}
          <section><h3 className="h3">내 평소와 비교</h3><Gauges w={w} /></section>
          {w.badges.length > 0 && (
            <section>
              <h3 className="h3">평소와 달랐던 지표</h3>
              <ul className="badges">
                {w.badges.map((b) => (
                  <li key={b.indicator}><span>{b.label}</span><span className="dir">{rankText(b)}</span></li>
                ))}
              </ul>
            </section>
          )}
          <section><h3 className="h3">이 주에 가져온 기록</h3><Coverage w={w} /></section>
          <p className="small muted">{w.week} · 직전 1년의 내 기록과만 견줍니다. 남과 비교하지 않습니다.</p>
        </div>
      </details>
    </article>
  );
}
