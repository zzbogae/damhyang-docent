// v2(11/03) 섬 만들기 다음 단계: 고른 값으로 「가상으로 생성된」 섬 영상 넷을 보여 주고, 하나를 골라 섬으로 간다(보별 지정).
// 영상은 나의 공간 예시영상 4안(바다·하늘산·정글·음악방)의 확정 키프레임(드라이브 03_에셋_디자인/261023_MineD_나의공간_예시영상_v1,
// 첫발견·K02·K03/K05·체류)을 12초로 이은 시연용 클립이다. 실제 생성 영상(편집본 v3, Flow 24컷)이 오면 같은 이름으로 바꿔 끼운다.
// 옵션은 「나의 공간 공간설계·선택옵션 v1」(11/03, 제안) §1 설명용 표 그대로다. 추천 단어·뺀 단어는 시연용 가상 예시.
import seaClip from '../assets/design/island_clip_sea.mp4';
import seaPoster from '../assets/design/island_clip_sea.webp';
import skyClip from '../assets/design/island_clip_sky.mp4';
import skyPoster from '../assets/design/island_clip_sky.webp';
import jungleClip from '../assets/design/island_clip_jungle.mp4';
import junglePoster from '../assets/design/island_clip_jungle.webp';
import musicClip from '../assets/design/island_clip_music.mp4';
import musicPoster from '../assets/design/island_clip_music.webp';
import type { IslandOpts } from './IslandMake';
import type { TrackKey } from '../mindi/soundKit';

export type ClipKey = 'sea' | 'sky' | 'jungle' | 'music';
export interface IslandClip {
  key: ClipKey; label: string; src: string; poster: string; track: TrackKey;
  /** 이 영상이 나온 옵션(가안). 여섯 가지 순서: 시간 · 날씨·계절 · 장소 · 시대 · 머물 곳 · 소리 */
  opts: { time: string; weather: string[]; place: string; placeNote?: string; era: string; dwelling: string; music: string; words: string[]; dropped: string };
  /** 화면에 보이는 장면 순서(키프레임) */
  beats: string[];
}

export const CLIPS: IslandClip[] = [
  {
    key: 'sea', label: '바다 섬', src: seaClip, poster: seaPoster, track: 'sea',
    opts: { time: '점심', weather: ['여름', '햇살'], place: '바다', era: '시대 없음', dwelling: '오두막', music: '바다', words: ['부두', '배', '컵', '책'], dropped: '등대' },
    beats: ['맑은 낮, 섬을 처음 봄', '선착장으로 들어섬', '창문을 엶', '물가에 머묾'],
  },
  {
    key: 'sky', label: '하늘산 섬', src: skyClip, poster: skyPoster, track: 'sky',
    opts: { time: '아침', weather: ['가을', '햇살'], place: '산', placeNote: '구름 위', era: '시대 없음', dwelling: '오두막', music: '하늘산', words: ['책', '돌담', '컵', '담요'], dropped: '텐트' },
    beats: ['구름 위, 섬을 처음 봄', '돌길로 들어섬', '창가에서 책을 읽음', '구름 위에 머묾'],
  },
  {
    key: 'jungle', label: '정글 섬', src: jungleClip, poster: junglePoster, track: 'jungle',
    opts: { time: '점심', weather: ['여름', '비'], place: '숲', placeNote: '정글', era: '시대 없음', dwelling: '방갈로', music: '정글', words: ['해먹', '차', '빗소리', '처마'], dropped: '반딧불이' },
    beats: ['비 오는 숲, 섬을 처음 봄', '젖은 돌길로 들어섬', '처마 밑에서 비를 봄', '빗소리 속에 머묾'],
  },
  {
    key: 'music', label: '음악방', src: musicClip, poster: musicPoster, track: 'music',
    opts: { time: '해질녘', weather: ['가을', '햇살'], place: '도시', era: '1970년대', dwelling: '룸', music: '음악방', words: ['레코드', '피아노', '시계', '기타'], dropped: '라디오' },
    beats: ['노을빛 방을 처음 봄', '방 안으로 들어섬', '피아노를 침', '음악을 들으며 머묾'],
  },
];

export const clipOf = (k?: string) => CLIPS.find((c) => c.key === k);

/** 고른 값과 같은 옵션 수(많을수록 앞에). 판정이 아니라 「고른 것과 몇 개가 같은지」만 센다 */
export function sameCount(o: IslandOpts, c: IslandClip): number {
  let n = 0;
  if (o.time && o.time === c.opts.time) n++;
  n += o.weather.filter((w) => c.opts.weather.includes(w)).length;
  if (o.place && o.place === c.opts.place) n++;
  if (o.era && o.era === c.opts.era) n++;
  if (o.dwelling && o.dwelling === c.opts.dwelling) n++;
  if (o.music && o.music === c.track) n += 2;
  return n;
}

export function clipOptsLine(c: IslandClip): string {
  const o = c.opts;
  return [o.time, o.weather.join('·'), o.place, o.era, o.dwelling, `♪ ${o.music}`].join(' · ');
}
