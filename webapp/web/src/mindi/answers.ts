// 민디는 묻는 말에만 답한다. 질문은 정해진 몇 가지이고, 답은 판정값으로 만든 템플릿이다(숫자는 LLM 에 맡기지 않는다).
import type { Axis, Episode, Era, MemoRecord, MinedResult, WeekRecord } from '../types';
import { afterText, dateLabel, DONT_KNOW, gradeText, josa, rangeLabel, sameDirectionText } from './templates';

export type QuestionId = 'what' | 'why' | 'after' | 'similar' | 'era' | 'year' | 'rest_low';

export const QUESTIONS: { id: QuestionId; text: string }[] = [
  { id: 'what', text: '이 주에 무엇이 달랐어?' },
  { id: 'why', text: '왜 이 주를 골랐어?' },
  { id: 'after', text: '그 뒤에는 어떻게 됐어?' },
  { id: 'similar', text: '이 주와 닮은 주는 언제야?' },
  { id: 'era', text: '이 시기는 어땠어?' },
  { id: 'year', text: '지난 1년 중 가장 달랐던 주는?' },
  { id: 'rest_low', text: '잠을 못 잔 주는 언제였어?' },
];

const MIN_SLEEP_WEEKS = 26;

export interface Answer { text: string; dontKnow: boolean; goto?: string; collect?: { axis: Axis; dir: 'up' | 'down' } }

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
      if (!w.candidate) return { text: '이 주는 평소 범위 안에 있어서 따로 지켜보지 않았습니다.', dontKnow: false };
      const t = gradeText(w);
      if (t) return { text: t, dontKnow: w.grade === 'open' || w.grade === 'insufficient' };
      // broken·not_returned: 팀 문안이 정해질 때까지 등급을 말하지 않고, 그 뒤 기록으로 안내만 한다
      return { text: '그 뒤의 기록은 지층에서 이어서 볼 수 있습니다.', dontKnow: false, goto: w.return_week ?? undefined };
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
        text: `이 주는 ${dateLabel(e.start)}부터 ${dateLabel(e.end)}까지 이어진 시기에 속합니다. 이 시기 ${e.n_weeks}주 가운데 광물이 나온 주는 ${nc}개였고, 몇 주 이어진 변화는 ${eps}번이었습니다.`,
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
    case 'rest_low':
      // 회의 질문 13: 쉼 축 아래 방향(월장석)으로 잡힌 주
      return axisDirAnswer('rest', 'down', w, ctx);
  }
}

// 축 × 방향 질문(광물 8종과 같은 칸). 언제였는지·몇 번이었는지·남은 글 수만 말하고, 이유나 그때의 마음은 말하지 않는다.
export const AXIS_IDS: Record<Axis, string[]> = { move: ['steps'], rest: ['sleep'], watch: ['yt_watch', 'yt_search', 'ai_msg', 'screen_time'], leave: ['memo_n', 'photo_n', 'cal_n', 'sns_post', 'git_commits'] };
const AXIS_MEASURE: Record<Axis, string> = { move: '걸음을 잰', rest: '잠을 잰', watch: '화면 기록이 있는', leave: '남긴 기록이 있는' };
const AXIS_PHRASE: Record<Axis, { up: string; down: string }> = {
  move: { up: '걸음이 평소보다 크게 많았던', down: '걸음이 평소보다 크게 적었던' },
  rest: { up: '잠이 평소보다 크게 길었던', down: '잠이 평소보다 크게 짧았던' },
  watch: { up: '화면을 평소보다 크게 많이 본', down: '화면을 평소보다 크게 적게 본' },
  leave: { up: '기록을 평소보다 크게 많이 남긴', down: '기록을 평소보다 크게 적게 남긴' },
};
export const AXIS_DIR_QUESTION: Record<Axis, { up: string; down: string }> = {
  move: { up: '많이 걸은 주는 언제였어?', down: '적게 걸은 주는 언제였어?' },
  rest: { up: '잠을 길게 잔 주는 언제였어?', down: '잠을 못 잔 주는 언제였어?' },
  watch: { up: '화면을 많이 본 주는 언제였어?', down: '화면을 적게 본 주는 언제였어?' },
  leave: { up: '기록을 많이 남긴 주는 언제였어?', down: '기록을 적게 남긴 주는 언제였어?' },
};

export function axisDirAnswer(ax: Axis, dir: 'up' | 'down', w: WeekRecord, ctx: {
  result: MinedResult; memosByWeek: Map<string, MemoRecord[]>;
}): Answer {
  const weeks = ctx.result.weeks;
  const i = weeks.findIndex((x) => x.week === w.week);
  const upto = weeks.slice(0, i + 1);
  const ids = AXIS_IDS[ax];
  const measured = upto.filter((x) => ids.some((id) => x.ind?.[id]?.pr != null)).length;
  if (measured < MIN_SLEEP_WEEKS) {
    return { text: `${AXIS_MEASURE[ax]} 주가 ${measured}주뿐이라 아직 비교할 수 없습니다.`, dontKnow: true };
  }
  const hits = upto.filter((x) => x.badges.some((b) => ids.includes(b.indicator) && b.direction === dir));
  const phrase = AXIS_PHRASE[ax][dir];
  if (!hits.length) return { text: `${AXIS_MEASURE[ax]} ${measured}주 가운데 ${phrase} 주는 없었습니다.`, dontKnow: false };
  const last = hits[hits.length - 1];
  const n = ctx.memosByWeek.get(last.week)?.length ?? 0;
  const parts = [`${AXIS_MEASURE[ax]} ${measured}주 가운데 ${phrase} 주는 ${hits.length}번이었습니다.`,
    `가장 가까운 때는 ${dateLabel(last.date_start)}부터의 한 주입니다.`];
  if (last.mineral) parts.push(`그 주에는 ${josa(last.mineral, '이', '가')} 남아 있습니다.`);
  if (n) parts.push(`그 주에 쓴 글이 ${n}개 있습니다.`);
  return { text: parts.join(' '), dontKnow: false, goto: last.week, ...(hits.length > 1 ? { collect: { axis: ax, dir } } : {}) };
}

export { DONT_KNOW };
