// 팀 사운드 키트: 설정에서 소리를 켜기 전에는 엔진을 부르지 않고, 켠 뒤에도 같은 출처 파일만 불러오며 캐기까지 오류가 없다
import { expect, test } from '@playwright/test';
test('소리를 켜면 같은 출처의 키트만 불러오고 캐기까지 오류가 없다', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = []; const errors: string[] = []; const sound: string[] = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); if (u.includes('/sound/')) sound.push(u.replace(origin, '')); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  expect(sound).toEqual([]); // 꺼져 있으면 엔진을 부르지 않는다
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByText('민디 소리').click();
  await expect.poll(() => page.evaluate(() => (window as any).MineDSound?.isOn?.() ?? false), { timeout: 10000 }).toBe(true);
  await page.getByRole('button', { name: '← 관측소로' }).click();
  await page.waitForTimeout(300);
  const hubZone = await page.evaluate(() => (window as any).MineDSound.state().zone);
  await page.getByRole('button', { name: /지층으로 내려가기/ }).click();
  await page.waitForTimeout(300);
  const elevZone = await page.evaluate(() => (window as any).MineDSound.state().zone);
  await page.waitForTimeout(1800);
  const zone = await page.evaluate(() => (window as any).MineDSound.state().zone);
  const ore = page.locator('.mf-ore').first();
  await ore.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) { await ore.click({ force: true }); await page.waitForTimeout(150); }
  await expect(page.locator('.mf-card')).toBeVisible();
  await page.waitForTimeout(1500);
  console.log('zone', zone, 'sound requests', sound);
  expect(hubZone).toBe('P3'); // 관측소
  expect(elevZone).toBe('P5'); // 엘리베이터
  expect(zone).toBe('P6');
  expect(sound[0]).toContain('/sound/mined-sound.js');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
