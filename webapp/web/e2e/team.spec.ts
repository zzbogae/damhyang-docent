// 기본 화면(드라이브 디자인): 입장 인트로 → 민디 소개 → 가져오기 → 광물 지하(한 화면) → 세 번 캐기 → 기록 조각 → 상세 → 지층으로.
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('입장 인트로와 민디 소개는 스크롤 없이 한 화면씩 넘어간다', async ({ page }) => {
  await page.goto('/?intro');
  await page.getByRole('button', { name: '입장하기' }).click();
  await expect(page.getByText('안녕하세요, 저는 민디예요.')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '기록을 가져옵니다' })).toBeVisible();
  await expect(page.locator('.intro')).toHaveCount(0);
});

test('광물 지하: 연도를 넘기고, 광물을 세 번 쳐서 캐면 기록 조각이 나오고 상세로 이어진다', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.locator('.minefield')).toBeVisible({ timeout: 180000 });
  await expect(page.locator('.strata')).toHaveCount(0); // 기본 화면에는 주 격자가 없다
  await page.getByRole('button', { name: '다음에' }).click();
  const year = await page.locator('.mf-year').textContent();
  if (await page.getByRole('button', { name: '이전 해(아래로)' }).isEnabled()) {
    await page.getByRole('button', { name: '이전 해(아래로)' }).click();
    await expect(page.locator('.mf-year')).not.toHaveText(year!);
  }
  const ore = page.locator('.mf-ore').first();
  const week = await ore.getAttribute('data-mine-week');
  await ore.click();
  await expect(ore).toHaveClass(/crack-1/);
  await ore.click();
  await expect(ore).toHaveClass(/crack-2/);
  await ore.click();
  const card = page.getByRole('dialog', { name: '기록 조각' });
  await expect(card).toBeVisible();
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await card.getByRole('button', { name: '상세 페이지에서 이어보기 →' }).click();
  await expect(page.locator('.team-detail')).toBeVisible();
  await expect(page.locator('.td-date')).toBeVisible();
  await expect(page.locator('.td-gauges')).toBeVisible();
  const a11y2 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a11y2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  expect(week).toMatch(/^\d{4}-W\d{2}$/);
  await page.getByRole('button', { name: '← 지층으로' }).click();
  await expect(page.locator('.minefield')).toBeVisible();
});
