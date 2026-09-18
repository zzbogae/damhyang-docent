// 민디 문장 템플릿. 숫자·날짜·순위는 전부 여기서(판정값에서) 만든다. LLM 은 말투만 바꾼다.
import type { WeekRecord } from '../types';

export const GREETING = '이번 주의 당신과 가장 닮은 주를 찾아가볼까요?';
export const DONT_KNOW = '이번은 저도 모릅니다.';

const LABEL: Record<string, string> = {
  steps: '걸음수', sleep: '수면 시간', memo_n: '메모 수', memo_len: '메모 길이', memo_night: '새벽 메모 비율',
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

export function afterText(w: WeekRecord | undefined): string {
  if (!w || !w.tier) return '';
  if (w.tier === 'recovered' && w.recovered_after) return `그때는 약 ${w.recovered_after}주 뒤부터 평소의 흐름이 이어졌습니다.`;
  if (w.tier === 'passed') return '그때는 그 뒤로 평소의 흐름이 충분히 오래 이어졌는지 확인되지 않았습니다.';
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
