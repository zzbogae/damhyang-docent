// 모아 보기(회의 질문 13): 같은 축 × 방향으로 잡힌 주들의 그때 글·사진을 원문 그대로 한 화면에 모은다.
// 요약·재서술·해석은 하지 않는다(원칙 1·6). 확인 후 열람 주는 열기 전까지 내용을 보이지 않고, 가린 글·비밀 글은 빼고, 사진은 필터를 통과한 것만.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { selectRelic } from '../relic/select';
import { checkWeekPhotos, orderPhotos, type ShownPhoto } from '../photos/service';
import { AXIS_DIR_QUESTION, AXIS_IDS } from '../mindi/answers';
import { MINERAL_COLOR } from './minerals';
import type { Axis, WeekRecord } from '../types';

const PAGE = 6;

function WeekCard({ w, onOpen }: { w: WeekRecord; onOpen: () => void }) {
  const { memosByWeek, photosByWeek, unlocked, unlock } = useStore();
  // 주 단위 확인 절차는 없앴다(9/12 회의 5번). 위기 표현 글은 아래에서 빼고 보여 준다
  const locked = false;
  void unlocked; void unlock;
  const memos = useMemo(() => {
    const all = memosByWeek.get(w.week) ?? [];
    const sel = selectRelic(w, all, []);
    const byId = new Map(all.map((m) => [m.id, m]));
    return sel.memo_ids.filter((id) => !sel.gated_memo_ids.includes(id)).map((id) => byId.get(id)!).filter(Boolean).slice(0, 2);
  }, [w, memosByWeek]);
  const [photos, setPhotos] = useState<ShownPhoto[] | null>(null);
  useEffect(() => {
    const ps = photosByWeek.get(w.week) ?? [];
    if (locked || !ps.length) { setPhotos([]); return; }
    let alive = true;
    checkWeekPhotos(orderPhotos(ps, false), undefined, { limit: 6 }).then((r) => alive && setPhotos(r.shown.slice(0, 3)));
    return () => { alive = false; };
  }, [w.week, locked, photosByWeek]);
  return (
    <article className="collect-card">
      <header className="label-row">
        {w.mineral && <span className="chip"><i style={{ background: MINERAL_COLOR[w.mineral] }} />{w.mineral}</span>}
        <button className="linkish" onClick={onOpen}>{rangeLabel(w)}</button>
      </header>
      {locked ? (
        <p className="small muted">이 주는 열어 볼 때만 보여 줍니다. <button className="linkish" onClick={() => unlock(w.week)}>열어 보기</button></p>
      ) : (
        <>
          {memos.map((m) => <p className="memo-line" key={m.id}>{m.text}</p>)}
          {photos && photos.length > 0 && <div className="photos small-photos">{photos.map((p) => <figure key={p.id}><img src={p.url} alt="그 주에 찍은 사진" loading="lazy" /></figure>)}</div>}
          {!memos.length && photos && !photos.length && <p className="small muted">이 주에 남은 글과 사진이 없습니다.</p>}
        </>
      )}
    </article>
  );
}

export function Collect({ axis, dir, onClose }: { axis: Axis; dir: 'up' | 'down'; onClose: () => void }) {
  const { weeks, select } = useStore();
  const [n, setN] = useState(PAGE);
  const ids = AXIS_IDS[axis];
  const hits = useMemo(() => weeks.filter((w) => w.badges.some((b) => ids.includes(b.indicator) && b.direction === dir)).reverse(), [weeks, axis, dir]);
  return (
    <section className="stack" aria-labelledby="collect-title">
      <div className="label-row">
        <h2 id="collect-title" className="section-title">{AXIS_DIR_QUESTION[axis][dir].replace(/는 언제였어\?$/, '')} 모아 보기</h2>
        <button className="btn quiet" onClick={onClose}>닫기</button>
      </div>
      <p className="small muted">{hits.length}주를 최근부터 모았습니다. 그때 쓴 글과 찍은 사진을 고치지 않고 그대로 보여 줍니다.</p>
      {hits.slice(0, n).map((w) => <WeekCard key={w.week} w={w} onOpen={() => select(w.week)} />)}
      {n < hits.length && <button className="btn" onClick={() => setN(n + PAGE)}>더 보기 ({hits.length - n}주 남음)</button>}
    </section>
  );
}
