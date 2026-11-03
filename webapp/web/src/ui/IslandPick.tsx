// v2(11/03) 섬 영상 넷 가운데 하나 고르기 → 「섬으로 가기」. 영상은 소리 없이 반복 재생하고, 카드를 고르면 그 섬의 곡을 잠깐 들려준다.
// 각 카드에는 「이 옵션으로 이 영상이 나왔다」는 여섯 가지 값과 장면 순서를 붙인다. 고른 값과 같은 수만 보여 주고 「어울린다」 같은 판정은 하지 않는다.
import { useEffect, useMemo, useState } from 'react';
import { MindiMark } from './Icons';
import { previewTrack, sfx, stopPreview } from '../mindi/soundKit';
import { CLIPS, clipOptsLine, sameCount, type ClipKey } from './islandClips';
import type { IslandOpts } from './IslandMake';

export function IslandPick({ opts, onGo }: { opts: IslandOpts; onGo: (k: ClipKey) => void }) {
  const ranked = useMemo(() => CLIPS.map((c) => ({ c, n: sameCount(opts, c) })).sort((a, b) => b.n - a.n), [opts]);
  const [pick, setPick] = useState<ClipKey>(ranked[0].c.key);
  const [open, setOpen] = useState<ClipKey | null>(null);
  useEffect(() => () => stopPreview(), []);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className="stack isl-pick">
      <div className="isl-msg mindi"><MindiMark size={36} mood="found" /><p>고른 것으로 섬 영상 네 개를 그려 봤어요. 마음이 가는 하나를 골라 주세요. 고른 섬으로 안개를 걷고 들어가요.</p></div>
      <div className="isl-pick-grid" role="radiogroup" aria-label="섬 영상 고르기">
        {ranked.map(({ c, n }) => (
          <div key={c.key} className={`isl-pick-card${pick === c.key ? ' on' : ''}`}>
            <button role="radio" aria-checked={pick === c.key} className="isl-pick-btn" onClick={() => { sfx('tap'); setPick(c.key); previewTrack(c.track); }}>
              <video src={c.src} poster={c.poster} muted loop playsInline autoPlay={!still} preload="metadata" aria-label={`${c.label} 영상`} />
              <span className="isl-pick-name">{c.label}{pick === c.key && <span className="isl-pick-mark" aria-hidden="true"> ✓</span>}</span>
              <small className="isl-pick-same">고른 것과 같은 옵션 {n > 0 ? `${Math.min(n, 7)}개` : '없음'}</small>
            </button>
            <button className="btn quiet isl-pick-why" aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}>
              {open === c.key ? '설명 접기' : '어떤 옵션으로 나왔나요?'}
            </button>
            {open === c.key && (
              <div className="isl-pick-opts">
                <dl>
                  <dt>시간</dt><dd>{c.opts.time}</dd>
                  <dt>날씨·계절</dt><dd>{c.opts.weather.join(' · ')}</dd>
                  <dt>장소</dt><dd>{c.opts.place}{c.opts.placeNote && ` (직접 쓰기: ${c.opts.placeNote})`}</dd>
                  <dt>시대</dt><dd>{c.opts.era}</dd>
                  <dt>머물 곳</dt><dd>{c.opts.dwelling}</dd>
                  <dt>소리</dt><dd>♪ {c.opts.music}</dd>
                  <dt>추천 단어</dt><dd>{c.opts.words.join(' · ')}</dd>
                  <dt>뺀 단어</dt><dd>{c.opts.dropped} <small className="muted">(화면에 없음)</small></dd>
                </dl>
                <ol className="small">{c.beats.map((b) => <li key={b}>{b}</li>)}</ol>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="small muted">시연용 예시 영상입니다. 각 영상은 「{clipOptsLine(ranked[0].c)}」처럼 여섯 가지 값으로 만든 장면입니다.</p>
      <div className="label-row">
        <button className="btn primary" onClick={() => { stopPreview(); sfx('confirm'); onGo(pick); }}>섬으로 가기</button>
      </div>
    </div>
  );
}
