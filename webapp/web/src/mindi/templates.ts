// 민디 문장 템플릿. 숫자·날짜·순위는 전부 여기서(판정값에서) 만든다. LLM 은 말투만 바꾼다.
import type { WeekRecord } from '../types';

export const GREETING = '이번 주의 당신과 가장 닮은 주를 찾아가볼까요?';
export const DONT_KNOW = '이번은 저도 모릅니다.';

const LABEL: Record<string, string> = {
  steps: '걸음수', sleep: '수면 시간', quiet: '밤 기록 공백', shot_n: '화면 캡처 수', shot_night: '새벽 화면 캡처 비율', screen_time: '스크린타임', git_commits: '커밋 수', memo_n: '메모 수', memo_len: '메모 길이', memo_night: '새벽 메모 비율',
  photo_n: '사진 수', photo_night: '새벽 사진 비율', yt_watch: '유튜브 시청 수', yt_night: '새벽 시청 비율',
  yt_search: '유튜브 검색 수', cal_n: '일정 수', kakao_night: '새벽 카톡 비율', kakao_len: '카톡 길이',
  kakao_delay: '카톡 답장 시간', kakao_first: '카톡 속 자기 이야기 비율', kakao_assert: '카톡 단정어 비율',
  sns_post: '인스타그램 게시 수', sns_dm: '인스타그램 DM 수', sns_night: '새벽 DM 비율',
  ai_msg: 'AI 대화 수', ai_night: '새벽 AI 대화 비율', ai_len: 'AI에게 쓴 글 길이',
};

export function dateLabel(isoMonday: string): string {
  const [y, m, d] = isoMonday.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function rangeLabel(w: Pick<WeekRecord, 'date_start' | 'date_end'>): string {
  const [y1, m1, d1] = w.date_start.split('-').map(Number);
  const [y2, m2, d2] = w.date_end.split('-').map(Number);
  if (y1 !== y2) return `${y1}년 ${m1}월 ${d1}일 ~ ${y2}년 ${m2}월 ${d2}일`;
  if (m1 !== m2) return `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
  return `${y1}년 ${m1}월 ${d1}일 ~ ${d2}일`;
}

/** 마지막 글자의 받침으로 조사를 고른다. 한글이 아니면 괄호 표기. */
export function josa(word: string, withB: string, withoutB: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}${withB}(${withoutB})`;
  return word + ((c - 0xac00) % 28 ? withB : withoutB);
}

export function sameDirectionText(same: string[]): string {
  const down = same.filter((s) => s.endsWith(':down')).map((s) => LABEL[s.split(':')[0]] ?? s);
  const up = same.filter((s) => s.endsWith(':up')).map((s) => LABEL[s.split(':')[0]] ?? s);
  const parts: string[] = [];
  if (down.length) parts.push(`${josa(down.slice(0, 3).join('·'), '은', '는')} 평소보다 적은 편`);
  if (up.length) parts.push(`${josa(up.slice(0, 3).join('·'), '은', '는')} 평소보다 많은 편`);
  if (!parts.length) return '두 주 모두 뚜렷하게 한쪽으로 움직인 기록은 없었고, 여러 기록이 평소 범위 안의 비슷한 자리에 있었습니다.';
  return `두 주 모두 ${parts.join('이었고, ')}이었습니다.`;
}

function weekIndex(key: string): number {
  const [y, w] = key.split('-W').map(Number);
  // ISO 주: 1월 4일이 들어 있는 주가 1주. 날짜 차이만 쓰므로 대략적인 기준일이면 충분하다
  return Math.round(Date.UTC(y, 0, 4) / (7 * 86400000)) + w;
}

/** 지속 창 길이(주). return_week ~ hold_until 에서 읽고, 없으면 팀 기본값 4 */
export function holdWeeks(w: Pick<WeekRecord, 'return_week' | 'hold_until'>): number {
  if (!w.return_week || !w.hold_until) return 4;
  return Math.max(1, weekIndex(w.hold_until) - weekIndex(w.return_week));
}

/**
 * 확인 등급 화면 문장(팀 9/23 확정, core/mined_core/judge.py GRADE_TEXT 와 같은 문장).
 * not_returned 는 팀이 문안을 정할 때까지 빈 문자열이다.
 */
export function gradeText(w: WeekRecord | undefined): string {
  if (!w || !w.grade) return '';
  switch (w.grade) {
    case 'held': return `그 뒤 ${holdWeeks(w)}주는 평소 범위였습니다.`;
    case 'returned': return '돌아왔지만 그 뒤는 확인되지 않았습니다.';
    case 'open': return '이 주 뒤는 아직 확인되지 않았습니다.';
    case 'insufficient': return '기록이 비어 판정할 수 없습니다.';
    case 'broken': return '돌아왔지만 다시 벗어났습니다.';
    default: return '';
  }
}

/** 다른 주(닮은 주 등)를 가리키며 붙이는 뒷이야기. 확인이 끝난 등급만 말한다. */
export function afterText(w: WeekRecord | undefined): string {
  if (!w || !w.grade) return '';
  if (w.grade === 'held') return `그때는 돌아온 뒤 ${holdWeeks(w)}주가 평소 범위였습니다.`;
  if (w.grade === 'returned') return '그때는 돌아왔지만 그 뒤는 확인되지 않았습니다.';
  return '';
}

/** 닮은 주 안내 템플릿. 마지막 문장 "이번은 저도 모릅니다"는 호출하는 쪽이 늘 붙인다. */
export function similarTemplate(target: WeekRecord, sim: WeekRecord, same: string[], memoCount: number): string {
  const a = `${dateLabel(sim.date_start)}부터의 한 주가 ${target === sim ? '이 주' : '이번 주'}와 가장 닮았습니다.`;
  const b = sameDirectionText(same);
  const c = memoCount > 0 ? `그 주에 쓴 글이 ${memoCount}개 남아 있습니다.` : '';
  const d = afterText(sim);
  return [a, b, c, d].filter(Boolean).join(' ');
}
