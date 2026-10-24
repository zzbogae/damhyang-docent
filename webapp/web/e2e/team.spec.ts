// 기본 화면(드라이브 디자인 + 10/23 장면 플로우): 입장 인트로 → 민디 소개 → 가져오기 → 관측소 → 광물 지하 → 세 번 캐기 → 기록 조각 → 상세 → 지층으로.
// 곁가지: 오늘 보기 · 민디와 이야기 · 캔 광석 보관함 · 나의 공간(광석 3개).
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
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.getByRole('button', { name: /지층으로 내려가기/ }).click();
  await expect(page.locator('.minefield')).toBeVisible();
  await expect(page.locator('.strata')).toHaveCount(0); // 기본 화면에는 주 격자가 없다
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

test('장면 플로우: 관측소 → 타임라인에서 고른 주 캐기 → 보관함 → 광석 3개로 나의 공간 짓기', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await expect(page.getByRole('note', { name: '민디의 오늘 한 마디' })).toBeVisible();
  await expect(page.getByText('광석 0/3 · 3개가 모이면 열립니다')).toBeVisible();

  // 나의 공간은 아직 안개
  await page.getByRole('button', { name: /나의 공간/ }).click();
  await expect(page.getByText(/아직 안개가 짙습니다/)).toBeVisible();
  await page.getByRole('button', { name: '← 관측소로' }).click();

  // 오늘 보기 → 닮은 주 다섯 → 그 주로 내려가면 그 주를 캘 준비가 된다
  await page.getByRole('button', { name: /오늘 보기/ }).click();
  await expect(page.getByRole('heading', { name: '오늘 보기' })).toBeVisible();
  await expect(page.locator('.today-item')).toHaveCount(5);
  await page.getByRole('button', { name: '← 관측소로' }).click();

  // 민디와 이야기: 설명 듣기 → 그냥 이야기하기(상관없는 말도 받아 준다)
  await page.getByRole('button', { name: /민디와 이야기/ }).click();
  await expect(page.getByText(/이곳은 당신의 기록이 해마다 한 겹씩 쌓인 광산입니다/)).toBeVisible();
  await page.getByRole('tab', { name: '그냥 이야기하기' }).click();
  await page.getByLabel('민디에게 직접 묻기').fill('오늘 점심 뭐 먹지');
  await page.getByRole('button', { name: '묻기' }).click();
  await expect(page.locator('.bubble[role="status"]')).toBeVisible();
  await page.getByRole('button', { name: '← 관측소로' }).click();

  // 지층으로: 엘리베이터 → 타임라인에서 광석이 없는 주를 골라 세 번 캐기
  await page.getByRole('button', { name: /지층으로 내려가기/ }).click();
  await expect(page.locator('.minefield')).toBeVisible();
  const tick = page.locator('.mf-tick:not(.has-ore)').nth(10);
  const pickedWeek = await tick.getAttribute('data-week');
  await tick.click();
  await expect(page.locator('.mf-called')).toHaveText(/\d{4}년 \d{1,2}월이네요\./);
  const rock = page.locator(`.mf-ore[data-picked="true"][data-mine-week="${pickedWeek}"]`);
  await expect(rock).toBeVisible();
  for (let i = 0; i < 3; i++) await rock.click();
  const card = page.getByRole('dialog', { name: '기록 조각' });
  await expect(card).toContainText('직접 고른 광석');
  await card.getByRole('button', { name: '닫기' }).click();

  // 데이터 광석 둘을 더 캔다
  for (let k = 0; k < 2; k++) {
    const ore = page.locator('.mf-ore:not([data-picked])').nth(k);
    await ore.scrollIntoViewIfNeeded();
    for (let i = 0; i < 3; i++) await ore.click();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: '닫기' }).click();
  }

  // 고른 주의 상세: 직접 고른 광석 칩과 민디 세 겹 해설·네 질문
  await page.getByRole('button', { name: '관측소', exact: true }).click();
  await expect(page.getByText(/광석 3\/3|안개가 걷혔습니다/)).toBeVisible();
  await page.getByRole('button', { name: /캔 광석 보관함/ }).click();
  await expect(page.locator('.archive-cell')).toHaveCount(3);
  await page.locator('.archive-cell', { hasText: '직접 고른 광석' }).click();
  await expect(page.locator('.team-detail .chip', { hasText: '직접 고른 광석' })).toBeVisible();
  await page.getByRole('button', { name: '이 주에 나눈 대화는?' }).click();
  await expect(page.locator('.ore-guide [role="status"]')).toContainText('이 주');

  // 나의 공간: 광석 셋 → 민디가 사실을 펼치고 → 단어·종류·이름 → 짓기
  await page.getByRole('button', { name: '관측소', exact: true }).click();
  await page.getByRole('button', { name: /나의 공간/ }).click();
  await expect(page.getByText('안개가 걷혔습니다. 캔 광석 가운데 3개를 고르세요.')).toBeVisible();
  await expect(page.getByText(/이 광석들 곁에 어떤 단어를 두고 싶으세요\?/)).toBeVisible();
  await page.getByRole('group', { name: '단어 고르기' }).getByRole('button').first().click();
  await page.getByRole('radio', { name: '방' }).click();
  await page.getByLabel('공간 이름').fill('세 번의 봄');
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(a11y.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.getByRole('button', { name: '이름 붙이고 짓기' }).click();
  await expect(page.locator('figure.space-scene.room')).toHaveCount(1);
  await expect(page.locator('.space-name')).toHaveText('세 번의 봄');
  await page.screenshot({ path: 'test-results/flow1024-space.png' });
});
