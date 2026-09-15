// 유튜브 시청·검색 기록(Google Takeout JSON). 제목 원문은 저장하지 않고 개수만 센다.
// HTML 형식은 youtubeHtml.ts 가 같은 규칙(광고·설문 제외, 같은 집계)으로 읽는다.
import type { Aggregator } from '../aggregate';
import { isoToLocal, type LocalTime } from '../dates';
import { isNight } from '../rules';

interface TakeoutItem { title?: string; time?: string; details?: { name?: string }[] }

/** 광고 항목 표시(JSON `details[].name`, HTML 캡션의 세부정보 줄) */
export const YT_AD_RE = /Google 광고|From Google Ads/i;
/** 설문 응답 항목. 영어 문구는 Takeout 실물 기준, 한국어 문구는 추정이라 '설문'이 들어간 응답 문구를 넓게 잡는다. */
export const YT_SURVEY_RE = /^(Answered survey question|설문(조사)?\S*\s*(질문)?에\s*(답변|응답))/i;

function isAd(it: TakeoutItem): boolean {
  return !!it.details?.some((d) => YT_AD_RE.test(d?.name ?? ''));
}

export function isSurveyTitle(title: string | undefined): boolean {
  return !!title && YT_SURVEY_RE.test(title.trim());
}

/** 시청·검색 항목 하나를 일 단위 표에 더한다(JSON·HTML 공통). */
export function addYouTubeEvent(agg: Aggregator, kind: 'watch' | 'search', t: LocalTime) {
  if (kind === 'watch') {
    agg.add(t.date, 'yt_watch_n');
    if (isNight(t.hour)) agg.add(t.date, 'yt_watch_night_n');
  } else {
    agg.add(t.date, 'yt_search_n');
  }
  agg.touch('yt', t.date, 'takeout-youtube');
}

export function parseYouTube(text: string, kind: 'watch' | 'search', agg: Aggregator): number {
  let items: TakeoutItem[];
  try {
    items = JSON.parse(text);
  } catch {
    return 0;
  }
  if (!Array.isArray(items)) return 0;
  let n = 0;
  for (const it of items) {
    if (!it?.time || isAd(it) || isSurveyTitle(it.title)) continue;
    const t = isoToLocal(it.time);
    if (!t) continue;
    addYouTubeEvent(agg, kind, t);
    n++;
  }
  return n;
}
