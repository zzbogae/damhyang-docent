// 민디는 묻는 말에만 답한다. 질문은 정해진 몇 가지이고, 답은 판정값으로 만든 템플릿이다(숫자는 LLM 에 맡기지 않는다).
import type { Episode, Era, MemoRecord, MinedResult, WeekRecord } from '../types';
import { afterText, dateLabel, DONT_KNOW, rangeLabel, sameDirectionText } from './templates';

export type QuestionId = 'what' | 'why' | 'after' | 'similar' | 'era' | 'year';

export const QUESTIONS: { id: QuestionId; text: string }[] = [
  { id: 'what', text: '이 주에 무엇이 달랐어?' },
  { id: 'why', text: '왜 이 주를 골랐어?' },
  { id: 'after', text: '그 뒤에는 어떻게 됐어?' },
  { id: 'similar', text: '이 주와 닮은 주는 언제야?' },
  { id: 'era', text: '이 시기는 어땠어?' },
  { id: 'year', text: '지난 1년 중 가장 달랐던 주는?' },
];

export interface Answer { text: string; dontKnow: boolean; goto?: string }

const FAM: Record<string, string> = { health: '건강', memo: '메모', photo: '사진', yt: '유튜브', cal: '캘린더', kakao: '카카오톡' };

function isLatest(w: WeekRecord, weeks: WeekRecord[]) {
  const last = [...weeks].reverse().find((x) => Object.values(x.coverage).some((c) => c === 'observed'));
  return !!last && w.week >= last.week;
}

export function answer(q: QuestionId, w: WeekRecord, ctx: {
  result: MinedResult; byKey: Map<string, WeekRecord>; memosByWeek: Map<string, MemoRecord[]>;
}): Answer {
  const { result, byKey, memosByWeek } = ctx;
  const weeks = result.weeks;
  switch (q) {
    case 'what': {
      if (!w.candidate || !w.sentence) return { text: `${rangeLabel(w)}은 평소 범위 안에 있었습니다. 크게 달랐던 기록은 없습니다.`, dontKnow: false };
      const body = w.sentence.replace(/^.*?한 주간, /, '');
      return { text: `${rangeLabel(w)}에는 ${body}`, dontKnow: false };
    }
    case 'why': {
      if (!w.candidate) return { text: '이 주는 고른 주가 아닙니다. 직전 1년의 내 기록과 비교해 두 가지 이상이 크게 달랐던 주만 고릅니다.', dontKnow: false };
      const fams = w.evidence.families.map((f) => FAM[f] ?? f);
      const n = w.badges.length;
      const cross = w.evidence.cross_validated
        ? `${fams.join('·')} 기록이 함께 가리켰습니다. 기기 하나가 틀려도 서로 다른 기록이 같이 틀릴 가능성은 낮습니다.`
        : `다만 ${fams.join('·')} 기록 한 종류에서만 나와서 근거가 얇습니다.`;
      return { text: `직전 1년의 이 사람 기록과만 비교했고, 남과는 비교하지 않았습니다. 이 주에는 평소 범위를 크게 벗어난 지표가 ${n}개 있었습니다. ${cross}`, dontKnow: false };
    }
    case 'after': {
      if (isLatest(w, weeks)) return { text: '이 주 뒤의 기록은 아직 없습니다.', dontKnow: true };
      const t = afterText(w).replace(/^그때는 /, '');
      if (!w.candidate) return { text: '이 주는 평소 범위 안에 있어서 따로 지켜보지 않았습니다.', dontKnow: false };
      if (t) return { text: t, dontKnow: false };
      return { text: '그 뒤를 판단할 만큼 기록이 쌓이지 않았습니다.', dontKnow: true };
    }
    case 'similar': {
      const s = w.similar?.[0];
      const sw = s ? byKey.get(s.week) : undefined;
      if (!s || !sw) return { text: '비교할 만큼 지난 기록이 쌓이지 않았습니다.', dontKnow: false };
      const n = memosByWeek.get(sw.week)?.length ?? 0;
      const parts = [`${dateLabel(sw.date_start)}부터의 한 주가 가장 닮았습니다.`, sameDirectionText(s.same_direction)];
      if (n) parts.push(`그 주에 쓴 글이 ${n}개 남아 있습니다.`);
      const af = afterText(sw);
      if (af) parts.push(af);
      return { text: parts.join(' '), dontKnow: true, goto: sw.week };
    }
    case 'era': {
      const e: Era | undefined = result.eras.find((x) => x.id === w.era);
      if (!e) return { text: '이 주가 속한 시기를 아직 나누지 못했습니다.', dontKnow: false };
      const inEra = weeks.slice(e.start_index, e.end_index);
      const nc = inEra.filter((x) => x.candidate).length;
      const eps = (result.episodes ?? []).filter((ep: Episode) => ep.date_start >= e.start && ep.date_start <= e.end).length;
      return {
        text: `이 주는 ${dateLabel(e.start)}부터 ${dateLabel(e.end)}까지 이어진 시기에 속합니다. 이 시기 ${e.n_weeks}주 가운데 평소와 달랐던 주는 ${nc}개였고, 몇 주 이어진 변화는 ${eps}번이었습니다.`,
        dontKnow: false,
      };
    }
    case 'year': {
      const i = weeks.findIndex((x) => x.week === w.week);
      const pool = weeks.slice(Math.max(0, i - 51), i + 1).filter((x) => x.candidate);
      if (!pool.length) return { text: '이 주까지 1년 동안 크게 달랐던 주는 없었습니다.', dontKnow: false };
      const score = (x: WeekRecord) => x.badges.reduce((a, b) => a + (b.extreme === 2 ? 2 : b.extreme === 1 ? 1 : 0.5), 0) + x.evidence.independent;
      const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
      const body = (best.sentence ?? '').replace(/^.*?한 주간, /, '').split('. ')[0];
      return { text: `이 주까지 1년 가운데서는 ${dateLabel(best.date_start)}부터의 한 주가 가장 달랐습니다. ${body}${body.endsWith('.') ? '' : '.'}`, dontKnow: false, goto: best.week };
    }
  }
}

export { DONT_KNOW };
