// 팀 v6 판정 JSON(원페이지의 sample_data.json 형식) ↔ 이 뼈대의 v7 결과.
// - fromV6: 팀 파이프라인이 만든 v6 JSON 을 이 화면에서 그대로 볼 수 있게 v7 모양으로 옮긴다.
//   v6 에는 판정된 주만 있고 지표 백분위·결측 정보가 없어서, 지층의 나머지 주와 4축 게이지는 비워 둔다.
// - toV6: v7 판정 결과를 팀 뷰어(지층 탐사·곡괭이 채굴·코어 무늬)가 읽는 v6 모양으로 내보낸다.
import type { Badge, Channel, MemoRecord, MinedResult, WeekRecord } from '../types';
import { CHANNELS } from '../types';

export interface V6Badge { label: string; pct: string }
export interface V6Relic { q: { t: string; d: string; h: number; mi: number; n: number; len: number }[] }
export interface V6Week {
  week: string; date_start: string; date_end: string; tier: 'recovered' | 'passed' | 'observed';
  sentence: string; cross_validated: boolean; badges: V6Badge[]; mineral: string; shape: string;
  relic: V6Relic | null; access: 'auto' | 'confirm';
}
export interface V6Json { weeks: V6Week[]; principles: string; sample?: boolean; notice?: string }

const V6_STRONGEST = '직전 1년 중 가장 두드러진 주';

// 지표 이름 → (id, 계열, 축). 팀 샘플의 10개 이름과 이 뼈대의 이름을 함께 둔다.
const LABELS: Record<string, [string, Channel, string]> = {
  '걸음수': ['steps', 'health', 'steps'], '수면 시간': ['sleep', 'health', 'sleep'],
  '메모 작성 수': ['memo_n', 'memo', 'record'], '메모 길이': ['memo_len', 'memo', 'record'], '메모 심야 작성 비율': ['memo_night', 'memo', 'record'],
  '사진 촬영 수': ['photo_n', 'photo', 'record'], '심야 촬영 비율': ['photo_night', 'photo', 'record'],
  '유튜브 시청 수': ['yt_watch', 'yt', 'screen'], '유튜브 심야 비율': ['yt_night', 'yt', 'screen'], '유튜브 검색량': ['yt_search', 'yt', 'screen'],
  '일정 개수': ['cal_n', 'cal', 'record'],
  '카톡 새벽 발화 비율': ['kakao_night', 'kakao', 'record'], '카톡 발화 길이': ['kakao_len', 'kakao', 'record'],
  '카톡 답장 지연': ['kakao_delay', 'kakao', 'record'], '카톡 1인칭 비율': ['kakao_first', 'kakao', 'record'], '카톡 단정어 비율': ['kakao_assert', 'kakao', 'record'],
  '인스타그램 게시 수': ['sns_post', 'sns', 'record'], '인스타그램 DM 수': ['sns_dm', 'sns', 'record'], '인스타그램 새벽 DM 비율': ['sns_night', 'sns', 'record'],
  'AI 대화 메시지 수': ['ai_msg', 'ai', 'screen'], 'AI 대화 새벽 비율': ['ai_night', 'ai', 'screen'], 'AI에게 쓴 글 길이': ['ai_len', 'ai', 'screen'],
};

// v6 문장 조각(gen.py PHRASE)에서 방향을 읽는다. 문장에 없는 배지는 방향을 모른다.
const DOWN_RE = /(적었|짧았|적게|낮았|빨랐)/;
const UP_RE = /(많았|길었|많이|높았|늦었)/;
const SUBJECT: Record<string, string[]> = {
  steps: ['걸음수'], sleep: ['잠'], memo_n: ['메모를'], memo_len: ['메모가'], memo_night: ['새벽에 쓴 메모'],
  photo_n: ['사진을'], photo_night: ['새벽에 찍은 사진'], yt_night: ['새벽에 본 영상'], yt_search: ['검색'], cal_n: ['일정'],
  yt_watch: ['유튜브를'],
};

function directionFromSentence(sentence: string, id: string): 'up' | 'down' | null {
  const subs = SUBJECT[id] ?? [];
  for (const part of sentence.split(/그리고|\. /)) {
    if (subs.some((s) => part.includes(s))) {
      if (DOWN_RE.test(part)) return 'down';
      if (UP_RE.test(part)) return 'up';
    }
  }
  return null;
}

function mondayOf(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t;
}
const iso = (t: Date) => t.toISOString().slice(0, 10);
function isoWeekKey(t: Date): string {
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + 3);
  const wy = d.getUTCFullYear();
  const w = Math.ceil(((d.getTime() - Date.UTC(wy, 0, 1)) / 86400000 + 1) / 7);
  return `${wy}-W${String(w).padStart(2, '0')}`;
}

export function isV6(j: any): j is V6Json {
  return !!j && Array.isArray(j.weeks) && (String(j.principles ?? '').startsWith('v6') ||
    (j.weeks[0] && Array.isArray(j.weeks[0].badges) && typeof j.weeks[0].badges[0]?.pct === 'string'));
}

/** 팀 v6 JSON → v7 결과와 메모. 판정되지 않은 주는 빈 주로 채운다. */
export function fromV6(j: V6Json): { result: MinedResult; memos: MemoRecord[] } {
  const src = [...j.weeks].sort((a, b) => a.date_start.localeCompare(b.date_start));
  const used = new Set<Channel>();
  for (const w of src) for (const b of w.badges) { const m = LABELS[b.label]; if (m) used.add(m[1]); }
  const byKey = new Map(src.map((w) => [w.week, w]));
  const first = mondayOf(src[0].date_start);
  const last = mondayOf(src[src.length - 1].date_start);
  const weeks: WeekRecord[] = [];
  const memos: MemoRecord[] = [];
  for (let t = new Date(first); t <= last; t.setUTCDate(t.getUTCDate() + 7)) {
    const key = isoWeekKey(t);
    const v = byKey.get(key);
    const end = new Date(t); end.setUTCDate(end.getUTCDate() + 6);
    const coverage = Object.fromEntries(CHANNELS.map((c) => [c, used.has(c) ? 'observed' : 'structural_missing'])) as WeekRecord['coverage'];
    const base: WeekRecord = {
      schema: 'mined.week/7', week: key, date_start: iso(t), date_end: iso(end), candidate: false, coverage,
      ind: {}, axes: { steps: null, sleep: null, screen: null, record: null }, badges: [],
      evidence: { families: [], independent: 0, cross_validated: false }, tier: null, tier_history: [], access: 'auto',
      era: null, mineral: null, shape: null, similar: [], sentence: null,
    };
    if (!v) { weeks.push(base); continue; }
    const badges: Badge[] = v.badges.map((b) => {
      const m = LABELS[b.label] ?? [b.label, 'memo' as Channel, 'record'];
      const strongest = b.pct === V6_STRONGEST;
      const top = strongest ? 1 : Number(/(\d+)/.exec(b.pct)?.[1] ?? 50);
      const dir = directionFromSentence(v.sentence, m[0]) ?? 'up';
      return {
        indicator: m[0], label: b.label, family: m[1], axis: m[2], direction: dir,
        pr: dir === 'up' ? 1 - top / 100 : top / 100, rank: strongest ? 1 : 0, n_base: 52,
        extreme: strongest ? 2 : top <= 5 ? 1 : 0, pct_text: b.pct,
      } as Badge;
    });
    const fams = [...new Set(badges.map((b) => b.family))].sort();
    weeks.push({
      ...base, candidate: true, badges, sentence: v.sentence, tier: v.tier, access: v.access, mineral: v.mineral, shape: v.shape,
      evidence: { families: fams, independent: fams.length, cross_validated: v.cross_validated },
      tier_history: [{ as_of: v.date_end, tier: v.tier }],
    });
    (v.relic?.q ?? []).forEach((q, i) => {
      memos.push({
        id: `v6-${v.week}-${i}`, ts: `${q.d}T${String(q.h).padStart(2, '0')}:${String(q.mi).padStart(2, '0')}`, date: q.d,
        week: isoWeekKey(mondayOf(q.d)), hour: q.h, text: q.t, chars: q.t.length, source: 'v6',
      });
    });
  }
  const nCand = weeks.filter((w) => w.candidate).length;
  const nCross = weeks.filter((w) => w.candidate && w.evidence.cross_validated).length;
  const result: MinedResult = {
    schema: 'mined.result/7',
    config: { imported_from: j.principles ?? 'v6', sample: !!j.sample, notice: j.notice ?? '' },
    weeks, eras: [], episodes: [],
    summary: {
      n_weeks: weeks.length, n_candidates: nCand, n_cross: nCross, n_single_source: nCand - nCross,
      imported_v6: true,
      coverage: Object.fromEntries(CHANNELS.map((c) => [c, { observed_weeks: used.has(c) ? weeks.length : 0, share: used.has(c) ? 1 : 0 }])),
    },
  };
  return { result, memos };
}

/** v7 배지 → v6 pct 문자열(팀 규칙: 방향과 상관없이 '상위 X%', 직전 기준 전체를 넘으면 '직전 1년 중 가장 두드러진 주'). */
export function v6Pct(b: Badge & { pct_text?: string }): string {
  if (b.pct_text) return b.pct_text;
  if (b.extreme === 2) return V6_STRONGEST;
  const top = b.direction === 'up' ? (1 - b.pr) * 100 : b.pr * 100;
  return `상위 ${Math.max(1, Math.round(top))}%`;
}

/** v7 결과 → 팀 v6 JSON. relic 에는 되돌려줄 원문 고르기로 고른 메모(비밀·위기 표현 메모 제외)를 넣는다. */
export function toV6(result: MinedResult, pickMemos: (w: WeekRecord) => MemoRecord[], opts: { sample?: boolean; notice?: string } = {}): V6Json {
  const weeks: V6Week[] = [];
  for (const w of result.weeks) {
    if (!w.candidate || !w.sentence) continue;
    const memos = pickMemos(w);
    weeks.push({
      week: w.week, date_start: w.date_start, date_end: w.date_end,
      tier: (w.tier ?? 'observed') as V6Week['tier'], sentence: w.sentence, cross_validated: w.evidence.cross_validated,
      badges: w.badges.map((b) => ({ label: b.label, pct: v6Pct(b as Badge & { pct_text?: string }) })),
      mineral: w.mineral ?? '호박', shape: w.shape ?? 'round',
      relic: memos.length ? { q: memos.map((m) => ({ t: m.text, d: m.date, h: m.hour, mi: Number(m.ts.slice(14, 16)) || 0, n: 0, len: 0 })) } : null,
      access: w.access,
    });
  }
  return {
    weeks,
    principles: 'v6 (mined v7 에서 내보냄)',
    sample: opts.sample ?? false,
    notice: opts.notice ?? 'mined 멘토 뼈대의 판정 결과를 팀 뷰어 형식으로 내보낸 파일입니다.',
  };
}
