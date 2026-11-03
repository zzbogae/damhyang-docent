// v2(11/03) 섬 만들기 대화를 끝까지 지나가는 도우미: 여섯 가지 고르기 → 추천 단어 하나 빼기 → 이름 → 섬 만들기 시작
import { expect, type Page } from '@playwright/test';

export async function buildIsland(page: Page, name: string) {
  await page.getByRole('button', { name: '민디와 섬 만들기 시작' }).click();
  const chat = page.getByLabel('민디와 섬 만들기');
  await chat.getByRole('group', { name: /언제의 빛/ }).getByRole('button', { name: '해질녘' }).click();
  await chat.getByRole('group', { name: /날씨와 계절/ }).getByRole('button', { name: '비' }).click();
  await chat.getByRole('button', { name: '다음', exact: true }).click();
  await chat.getByRole('group', { name: /어디에 놓을까요/ }).getByRole('button', { name: '바다' }).click();
  await chat.getByRole('group', { name: /어느 시대/ }).getByRole('button', { name: '지금' }).click();
  await chat.getByRole('group', { name: /머물 곳/ }).getByRole('button', { name: '오두막' }).click();
  await chat.getByRole('group', { name: /흐를 소리/ }).getByRole('button', { name: '소리 없음' }).click();
  await chat.getByRole('group', { name: '단어 고르기' }).getByRole('button').first().click();
  await page.getByLabel('공간 이름').fill(name);
  await page.getByRole('button', { name: '섬 만들기 시작' }).click();
  // 가상으로 생성된 섬 영상 넷 → 하나 고르고 옵션 설명 열기 → 섬으로 가기(안개가 걷힘) → 관측소로 돌아오면 고른 영상이 섬 카드에 남는다
  const pick = page.getByRole('radiogroup', { name: '섬 영상 고르기' });
  await expect(pick.getByRole('radio')).toHaveCount(4, { timeout: 10000 });
  await expect(pick.getByRole('radio').first()).toHaveAccessibleName(/바다 섬/); // 고른 것과 같은 옵션이 가장 많은 영상이 앞에
  await pick.getByRole('radio', { name: /정글 섬/ }).click();
  await expect(pick.getByRole('radio', { name: /정글 섬/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '어떤 옵션으로 나왔나요?' }).nth(1).click();
  await expect(page.locator('.isl-pick-opts dl')).toBeVisible();
  await page.locator('.isl-pick').getByRole('button', { name: '섬으로 가기' }).click();
  await expect(page.locator('.isl-visit-full video.isl-to')).toHaveAttribute('src', /island_clip_jungle/);
  await page.getByRole('button', { name: '관측소로 돌아가기' }).click({ timeout: 15000 });
  await expect(page.getByText('섬이 준비됐어요. 안개 너머에 있어요.')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.space-name')).toHaveText(name);
}

export async function visitIsland(page: Page, name: string) {
  await page.getByRole('button', { name: '섬으로 가기' }).first().click();
  await page.getByRole('button', { name: '섬으로 들어가기' }).click({ timeout: 15000 });
  await expect(page.locator('.isl-name')).toHaveText(name);
}
