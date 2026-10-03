// 앱 전 과정: 합성 판정 입력 → Pyodide 판정 → 지층 → 주 상세(확인 후 열람, 위기 메모 가림, 비밀 메모 숨김) → 라벨 → 모두 지우기.
import { expect, test, type Page } from '@playwright/test';

// 민디에게 문장으로 묻는다(정해진 질문 버튼은 9/12 회의 반영으로 없앴다)
async function ask(page: Page, q: string) {
  await page.getByLabel('민디에게 직접 묻기').fill(q);
  await page.getByRole('button', { name: '묻기', exact: true }).click();
}
import fs from 'node:fs';

test('합성 입력으로 판정하고 주 상세를 연다', async ({ page }) => {
  fs.mkdirSync('../out/shots', { recursive: true });
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await expect(page.locator('.strata .wk.hit').first()).toBeVisible();
  const hits = await page.locator('.strata .wk.hit').count();
  expect(hits).toBeGreaterThan(5);
  await page.screenshot({ path: '../out/shots/app-overview.png' });

  // 민디 첫 인사 → 찾아가 보기
  await expect(page.getByText('이번 주의 당신과 가장 닮은 주를 찾아가볼까요?')).toBeVisible();
  await page.getByRole('button', { name: '찾아가 보기' }).click();
  await expect(page.getByText('이번은 저도 모릅니다.')).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-mindi.png' });

  // 2024-W10(힘든 주, 가짜 비밀·위기 메모가 들어 있는 주)
  await page.locator('[data-week="2024-W10"]').click();
  await expect(page.locator('.sentence').first()).toContainText('2024년 3월 4일부터 한 주간');
  const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
  if (await gate.isVisible()) await gate.click();
  await expect(page.getByText(/비밀번호나 계좌번호처럼 보이는 메모 1개/)).toBeVisible();
  await expect(page.locator('.memo.veiled')).toHaveCount(1);
  // 위기 표현 메모는 가려 두되 판정처럼 들리는 문구는 쓰지 않는다. 109 안내는 이 주와 상관없이 모든 화면 아래에 늘 있다
  await expect(page.getByText('가려 둔 글이 1개 있습니다. 누르면 열립니다.')).toBeVisible();
  await expect(page.getByText(/힘들 때 쓴 것처럼/)).toHaveCount(0);
  await expect(page.locator('footer.door')).toContainText('자살예방상담전화 109');
  await page.screenshot({ path: '../out/shots/app-week.png', fullPage: false });

  // 라벨 붙이기
  await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
  await page.getByRole('button', { name: '붙이기' }).click();
  await expect(page.locator('.label-pill', { hasText: '긴 겨울' })).toBeVisible();

  // 새로고침해도 남아 있다(IndexedDB)
  await page.reload();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible();
  await expect(page.locator('.wk .lab')).toHaveCount(1);

  // 모두 지우기
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('button', { name: '모두 지우기' }).click();
  await page.getByRole('button', { name: '정말 지웁니다' }).click();
  await expect(page.getByRole('heading', { name: '기록을 가져옵니다' })).toBeVisible();
});

test('좁은 화면에서도 지층과 상세가 세로로 이어진다', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.screenshot({ path: '../out/shots/app-narrow.png', fullPage: true });
  await page.locator('.strata .wk.hit').last().click();
  await expect(page.locator('.sentence').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-narrow-week.png' });
});

test('주 상세 윗부분(문장·게이지)', async ({ page }) => {
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await expect(page.locator('.sentence').first()).toBeVisible();
  // 결과 돌아온 뒤 지켜본 구간(held 인 주)
  await expect(page.locator('.week-head')).toContainText(/고른 결|굵은 결|섞인 결/);
  await expect(page.locator('.sentence').first()).toContainText('그 뒤 4주는 평소 범위였습니다.');
  await expect(page.locator('.strata .wk.span')).toHaveCount(5);
  await page.screenshot({ path: '../out/shots/app-week-top.png' });
});

test('가짜 샘플 원천 파일을 가져와 판정하고 사진을 거른다', async ({ page }) => {
  await page.goto('/?grid');
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  const n = await page.locator('.strata .wk.hit').count();
  expect(n).toBeGreaterThan(3);
  await page.getByRole('button', { name: '다음에' }).click();
  // 사진이 있는 판정 주를 찾아 연다
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  let opened = false;
  for (const wk of weeks.reverse()) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first()).toBeVisible({ timeout: 60000 });
    opened = true;
    break;
  }
  expect(opened).toBe(true);
  await page.screenshot({ path: '../out/shots/app-sample-week.png' });

  // 거의 같은 사진은 한 장만 보이고, 버튼으로 펼친다(합성 사진은 40장을 돌려 써서 같은 사진이 되풀이된다)
  let grouped = false;
  for (const wk of weeks) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate2 = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate2.isVisible()) await gate2.click();
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first().or(page.getByText('보여 드릴 수 있는 사진이 없습니다.'))).toBeVisible({ timeout: 60000 });
    const more = page.locator('.photos .more').first();
    if (!(await more.isVisible())) continue;
    const before = await page.locator('.photos img').count();
    await more.click();
    await expect(page.locator('.photos img')).not.toHaveCount(before);
    expect(await page.locator('.photos img').count()).toBeGreaterThan(before);
    await page.locator('.photos').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: '../out/shots/app-similar-photos.png' });
    grouped = true;
    break;
  }
  expect(grouped).toBe(true);
});

test('같은 이름을 다섯 주에 붙이면 나의 방이 열린다', async ({ page }) => {
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  const weeks = (await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week))).slice(0, 5);
  for (const wk of weeks) {
    await page.locator(`[data-week="${wk}"]`).click();
    await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
    await page.getByRole('button', { name: '붙이기' }).click();
    await expect(page.locator('.label-pill', { hasText: '긴 겨울' })).toBeVisible();
  }
  await page.getByRole('button', { name: '나의 방 열기' }).click();
  await expect(page.getByRole('heading', { name: /나의 방 · 긴 겨울/ })).toBeVisible();
  await expect(page.locator('.room-stage canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '../out/shots/app-room.png' });
  await page.getByRole('button', { name: '다이어리 펼치기' }).click();
  await expect(page.locator('.room-page').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-room-diary.png' });
  await page.getByRole('button', { name: '편지 받침대' }).click();
  await expect(page.getByRole('complementary', { name: '편지 받침대' })).toContainText('3년 후 · 비어 있음');
  await expect(page.getByText('마음이 힘들 때 쓴 것처럼')).toHaveCount(0);
});

test('민디에게 묻기와 시기 페이지', async ({ page }) => {
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await ask(page, '왜 이 주를 골랐어?');
  await expect(page.locator('.ask .bubble')).toContainText('직전 1년');
  await ask(page, '이 주와 닮은 주는 언제야?');
  await expect(page.locator('.ask .bubble')).toContainText('이번은 저도 모릅니다.');
  // 자유 질문: 기기 안 규칙으로 알아듣고, 어떻게 알아들었는지 보여 준다
  await page.getByLabel('민디에게 직접 묻기').fill('잠 못 잔 주는?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await expect(page.locator('.ask .bubble')).toContainText('「잠을 못 잔 주는 언제였어?」로 알아들었습니다.');
  // 질문 13: 같은 칸의 주들을 원문 그대로 모아 본다
  await page.getByLabel('민디에게 직접 묻기').fill('걸음 적었던 주');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await page.getByRole('button', { name: '그 주들 모아 보기' }).click();
  await expect(page.getByRole('heading', { name: '적게 걸은 주 모아 보기' })).toBeVisible();
  await expect(page.locator('.collect-card').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-collect.png' });
  await page.locator('.collect-card .linkish').first().click();
  await expect(page.locator('#wk-title')).toBeVisible();
  await page.getByLabel('민디에게 직접 묻기').fill('메모 남긴 주');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await page.getByRole('button', { name: '기록을 적게 남긴 주는 언제였어?' }).click();
  await expect(page.locator('.ask .bubble')).toContainText('남긴 기록이 있는');
  await page.getByLabel('민디에게 직접 묻기').fill('그때 많이 힘들었지?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await expect(page.locator('.ask .bubble')).toContainText('판정하지 않습니다');
  await page.locator('.ask').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../out/shots/app-ask.png' });
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '시기', exact: true })).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-eras.png' });
});

test('팀 v6 판정 JSON 을 불러와 지층에 보여 주고 다시 내려받는다', async ({ page }) => {
  await page.goto('/?grid');
  await page.getByLabel('팀 v6 판정 JSON').setInputFiles('e2e/fixtures_v6_sample.json');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/팀 v6 판정 JSON 에서 불러온 결과/)).toBeVisible();
  expect(await page.locator('.strata .wk.hit').count()).toBe(80);
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2012-W10"]').click();
  await expect(page.locator('.sentence').first()).toContainText('2012년 3월 5일부터 한 주간');
  await page.getByText('왜 이 주인가').click();
  await expect(page.getByText('(팀 v6 표기)').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-v6-import.png' });
  await page.getByRole('button', { name: '설정' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'v6 JSON 내려받기' }).click()]);
  const j = JSON.parse(await (await dl.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8')));
  expect(j.weeks).toHaveLength(80);
});

test('두 기간 비교', async ({ page }) => {
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '두 기간 비교' })).toBeVisible();
  await page.getByLabel('첫 번째 기간').selectOption({ label: '2022년 여름(6~8월)' });
  await page.getByLabel('두 번째 기간').selectOption({ label: '2025년 여름(6~8월)' });
  await expect(page.locator('.cmp-table tbody tr').first()).toContainText('걸음수');
  await expect(page.locator('.cmp-table')).toContainText('2022년 여름(6~8월)');
  await page.locator('.compare').screenshot({ path: '../out/shots/app-compare.png' });
});

test('편지: 받침대에 두고, 열 때가 오면 다음에 들어왔을 때 찾는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-03T10:00:00') });
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '편지', exact: true }).click();
  await page.getByLabel('편지 내용').fill('내일의 나에게');
  await page.getByLabel('다음 날').check();
  await page.getByRole('button', { name: '받침대에 두기' }).click();
  await expect(page.getByText('다음 날 · 편지 1통')).toBeVisible();
  // 열릴 날짜는 화면에 내지 않는다
  await expect(page.locator('.letters')).not.toContainText('10월 4일');
  await expect(page.getByText('내일의 나에게')).toHaveCount(0);

  // 이틀 뒤 다시 들어오면 머리말에 조용히 보이고, 직접 열어야 읽힌다(알림은 없다)
  await page.clock.setSystemTime(new Date('2026-10-05T10:00:00'));
  await page.reload();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible();
  await page.getByRole('button', { name: '편지 1통' }).click();
  await page.getByRole('button', { name: '편지 열기' }).click();
  await expect(page.getByText('내일의 나에게')).toBeVisible();
  await expect(page.getByText('2026년 10월 3일에 쓴 편지')).toBeVisible();
});

test('기록 더하기: 스크린타임 캡처를 기기 안에서 읽고 깃 커밋과 함께 다시 판정한다', async ({ page }) => {
  // 아이폰 스크린 타임 화면을 흉내 낸 캡처(실제 기기 캡처는 팀원 캡처로 다시 시험한다)
  await page.setContent(`<body style="margin:0"><div style="font-family:-apple-system,'Apple SD Gothic Neo';width:390px;padding:24px;background:#f2f2f7">
    <div style="font-size:17px;font-weight:600;text-align:center">스크린 타임</div><div style="margin-top:22px;font-size:13px;color:#6e6e73">일일 평균</div>
    <div style="font-size:34px;font-weight:700">4시간 23분</div><div style="font-size:15px;margin-top:40px">YouTube 1시간 50분</div></div></body>`);
  const shot = await page.locator('body > div').screenshot();
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await page.getByLabel('스크린타임 캡처').setInputFiles([{ name: 'Screenshot_20250304-221233.png', mimeType: 'image/png', buffer: shot }]);
  await expect(page.getByLabel('Screenshot_20250304-221233.png 분')).toHaveValue('263', { timeout: 60000 });
  await expect(page.getByLabel('Screenshot_20250304-221233.png 종류')).toHaveValue('week_avg');
  await page.getByRole('button', { name: '저장하고 다시 계산' }).click();
  await expect(page.getByText('스크린타임 1개를 더했습니다.')).toBeVisible();
  await page.getByLabel('깃 커밋 기록').setInputFiles([{ name: 'mined_git.txt', mimeType: 'text/plain',
    buffer: Buffer.from(['2025-03-04T23:30:00+09:00', '2025-03-05T10:00:00+09:00', '2025-03-11T09:00:00+09:00'].join('\n')) }]);
  await expect(page.getByText(/커밋 3개\(2025-03-04 ~ 2025-03-11\)를 더했습니다/)).toBeVisible();
  await page.getByRole('button', { name: '처음 화면' }).click();
  await expect(page.locator('tr', { hasText: '스크린타임' })).toContainText('1주');
  await expect(page.locator('tr', { hasText: '스크린타임' })).toContainText('1건');
  // 마지막 주(3/10~)는 기록 범위에 이틀만 걸쳐 부분 관측이라 1주만 센다
  await expect(page.locator('tr', { hasText: '깃헙' })).toContainText('1주');
  // 다시 들어와도 남아 있다
  await page.reload();
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await expect(page.getByText('저장된 스크린타임 1개')).toBeVisible();
});

test('민디 소리: 켜면 사건마다 기기 안에서 음절을 합성하고, 끄면 내지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__osc = 0;
    const AC = window.AudioContext;
    (window as any).AudioContext = class extends AC {
      createOscillator() { (window as any).__osc++; return super.createOscillator(); }
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?grid&dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await ask(page, '왜 이 주를 골랐어?');
  expect(await page.evaluate(() => (window as any).__osc)).toBe(0);
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByLabel(/민디 소리/).check();
  // 이미 고른 주를 다시 눌러도 설정 화면에서 주 화면으로 돌아온다
  await page.locator('[data-week="2025-W20"]').click();
  await ask(page, '왜 이 주를 골랐어?');
  // 광물 칸을 눌러 연 「채굴」 3음절 + 답이 나온 「찾았다」 3음절, 음절마다 진동자 2개
  await expect.poll(() => page.evaluate(() => (window as any).__osc)).toBe(12);
  expect(errors).toEqual([]);
});

test('전시용 키오스크: 샘플을 저절로 불러오고, 쉬는 시간이 지나면 관람객이 남긴 것을 지우고 처음으로 돌아간다', async ({ page }) => {
  await page.goto('/?kiosk=8&grid');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await expect(page.getByRole('button', { name: '다시 가져오기' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음에' }).click();
  const wk = await page.locator('.strata .wk.hit').first().getAttribute('data-week');
  await page.locator(`[data-week="${wk}"]`).click();
  await page.getByLabel('이 주에 붙일 이름').fill('관람객 이름');
  await page.getByRole('button', { name: '붙이기' }).click();
  await expect(page.locator('.strata .wk .lab')).toHaveCount(1);
  // 8초 동안 아무도 만지지 않으면 초기화
  await expect(page.getByText('처음 화면을 준비하고 있습니다.')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await expect(page.locator('.strata .wk .lab')).toHaveCount(0);
  await expect(page.getByText('이번 주의 당신과 가장 닮은 주를 찾아가볼까요?')).toBeVisible();
});

test('영어 자막: 판정 문장·민디 답·도움 안내 아래에 영어가 함께 나온다', async ({ page }) => {
  await page.goto('/?grid&dev&en');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await expect(page.locator('.mindi .sub-en')).toContainText('Shall we look for the week');
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await expect(page.locator('.week-head ~ .sub-en, .sub-en').first()).toContainText('Week of May 12, 2025.');
  await expect(page.locator('.sub-en').first()).toContainText('The 4 weeks after that stayed within the usual range.');
  await page.getByLabel('민디에게 직접 묻기').fill('그때 많이 힘들었지?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await expect(page.locator('.ask .sub-en')).toContainText("I don't judge how you felt");
  await expect(page.locator('footer.door')).toContainText('Korea suicide prevention line 109');
  await page.screenshot({ path: '../out/shots/app-en.png' });
});

test('9/12 회의 반영: 최근 기록으로 열고, 순위는 접고, 한 번 더 묻지 않고, 토글로 고르고, 연구 참여는 설정 안에', async ({ page }) => {
  await page.goto('/?grid&dev');
  // 가져오기: 켜면 그 기록을 내보내는 방법이 열리는 토글
  await page.getByRole('switch', { name: /건강.*가져오기/ }).check();
  await expect(page.getByText('모든 건강 데이터 내보내기', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  // 여는 화면: 앱이 고른 주가 아니라 가장 최근에 글·사진이 남은 주(날짜 순서로만)
  await expect(page.getByLabel('가장 최근에 남은 기록')).toBeVisible();
  await expect(page.getByLabel('가장 최근에 남은 기록').locator('.memo').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '판정 요약' })).toHaveCount(0);
  await expect(page.getByText('가져온 기록과 요약')).toBeVisible();
  await page.getByRole('button', { name: '다음에' }).click();
  // 두드러진 주도 바로 열리고(주 단위 확인 없음), 첫 문장에는 순위가 없다
  await page.locator('[data-week="2025-W20"]').click();
  await expect(page.getByRole('button', { name: '그때 기록 열어 보기' })).toHaveCount(0);
  await expect(page.locator('.sentence').first()).toContainText('걸음수가 평소보다 적었습니다');
  await expect(page.locator('.sentence').first()).not.toContainText('직전 52주');
  await expect(page.locator('.memo').first()).toBeVisible();
  // 순위·근거·게이지는 「왜 이 주인가」 안에
  await expect(page.getByText('직전 52주 중 가장 적었습니다')).toBeHidden();
  await page.getByText('왜 이 주인가').click();
  await expect(page.getByText(/직전 52주 중 가장 적었습니다/).first()).toBeVisible();
  // 정해진 질문 버튼 대신 문장으로 묻기
  await expect(page.getByRole('button', { name: '왜 이 주를 골랐어?' })).toHaveCount(0);
  await page.getByRole('button', { name: '이 주와 닮은 주는 언제야?' }).click();
  await expect(page.locator('.ask .bubble')).toContainText('「이 주와 닮은 주는 언제야?」로 알아들었습니다.');
  // 연구 참여는 설정 안에서 연다
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('button', { name: '연구 참여 화면 열기' }).click();
  await expect(page.getByText('판정이 실제 삶의 일과 맞는지 알아보는 평가입니다.', { exact: false })).toBeVisible();
});
