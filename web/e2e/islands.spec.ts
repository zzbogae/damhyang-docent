// 이어진 섬 설계 시연: 초대 코드 없이는 이웃이 안 보이고, 공개한 방 이름이 같을 때만 다리가 놓이며, 이웃 섬에서는 원문이 보이지 않는다.
import { expect, test } from '@playwright/test';

test('이어진 섬: 초대·공개 범위·잇는 기준', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  // 이름 붙이기: '긴 겨울'을 한 주에
  await page.locator('.strata .wk.hit').first().click();
  await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
  await page.getByRole('button', { name: '붙이기' }).click();
  await page.getByRole('button', { name: '이어진 섬' }).click();
  await expect(page.getByText('설계 시연 · 가상 이웃')).toBeVisible();
  await expect(page.getByText('초대받은 이웃이 없습니다.')).toBeVisible();
  // 초대 코드
  await page.getByLabel('초대 코드').fill('MINE-3F7K');
  await page.getByRole('button', { name: '받기' }).click();
  await expect(page.getByText('느린 등대 님의 초대를 받았습니다.')).toBeVisible();
  // 아무것도 공개 안 했으면 다리 없음
  await expect(page.locator('.isl-list li', { hasText: '느린 등대' })).toContainText('다리 없음');
  // '긴 겨울' 공개 → 같은 방 이름으로 다리
  await page.getByRole('checkbox', { name: /긴 겨울/ }).check();
  await expect(page.getByText(/이웃에게 보이는 것: 방 이름 1개/)).toBeVisible();
  await expect(page.locator('.isl-list li', { hasText: '느린 등대' })).toContainText('다리: 긴 겨울');
  // 이웃 섬 방문: 원문·날짜는 보이지 않는다
  await page.getByRole('button', { name: '섬에 들르기' }).click();
  const visit = page.getByRole('region', { name: '느린 등대 님의 섬' });
  await expect(visit).toContainText('긴 겨울');
  await expect(visit).not.toContainText(/\d{4}년/);
  await page.getByLabel('방명록에 남길 글').fill('같은 이름이라 반가웠습니다');
  await page.getByRole('button', { name: '남기기' }).click();
  await expect(visit).toContainText('나: 같은 이름이라 반가웠습니다');
  await page.screenshot({ path: '../out/shots/islands-rooms.png' });
  // 원안(광물 분포) 비교 설명
  await page.getByRole('radio', { name: /광물 분포로 잇기/ }).check();
  await expect(page.getByText(/비슷한 상태의 주를 겪은 사람끼리 잇는 것/)).toBeVisible();
  await page.screenshot({ path: '../out/shots/islands-minerals.png' });
  expect(external).toEqual([]);
});
