// 접근성 점검(코엑스 전시 대비, 팀 요청 4-7): 주요 화면마다 axe-core(WCAG 2.1 A·AA)로 검사하고, 키보드만으로 지층을 움직일 수 있는지 본다.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const report: Record<string, { id: string; impact: string | null | undefined; help: string; nodes: string[] }[]> = {};

async function scan(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze();
  report[name] = r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
}

test('주요 화면 접근성 검사', async ({ page }) => {
  await page.goto('/?grid&dev');
  await scan(page, '가져오기');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await scan(page, '처음 화면(민디 인사)');
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('.strata .wk.hit').first().click();
  const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
  if (await gate.isVisible()) await gate.click();
  await page.getByLabel('민디에게 직접 묻기').fill('이 주에 무엇이 달랐어?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await scan(page, '주 상세');
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await scan(page, '시기');
  await page.getByRole('button', { name: '편지', exact: true }).click();
  await scan(page, '편지');
  await page.getByRole('button', { name: '설정' }).click();
  await scan(page, '설정');
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await scan(page, '다시 가져오기·기록 더하기');
  fs.mkdirSync('../out', { recursive: true });
  fs.writeFileSync('../out/a11y_report.json', JSON.stringify(report, null, 1));
  const serious = Object.entries(report).flatMap(([s, vs]) => vs.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${s}: ${v.id} ${v.nodes[0]}`));
  expect(serious).toEqual([]);
});

test('키보드만으로 지층 칸을 옮겨 주를 연다', async ({ page }) => {
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('.strata .wk').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('#wk-title')).toBeVisible();
});
