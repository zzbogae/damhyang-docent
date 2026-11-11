// 나의 공간 이미지 생성 요청 모듈. 서버는 흉내만 낸다(fetch 대체). 예시 값은 모두 지어낸 것이다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spaceImageBody, islandFor, requestSpaceImage, clearSpaceImageCache, SPACE_IMAGE_URL } from '../src/space/spaceImage';
import type { IslandOpts } from '../src/ui/IslandMake';

const opts = (o: Partial<IslandOpts> = {}): IslandOpts => ({
  time: '해질녘', weather: ['여름', '햇살'], place: '바다', era: '지금', dwelling: '오두막', music: 'none', excluded: [], ...o,
});
const OK = { image: 'data:image/jpeg;base64,AAAA', island: 'sea', used: {}, ms: 7000 };

describe('spaceImageBody', () => {
  it('사전 밖 단어(이름·실제 장소)는 빼고 사전 단어만 보낸다', () => {
    const b = spaceImageBody(opts(), ['민준이랑', '부두', '컵', '서울역'], 'sea');
    expect(b.words).toEqual(['부두', '컵']);
    expect(JSON.stringify(b)).not.toMatch(/민준|서울역/);
  });
  it('겨울이나 눈을 골라도 고른 카드의 섬을 보낸다(그림이 안내 줄·섬 소리와 맞게)', () => {
    expect(islandFor(opts({ weather: ['겨울'] }), 'jungle')).toBe('jungle');
    const b = spaceImageBody(opts({ weather: ['겨울', '맑음'] }), [], 'jungle');
    expect(b.island).toBe('jungle');
    expect(b.weather).toEqual(['겨울', '맑음']);
    expect(islandFor(opts({ weather: ['봄', '눈'] }), 'sky')).toBe('sky');
    expect(islandFor(opts({ weather: ['겨울'] }), 'onsen')).toBe('onsen');
  });
  it('카드가 없거나 모르는 카드면 겨울·눈일 때 onsen, 아니면 sea', () => {
    expect(islandFor(opts({ weather: ['겨울'] }), undefined)).toBe('onsen');
    expect(islandFor(opts({ weather: ['봄', '눈'] }), 'moon')).toBe('onsen');
    expect(islandFor(opts(), undefined)).toBe('sea');
    expect(islandFor(opts(), 'moon')).toBe('sea');
  });
  it('고른 카드의 섬을 보낸다', () => {
    expect(islandFor(opts(), 'sky')).toBe('sky');
    expect(islandFor(opts(), 'music')).toBe('music');
  });
  it('소리 없음은 music 을 비우고 날씨는 둘까지', () => {
    const b = spaceImageBody(opts({ weather: ['여름', '햇살', '비'] }), [], 'sea');
    expect(b.music).toBeUndefined();
    expect(b.weather).toEqual(['여름', '햇살']);
  });
});

describe('requestSpaceImage', () => {
  beforeEach(() => clearSpaceImageCache());
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('성공하면 그림을 돌려주고 같은 섬은 다시 부르지 않는다', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(OK), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const body = spaceImageBody(opts(), ['부두'], 'sea');
    expect((await requestSpaceImage('a', body))?.image).toBe(OK.image);
    await requestSpaceImage('a', body);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SPACE_IMAGE_URL);
    expect(JSON.parse(init.body as string).island).toBe('sea');
  });
  it('서버 오류(504·429)면 null 이고, 다음에는 다시 시도한다', async () => {
    const f = vi.fn(async () => new Response('{"error":"timeout"}', { status: 504 }));
    vi.stubGlobal('fetch', f);
    expect(await requestSpaceImage('b', spaceImageBody(opts(), [], 'sea'))).toBeNull();
    await Promise.resolve();
    f.mockImplementation(async () => new Response('{"error":"rate_limited"}', { status: 429 }));
    expect(await requestSpaceImage('b', spaceImageBody(opts(), [], 'sea'))).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('네트워크 실패와 그림이 아닌 응답은 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await requestSpaceImage('c', spaceImageBody(opts(), [], 'sea'))).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ image: 'https://example.com/x.png' }), { status: 200 })));
    expect(await requestSpaceImage('d', spaceImageBody(opts(), [], 'sea'))).toBeNull();
  });
  it('시간 초과면 요청을 끊고 null', async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => { aborted = true; rej(new DOMException('aborted', 'AbortError')); });
    })));
    const p = requestSpaceImage('e', spaceImageBody(opts(), [], 'sea'), 1000);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await p).toBeNull();
    expect(aborted).toBe(true);
  });
});
