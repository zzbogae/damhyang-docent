// 나의 공간 이미지 생성(11/12 멘토진): 고른 여섯 가지와 사전 단어로 섬 그림 한 장을 그 자리에서 받아 온다.
// 브라우저는 같은 주소의 /api/space/image 만 부른다(hf-space/server.py, 개발 중에는 vite.config.ts 의 SPACE_API_URL 중계).
// 단어는 보내기 전에 사전으로 거르고(wordFilter.ts), 서버가 한 번 더 거른다. 프롬프트는 서버가 조립한다.
// 서버가 없거나(GitHub Pages) 실패하거나 TIMEOUT_MS 를 넘기면 null 을 돌려주고, 화면은 지금의 예시 영상을 그대로 보여 준다.
import { filterWords } from './wordFilter';
import type { IslandOpts } from '../ui/IslandMake';

export const SPACE_IMAGE_URL = '/api/space/image';
/** 서버 상한(20초)에 네트워크 여유를 더한 값 */
export const TIMEOUT_MS = 23000;

export type SpaceIsland = 'sea' | 'sky' | 'jungle' | 'music' | 'onsen';
export interface SpaceImage { image: string; island: SpaceIsland; used: Record<string, unknown>; ms?: number }
export interface SpaceImageBody {
  island: SpaceIsland; time?: string; weather: string[]; place?: string; era?: string; dwelling?: string; music?: string; words: string[];
}

const CARD_ISLANDS: readonly string[] = ['sea', 'sky', 'jungle', 'music', 'onsen'];

/** 고른 카드의 섬을 그대로 보낸다. 그래야 그림이 안내 줄(고른 영상 · ○○ 섬)과 섬 소리와 맞는다.
 *  겨울·눈은 서버 프롬프트가 그 섬의 계절·날씨로 넣는다. 카드가 없을 때만 겨울·눈이면 온천(예시 영상 「겨울 노천 온천」 규칙), 아니면 바다 */
export function islandFor(o: IslandOpts, clip?: string): SpaceIsland {
  if (clip && CARD_ISLANDS.includes(clip)) return clip as SpaceIsland;
  return o.weather.some((w) => w === '겨울' || w === '눈') ? 'onsen' : 'sea';
}

/** 서버로 보낼 본문. 사전에 없는 단어(이름·실제 장소 등)는 여기서 빠진다 */
export function spaceImageBody(o: IslandOpts, words: string[], clip?: string): SpaceImageBody {
  return {
    island: islandFor(o, clip),
    time: o.time, weather: o.weather.slice(0, 2), place: o.place, era: o.era, dwelling: o.dwelling,
    music: o.music && o.music !== 'none' ? o.music : undefined,
    words: filterWords(words).kept.map((e) => e.word),
  };
}

// 같은 섬을 다시 열면 새로 그리지 않는다(유료 호출). 새로 고침하면 비워진다 — 이미지는 기기에 저장하지 않는다
const cache = new Map<string, Promise<SpaceImage | null>>();

/** 섬 그림 한 장. 실패·지연·서버 없음은 모두 null(화면은 예시 영상으로 돌아간다) */
export function requestSpaceImage(key: string, body: SpaceImageBody, timeoutMs = TIMEOUT_MS): Promise<SpaceImage | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const p = fetch(SPACE_IMAGE_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal,
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as Partial<SpaceImage>;
      return typeof j.image === 'string' && j.image.startsWith('data:image/') ? (j as SpaceImage) : null;
    })
    .catch(() => null)
    .finally(() => clearTimeout(t));
  // 실패한 것은 기억하지 않는다(다음에 들어가면 다시 시도)
  cache.set(key, p);
  void p.then((v) => { if (!v) cache.delete(key); });
  return p;
}

/** 테스트용 */
export function clearSpaceImageCache() { cache.clear(); }
