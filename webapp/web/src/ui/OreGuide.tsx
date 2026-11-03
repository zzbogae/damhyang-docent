// 10/23 장면 플로우 ⑤ 열린 광석(P8)의 민디: 세 겹 해설(기록 꺼내기 → 곁에 둔 기억 → 질문으로 넘기기)과 VIBE 네 질문(사진·대화·메모·일정).
// 답은 그 주에 남은 기록의 개수와 사용자가 붙인 이름뿐이다. 카톡·메모의 내용은 읽지 않고, 좋다·나쁘다를 말하지 않는다.
import { useState } from 'react';
import { useStore } from '../state/store';
import { customOreName } from './oreName';
import { MindiMark } from './Icons';
import type { WeekRecord } from '../types';

export type Vibe = 'photo' | 'talk' | 'memo' | 'cal';
/** P8 ★VIBE 네 질문(10/23 버튼배치 P08 ③): 민디 말풍선 바로 아래 버튼 글자 */
export const VIBE_BUTTONS: { id: Vibe; text: string }[] = [
  { id: 'photo', text: '사진 볼까?' },
  { id: 'talk', text: '대화 볼까?' },
  { id: 'memo', text: '메모 볼까?' },
  { id: 'cal', text: '일정 볼까?' },
];
export const VIBE_QUESTIONS: { id: Vibe; text: string }[] = [
  { id: 'photo', text: '이 주에 찍은 사진은?' },
  { id: 'talk', text: '이 주에 나눈 대화는?' },
  { id: 'memo', text: '이 주에 남긴 메모는?' },
  { id: 'cal', text: '이 주의 일정은?' },
];

const val = (w: WeekRecord, id: string) => {
  const v = w.ind[id]?.v;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
};

/** VIBE 답: 개수만 말한다. 기록이 없으면 없다고 말한다 */
export function vibeAnswer(id: Vibe, w: WeekRecord, c: { memos: number; photos: number; shown: number }): { text: string; scroll?: string } {
  if (id === 'photo') {
    if (!c.photos) return { text: '이 주에 남은 사진은 없습니다.' };
    const hid = c.photos - c.shown;
    return { text: `이 주에 찍은 사진은 ${c.photos}장입니다.${hid > 0 ? ` 그중 ${hid}장은 얼굴이나 글자가 있어 가려 두었습니다.` : ''}`, scroll: 'wk-photos' };
  }
  if (id === 'talk') {
    const k = val(w, 'kakao_n'), d = val(w, 'sns_dm');
    if (k === null && d === null) return { text: '이 주에는 대화 기록이 남아 있지 않습니다.' };
    const parts = [k !== null ? `카톡을 ${k}번` : null, d !== null ? `DM을 ${d}번` : null].filter(Boolean);
    return { text: `이 주에 ${parts.join(', ')} 보냈습니다. 무슨 말을 했는지는 읽지 않았습니다.` };
  }
  if (id === 'memo') {
    if (!c.memos) return { text: '이 주에 남은 메모는 없습니다.' };
    return { text: `이 주에 남긴 메모는 ${c.memos}개입니다. 아래 「그때 쓴 글」에 그대로 있습니다.`, scroll: 'wk-memos' };
  }
  const n = val(w, 'cal_n');
  if (n === null) return { text: '이 주에는 일정 기록이 남아 있지 않습니다.' };
  return { text: n ? `이 주에 일정이 ${n}개 있었습니다.` : '이 주에는 적어 둔 일정이 없었습니다.' };
}

export function OreGuide({ w }: { w: WeekRecord }) {
  const { memosByWeek, photosByWeek, labels } = useStore();
  const [a, setA] = useState<{ q: string; text: string; scroll?: string } | null>(null);
  const memos = memosByWeek.get(w.week)?.length ?? 0;
  const photos = photosByWeek.get(w.week) ?? [];
  const shown = photos.filter((p) => p.filter?.status !== 'hidden').length;
  const kept = [customOreName(w.week), ...labels.filter((l) => l.week === w.week).map((l) => l.name)].filter(Boolean) as string[];
  return (
    <div className="ore-guide" role="region" aria-label="민디의 해설">
      <div className="bubble">
        <MindiMark size={36} />
        <div className="stack">
          <p>{memos || photos.length ? `이 주에 남은 기록은 글 ${memos}개, 사진 ${photos.length}장입니다.` : '이 주에 남은 글과 사진은 없습니다. 숫자 기록만 남아 있습니다.'}</p>
          <p>{kept.length ? `곁에 둔 이름: ${kept.map((k) => `「${k}」`).join(' ')}` : '아직 곁에 둔 이름이 없습니다. 이 광석에 이름을 붙여 둘 수 있습니다.'}</p>
          <p>이 주에 대해 무엇을 꺼내 볼까요?</p>
          <div className="label-row" role="group" aria-label="네 질문">
            {VIBE_QUESTIONS.map((q) => (
              <button key={q.id} className="btn" onClick={() => setA({ q: q.text, ...vibeAnswer(q.id, w, { memos, photos: photos.length, shown }) })}>{q.text}</button>
            ))}
          </div>
          {a && (
            <p role="status" aria-live="polite">
              <span className="small muted">「{a.q}」 </span>{a.text}
              {a.scroll && <> <button className="linkish" onClick={() => document.getElementById(a.scroll!)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>보러 가기</button></>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
