// 지표 값을 사람이 읽는 말로 바꾼다(주 단위 합계 또는 하루 평균).
const UNIT: Record<string, (v: number) => string> = {
  steps: (v) => `하루 ${Math.round(v).toLocaleString()}보`,
  sleep: (v) => `하루 ${Math.floor(v / 60)}시간 ${Math.round(v % 60)}분`,
  memo_n: (v) => `주 ${fmt(v)}개`,
  memo_len: (v) => `메모 하나에 ${Math.round(v)}자`,
  memo_night: (v) => `${Math.round(v * 100)}%`,
  photo_n: (v) => `주 ${fmt(v)}장`,
  photo_night: (v) => `${Math.round(v * 100)}%`,
  yt_watch: (v) => `주 ${fmt(v)}편`,
  yt_night: (v) => `${Math.round(v * 100)}%`,
  yt_search: (v) => `주 ${fmt(v)}번`,
  cal_n: (v) => `주 ${fmt(v)}개`,
};
function fmt(v: number) { return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1); }

export const LABEL: Record<string, string> = {
  steps: '걸음수', sleep: '수면 시간', memo_n: '메모 수', memo_len: '메모 길이', memo_night: '새벽에 쓴 메모 비율',
  photo_n: '사진 수', photo_night: '새벽에 찍은 사진 비율', yt_watch: '유튜브 시청', yt_night: '새벽 시청 비율',
  yt_search: '유튜브 검색', cal_n: '일정 수', kakao_night: '새벽 카톡 비율', kakao_len: '카톡 길이',
  kakao_delay: '카톡 답장 시간', kakao_first: '카톡 속 자기 이야기', kakao_assert: '카톡 단정어',
  sns_post: '인스타그램 게시', sns_dm: '인스타그램 DM', sns_night: '새벽 DM 비율',
  ai_msg: 'AI 대화', ai_night: '새벽 AI 대화 비율', ai_len: 'AI에게 쓴 글 길이',
};

export function valueText(id: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return '기록 없음';
  return (UNIT[id] ?? ((x: number) => fmt(x)))(v);
}

export function changeText(id: string, c: { from: number; to: number; ratio: number | null }): string {
  const a = valueText(id, c.from);
  const b = valueText(id, c.to);
  if (c.ratio === null) return `${LABEL[id] ?? id}: ${a} → ${b}`;
  const pct = Math.round(Math.abs(c.ratio) * 100);
  return `${LABEL[id] ?? id}: ${a} → ${b} (${pct}% ${c.ratio > 0 ? '늘어남' : '줄어듦'})`;
}
