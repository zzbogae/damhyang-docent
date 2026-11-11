// 나의 공간 이미지 생성(11/12 멘토진): 섬 방문 화면이 /api/space/image 를 부르고, 성공하면 생성 그림을, 실패하면 예시 영상을 보여 준다.
// 서버는 route 로 흉내만 낸다(유료 호출 없음). 섬 기록은 지어낸 한 줄이다.
import { expect, test, type Page } from '@playwright/test';

const ROW = {
  id: 'syn-e2e', name: '11월 12일의 섬', kind: 'island', ores: [], words: ['민준이랑', '부두', '컵', '서울역'], at: '2026-11-12T00:00:00.000Z',
  opts: { time: '해질녘', weather: ['여름', '햇살'], place: '바다', era: '시대 없음', dwelling: '오두막', music: 'sea', excluded: [] }, clip: 'sea',
};
// 1×1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function openVisit(page: Page) {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  await page.evaluate((r) => localStorage.setItem('mined.spaces.v1', JSON.stringify([r])), ROW);
  await page.goto('/?intro');
  await page.locator('.intro').getByRole('button', { name: '섬으로 들어가기' }).click();
  await expect(page.locator('.isl-visit-full')).toBeVisible();
}

test('생성 성공: 생성 그림이 예시 영상 대신 보이고, 사전 밖 단어는 나가지 않는다', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/space/image', async (r) => {
    bodies.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ image: PNG, island: 'sea', used: {}, ms: 10 }) });
  });
  await openVisit(page);
  await expect(page.locator('.isl-visit-full')).toHaveAttribute('data-gen', 'ok', { timeout: 30000 });
  await page.getByRole('button', { name: '섬으로 들어가기' }).click({ timeout: 15000 });
  await expect(page.locator('img.isl-room.isl-gen')).toBeVisible();
  await expect(page.locator('video.isl-room')).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ island: 'sea', words: ['부두', '컵'] });
  expect(JSON.stringify(bodies[0])).not.toMatch(/민준|서울역/);
});

test('생성 실패(504): 안내 없이 예시 영상을 그대로 보여 준다', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/space/image', async (r) => {
    bodies.push(r.request().postDataJSON());
    await r.fulfill({ status: 504, contentType: 'application/json', body: '{"error":"timeout"}' });
  });
  await openVisit(page);
  await expect(page.locator('.isl-visit-full')).toHaveAttribute('data-gen', 'fail', { timeout: 30000 });
  await page.getByRole('button', { name: '섬으로 들어가기' }).click({ timeout: 15000 });
  await expect(page.locator('video.isl-room')).toBeVisible();
  await expect(page.locator('img.isl-gen')).toHaveCount(0);
  expect(bodies[0]).toHaveProperty('island', 'sea');
});
