// 모듈 사이 데이터 계약. 설명은 docs/contract.md.

export type Channel = 'health' | 'memo' | 'photo' | 'yt' | 'cal' | 'kakao' | 'sns' | 'ai';
export const CHANNELS: Channel[] = ['health', 'memo', 'photo', 'yt', 'cal', 'kakao', 'sns', 'ai'];

export const CHANNEL_LABEL: Record<Channel, string> = {
  health: '건강', memo: '메모', photo: '사진', yt: '유튜브', cal: '캘린더', kakao: '카카오톡',
  sns: '인스타그램', ai: 'AI 대화',
};

export interface DailyRow {
  date: string; // YYYY-MM-DD (현지)
  steps?: number;
  sleep_min?: number;
  memo_n?: number; memo_chars?: number; memo_night_n?: number;
  photo_n?: number; photo_night_n?: number;
  yt_watch_n?: number; yt_watch_night_n?: number; yt_search_n?: number;
  cal_n?: number;
  kakao_n?: number; kakao_night_n?: number; kakao_chars?: number;
  kakao_reply_n?: number; kakao_reply_min_sum?: number;
  kakao_first_n?: number; kakao_assert_n?: number;
  sns_post_n?: number; sns_dm_n?: number; sns_dm_night_n?: number;
  ai_msg_n?: number; ai_msg_night_n?: number; ai_chars?: number;
}

export interface ChannelMeta { first: string; last: string; sources: string[]; records: number }

export interface DailyMeta {
  tz: string;
  night_hours: [number, number];
  export_date?: string;
  channels: Partial<Record<Channel, ChannelMeta>>;
  gaps?: Partial<Record<Channel, [string, string][]>>;
}

export interface MemoRecord {
  id: string;
  ts: string; // YYYY-MM-DDTHH:mm (현지)
  date: string;
  week: string; // YYYY-Www
  hour: number;
  text: string;
  chars: number;
  source: string;
  title?: string;
  flags?: { secret?: boolean; secretKinds?: string[]; crisis?: boolean };
}

export type PhotoFilterReason = 'face' | 'text' | 'screenshot' | 'decode' | 'model';

export interface PhotoRecord {
  id: string;
  date: string;
  week: string;
  hour: number;
  minute?: number;
  name: string;
  path: string; // 사용자가 고른 폴더/zip 안의 상대 경로. 세션 안에서 파일을 다시 찾는 열쇠
  size: number;
  mime: string;
  source: 'folder' | 'takeout' | 'file';
  hasExif: boolean;
  make?: string;
  model?: string;
  filter?: { status: 'ok' | 'hidden' | 'error'; reasons: PhotoFilterReason[]; faces?: number; textRatio?: number; checkedAt: string };
}

export type Tier = 'recovered' | 'passed' | 'observed';
export type Coverage = 'observed' | 'structural_missing' | 'partial';

export interface IndicatorValue {
  v: number | null; // 그 주의 원래 값
  pr: number | null; // 중간 순위 백분위(0~1), 판정 불가면 null
  n_base: number;
  rank_low: number | null; // 적은 쪽 순위(1=가장 적음)
  rank_high: number | null; // 많은 쪽 순위(1=가장 많음)
  why?: 'missing' | 'baseline_short' | 'no_denominator';
}

export interface Badge {
  indicator: string;
  label: string;
  family: string;
  axis: string;
  direction: 'up' | 'down';
  pr: number;
  rank: number;
  n_base: number;
  extreme: 0 | 1 | 2;
  /** 팀 v6 JSON 에서 불러온 배지의 원래 표기('상위 8%' 등). 있으면 순위 대신 이 표기를 보여 준다 */
  pct_text?: string;
}

export interface WeekRecord {
  schema: 'mined.week/7';
  week: string;
  date_start: string;
  date_end: string;
  candidate: boolean;
  coverage: Record<Channel, Coverage>;
  ind: Record<string, IndicatorValue | null>;
  axes: Record<'steps' | 'sleep' | 'screen' | 'record', { pr: number; n_base: number } | null>;
  badges: Badge[];
  evidence: { families: string[]; independent: number; cross_validated: boolean; linked?: { a: string; b: string; rho: number }[] };
  tier: Tier | null;
  tier_history: { as_of: string; tier: Tier }[];
  recovered_after?: number | null;
  access: 'auto' | 'confirm';
  era: string | null;
  episode?: string | null;
  mineral: string | null;
  shape: string | null;
  similar: { week: string; distance: number; shared_families: number; same_direction: string[] }[];
  sentence: string | null;
  relic?: { memo_ids: string[]; photo_ids: string[]; hidden: Partial<Record<'face' | 'text' | 'screenshot' | 'secret' | 'crisis', number>> };
}

export interface Era {
  id: string; start: string; end: string; start_index: number; end_index: number;
  boundary_indicators: string[]; n_weeks: number; n_candidates: number;
  levels?: Record<string, number | null>;
  change_vs_prev?: Record<string, { from: number; to: number; ratio: number | null }>;
}

export interface Episode {
  id: string; weeks: string[]; date_start: string; date_end: string; span_weeks: number;
  families: string[]; strongest: { indicator: string; label: string; direction: 'up' | 'down' }; tier: Tier | null;
}

export interface MinedResult {
  schema: 'mined.result/7';
  config: Record<string, unknown>;
  weeks: WeekRecord[];
  eras: Era[];
  episodes?: Episode[];
  summary: Record<string, unknown>;
}
