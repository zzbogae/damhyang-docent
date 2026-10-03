// 영어 자막(코엑스 외국인 관객, 팀 9/23 §1-8 「소리는 그대로, 자막만 교체」). 한국어 문장을 번역하지 않고 같은 판정값에서 따로 조립한다.
// 외부 번역기·모델을 쓰지 않는다. 원문(그때 쓴 글)은 번역하지 않는다(원칙 6).
import type { Axis, Badge, Episode, Era, MemoRecord, MinedResult, WeekRecord } from '../types';
import { AXIS_IDS, type QuestionId } from '../mindi/answers';
import { holdWeeks } from '../mindi/templates';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateEn = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTH[m - 1]} ${d}, ${y}`; };
export const rangeEn = (w: Pick<WeekRecord, 'date_start' | 'date_end'>) => `${dateEn(w.date_start)} – ${dateEn(w.date_end)}`;

export const IND_EN: Record<string, string> = {
  steps: 'steps', sleep: 'sleep', quiet: 'the night gap in records', shot_n: 'screenshots taken', shot_night: 'share of late-night screenshots', screen_time: 'screen time', git_commits: 'commits',
  memo_n: 'notes written', memo_len: 'note length', memo_night: 'share of late-night notes',
  photo_n: 'photos taken', photo_night: 'share of late-night photos', yt_watch: 'YouTube videos watched',
  yt_night: 'share of late-night videos', yt_search: 'YouTube searches', cal_n: 'calendar events',
  kakao_night: 'share of late-night messages', kakao_len: 'message length', kakao_delay: 'reply delay',
  kakao_first: 'share of messages about yourself', kakao_assert: 'share of assertive words',
  sns_post: 'Instagram posts', sns_dm: 'Instagram DMs', sns_night: 'share of late-night DMs',
  ai_msg: 'AI chat messages', ai_night: 'share of late-night AI chats', ai_len: 'length of messages to AI',
};
export const AXIS_EN: Record<Axis, string> = { move: 'Steps', rest: 'Rest', watch: 'Screen', leave: 'Records' };
export const MINERAL_EN_NAME: Record<string, string> = {
  호박: 'amber', 황철석: 'pyrite', 청금석: 'lapis', 월장석: 'moonstone', 자수정: 'amethyst', 홍옥: 'rose', 흑요석: 'obsidian', 석류석: 'garnet', 형석: 'fluorite',
};

const ord = (n: number) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 「Steps: the lowest in the previous 52 weeks」 꼴. 자막이라 주어·동사 일치를 피해 이름표 형식으로 쓴다 */
export function badgeEn(b: Badge): string {
  const label = cap(IND_EN[b.indicator] ?? b.label);
  if (b.pct_text) return `${label}: ${b.direction === 'up' ? 'high' : 'low'} (${b.pct_text})`;
  const r = b.rank <= 1 ? '' : `${ord(b.rank)} `;
  return `${label}: the ${r}${b.direction === 'up' ? 'highest' : 'lowest'} in the previous ${b.n_base} weeks`;
}

export function gradeEn(w: WeekRecord): string {
  switch (w.grade) {
    case 'held': return `The ${holdWeeks(w)} weeks after that stayed within the usual range.`;
    case 'returned': return 'It came back, but what followed is not confirmed.';
    case 'open': return 'What came after this week is not confirmed yet.';
    case 'insufficient': return 'The records are too sparse to tell.';
    case 'broken': return 'It came back, then left the usual range again.';
    default: return '';
  }
}

export function weekSentenceEn(w: WeekRecord): string {
  if (!w.candidate || !w.badges.length) return `${rangeEn(w)} stayed within the usual range.`;
  const first = w.badges[0];
  const other = w.badges.slice(1).find((b) => b.family !== first.family) ?? w.badges[1];
  const parts = [`Week of ${dateEn(w.date_start)}. ${badgeEn(first)}${other ? `; ${badgeEn(other)}` : ''}.`];
  const g = gradeEn(w);
  if (g) parts.push(g);
  if (!w.evidence.cross_validated) parts.push('This came from only one kind of record, so the evidence is thin.');
  return parts.join(' ');
}

export const GREETING_EN = 'Shall we look for the week most like this one?';
export const DONT_KNOW_EN = "This time, I don't know either.";
export const FEELING_EN = "I don't judge how you felt back then. I can show what was different that week and what you wrote at the time.";
export const UNKNOWN_EN = "I can't answer this one yet. Please pick a question above, or ask about steps, rest, screen or records.";
export const UNCLEAR_EN = 'Which one should I look for?';
export const FOOTER_EN = 'Korea suicide prevention line 109 (24 hours)';

const AXIS_PHRASE_EN: Record<Axis, { up: string; down: string }> = {
  move: { up: 'you walked much more than usual', down: 'you walked much less than usual' },
  rest: { up: 'you slept much longer than usual', down: 'you slept much less than usual' },
  watch: { up: 'you spent much more time on screens than usual', down: 'you spent much less time on screens than usual' },
  leave: { up: 'you left many more records than usual', down: 'you left far fewer records than usual' },
};

export function axisDirEn(ax: Axis, dir: 'up' | 'down', w: WeekRecord, ctx: { result: MinedResult; memosByWeek: Map<string, MemoRecord[]> }): string {
  const weeks = ctx.result.weeks;
  const upto = weeks.slice(0, weeks.findIndex((x) => x.week === w.week) + 1);
  const ids = AXIS_IDS[ax];
  const measured = upto.filter((x) => ids.some((id) => x.ind?.[id]?.pr != null)).length;
  if (measured < 26) return `Only ${measured} weeks have these records, so I can't compare yet.`;
  const hits = upto.filter((x) => x.badges.some((b) => ids.includes(b.indicator) && b.direction === dir));
  if (!hits.length) return `Out of ${measured} weeks, there was no week when ${AXIS_PHRASE_EN[ax][dir]}.`;
  const last = hits[hits.length - 1];
  const n = ctx.memosByWeek.get(last.week)?.length ?? 0;
  return [`Out of ${measured} weeks, ${AXIS_PHRASE_EN[ax][dir]} in ${hits.length} weeks.`, `The most recent was the week of ${dateEn(last.date_start)}.`,
    last.mineral ? `That week left a piece of ${MINERAL_EN_NAME[last.mineral] ?? last.mineral}.` : '', n ? `You wrote ${n} notes that week.` : ''].filter(Boolean).join(' ');
}

export function answerEn(q: QuestionId, w: WeekRecord, ctx: { result: MinedResult; byKey: Map<string, WeekRecord>; memosByWeek: Map<string, MemoRecord[]> }): string {
  const { result, byKey } = ctx;
  const weeks = result.weeks;
  switch (q) {
    case 'what': return weekSentenceEn(w);
    case 'why':
      if (!w.candidate) return 'This is not a picked week. I only pick weeks when two or more records were far from your own previous year.';
      return `I compared only with your own previous year, never with other people. ${w.badges.length} measures were far outside your usual range this week. ` +
        (w.evidence.cross_validated ? 'Different kinds of records pointed to it together.' : 'It came from only one kind of record, so the evidence is thin.');
    case 'after': {
      const last = [...weeks].reverse().find((x) => Object.values(x.coverage).some((c) => c === 'observed'));
      if (last && w.week >= last.week) return 'There are no records after this week yet.';
      if (!w.candidate) return 'This week was within the usual range, so I did not follow it.';
      return gradeEn(w) || 'You can follow the weeks after it in the strata.';
    }
    case 'similar': {
      const s = w.similar?.[0];
      const sw = s ? byKey.get(s.week) : undefined;
      if (!s || !sw) return 'There are not enough past records to compare yet.';
      return `The week of ${dateEn(sw.date_start)} was the most similar. ${gradeEn(sw)}`.trim();
    }
    case 'era': {
      const e: Era | undefined = result.eras.find((x) => x.id === w.era);
      if (!e) return 'I have not divided this period yet.';
      const nc = weeks.slice(e.start_index, e.end_index).filter((x) => x.candidate).length;
      const eps = (result.episodes ?? []).filter((ep: Episode) => ep.date_start >= e.start && ep.date_start <= e.end).length;
      return `This week belongs to a period from ${dateEn(e.start)} to ${dateEn(e.end)}. Of its ${e.n_weeks} weeks, ${nc} were different from usual, and changes lasting several weeks happened ${eps} times.`;
    }
    case 'year': {
      const i = weeks.findIndex((x) => x.week === w.week);
      const pool = weeks.slice(Math.max(0, i - 51), i + 1).filter((x) => x.candidate);
      if (!pool.length) return 'No week in the year up to this one was far from usual.';
      const score = (x: WeekRecord) => x.badges.reduce((a, b) => a + (b.extreme === 2 ? 2 : b.extreme === 1 ? 1 : 0.5), 0) + x.evidence.independent;
      const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
      return `In the year up to this week, the week of ${dateEn(best.date_start)} was the most different. ${badgeEn(best.badges[0])}.`;
    }
    case 'rest_low': return axisDirEn('rest', 'down', w, ctx);
  }
}
