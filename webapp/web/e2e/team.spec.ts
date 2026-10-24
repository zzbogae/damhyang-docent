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

const axeSerious = async (page: import('@playwright/test').Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

// 10/23 버튼배치 확정: 관측소 Ⓑ → P5 엘리베이터(오른쪽 층 표시기 · 돌아가기/○○년으로 내려간다) → P6 지층 → 광석 → P7 캐기(3번) → 여기서 바로 보기 → P8 상세
test('관측소 → 엘리베이터 → 지층 → 광석 캐기 → 상세 → 되돌아가기', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  // 공통 틀: 왼쪽 레일 + 우상단 [?][⚙][관측소의 문]
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect(page.getByRole('button', { name: '안내' })).toBeVisible();
  await expect(page.getByRole('button', { name: '관측소의 문' })).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);

  await page.locator('.obs-btn.b').click();
  await expect(page.locator('.lift')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toHaveCount(0); // 몰입 화면은 레일을 접는다
  const first = await page.locator('.lift-btn.primary').textContent();
  await page.getByRole('button', { name: '한 층 아래로' }).click();
  await expect(page.locator('.lift-btn.primary')).not.toHaveText(first!);
  const year = (await page.locator('.lift-btn.primary').textContent())!.match(/\d{4}/)![0];
  expect(await axeSerious(page)).toEqual([]);
  await page.locator('.lift-btn.primary').click();
  await expect(page.locator('.minefield')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.mf-year')).toHaveText(year);

  const ore = page.locator('.mf-ore').first();
  await ore.scrollIntoViewIfNeeded();
  const week = await ore.getAttribute('data-mine-week');
  expect(week).toMatch(/^\d{4}-W\d{2}$/);
  await ore.click();
  const rock = page.locator('.mine-ore');
  await expect(rock).toBeVisible();
  await expect(page.getByRole('button', { name: '여기서 바로 보기' })).toHaveCount(0);
  for (let i = 0; i < 3; i++) await rock.click();
  await expect(page.getByRole('button', { name: '관측소로 가져가기' })).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);
  await page.getByRole('button', { name: '여기서 바로 보기' }).click();

  await expect(page.locator('.team-detail, .p8').first()).toBeVisible();
  await expect(page.getByRole('group', { name: '★ VIBE 네 질문' })).toBeVisible();
  await page.getByRole('button', { name: '사진 볼까?' }).click();
  await expect(page.getByLabel('민디에게 물어보기')).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);
  await page.getByRole('button', { name: '‹ 되돌아가기' }).click();
  await page.getByRole('menuitem', { name: 'Quit · 지층으로' }).click();
  await expect(page.locator('.minefield')).toBeVisible();
});

test('장면 플로우: 오늘 보기 → 고른 주 캐기 → 보관함 → 광석 3개로 나의 공간 짓기', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  // 첫 인사에서 「찾아가 보기」를 누르면 답이 관측소에 남는다
  await page.getByRole('button', { name: '찾아가 보기' }).click();
  await expect(page.getByRole('button', { name: '그 주 열어 보기' })).toBeVisible();

  // 나의 공간은 아직 잠김
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '나의 공간' }).click();
  await expect(page.getByText(/0\/3/).first()).toBeVisible();
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  // Ⓐ 오늘 보기: 비슷한 주 찾기를 눌러야 다섯이 나온다
  await page.locator('.obs-btn.a').click();
  await expect(page.locator('.today-item')).toHaveCount(0);
  await page.getByRole('button', { name: '비슷한 주 찾기' }).click();
  await expect(page.locator('.today-item')).toHaveCount(5);
  expect(await axeSerious(page)).toEqual([]);
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  // Ⓒ 민디와 이야기
  await page.locator('.obs-btn.c').click();
  await page.getByRole('tab', { name: '이야기 나누기' }).click();
  await page.getByLabel('민디에게 직접 묻기').fill('오늘 점심 뭐 먹지');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.locator('.talk-log, .ask').first()).toContainText('오늘 점심 뭐 먹지');
  await page.getByRole('button', { name: '뒤로 가기' }).click();

  // Ⓑ → 엘리베이터 → 지층: 타임라인에서 광석 없는 주를 골라 캐기 → 관측소로 가져가기
  const mineOne = async (pick: () => Promise<void>, carry: boolean) => {
    await page.locator('.obs-btn.b').click();
    await page.locator('.lift-btn.primary').click();
    await expect(page.locator('.minefield')).toBeVisible({ timeout: 10000 });
    await pick();
    const rock = page.locator('.mine-ore');
    await expect(rock).toBeVisible();
    for (let i = 0; i < 3; i++) await rock.click();
    await page.getByRole('button', { name: carry ? '관측소로 가져가기' : '여기서 바로 보기' }).click();
  };
  await mineOne(async () => {
    const tick = page.locator('.mf-tick:not(.has-ore)').nth(10);
    await tick.scrollIntoViewIfNeeded();
    await tick.click();
    await page.locator('.mf-ore[data-picked="true"]').click();
  }, true);
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 10000 });
  for (let k = 0; k < 2; k++) {
    await mineOne(async () => {
      const ore = page.locator('.mf-ore:not([data-picked])').nth(k);
      await ore.scrollIntoViewIfNeeded();
      await ore.click();
    }, true);
    await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 10000 });
  }

  // Ⓓ 캔 광석 보관함: 셋 → 직접 고른 광석 상세
  await page.locator('.obs-btn.d').click();
  await expect(page.locator('.archive-cell')).toHaveCount(3);
  expect(await axeSerious(page)).toEqual([]);
  await page.locator('.archive-cell').first().click();
  await expect(page.getByRole('group', { name: '★ VIBE 네 질문' })).toBeVisible();
  await page.getByRole('button', { name: '‹ 되돌아가기' }).click();
  await page.getByRole('menuitem', { name: /나의 공간/ }).click();

  // P11 나의 공간 만들기: ① 환경 → ② 단어 → ③ 미리보기 → ④ 이름 → ⑤ 열기
  await page.getByRole('radio', { name: '작은 방' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('group', { name: '단어 고르기' }).getByRole('button').first().click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('공간 이름').fill('세 번의 봄');
  expect(await axeSerious(page)).toEqual([]);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '안개 걷고 열기' }).click();
  await expect(page.getByText('세 번의 봄').first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/flow1024-space.png' });
});
