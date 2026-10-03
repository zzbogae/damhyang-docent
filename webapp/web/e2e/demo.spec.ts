// 시연 영상 녹화(발표용, 2026-10-03 판): 가짜 샘플 기록으로 가져오기 → 지층 → 주 상세 → 민디 → 모아 보기 → 편지 → 기록 더하기 → 나의 방.
// 팀 요청대로 이어진 갱도와 평가 화면은 넣지 않는다. 자막은 녹화용으로 화면에 덧그린다.
// 실행: cd web && npx playwright test -c playwright.demo.config.ts
import { expect, test, type Page } from '@playwright/test';

async function cap(page: Page, text: string, ms = 3000) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-cap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-cap';
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:26px', 'transform:translateX(-50%)', 'z-index:99999',
        'max-width:80vw', 'padding:12px 22px', 'border-radius:999px', 'background:rgba(22,21,26,0.86)',
        'color:#fbfaf8', 'font:500 20px/1.45 -apple-system,"Apple SD Gothic Neo",sans-serif',
        'text-align:center', 'pointer-events:none', 'box-shadow:0 8px 30px rgba(22,21,26,0.25)',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = '1';
  }, text);
  await page.waitForTimeout(ms);
  await hideCap(page);
}

function hideCap(page: Page) {
  return page.evaluate(() => {
    const el = document.getElementById('demo-cap');
    if (el) el.style.opacity = '0';
  });
}

test('시연 영상', async ({ page }) => {
  test.setTimeout(900000);
  // 기록 더하기에 넣을 스크린타임 캡처(아이폰 화면을 흉내 낸 것)
  await page.setContent(`<body style="margin:0"><div style="font-family:-apple-system,'Apple SD Gothic Neo';width:390px;padding:24px;background:#f2f2f7">
    <div style="font-size:17px;font-weight:600;text-align:center">스크린 타임</div><div style="margin-top:22px;font-size:13px;color:#6e6e73">일일 평균</div>
    <div style="font-size:34px;font-weight:700">4시간 23분</div><div style="font-size:15px;margin-top:40px">YouTube 1시간 50분</div></div></body>`);
  const shot = await page.locator('body > div').screenshot();

  // 0. 이전(9/12) · 이후(10/3) 비교: 같은 합성 기록, 같은 주. 이전 판은 BEFORE_URL 에 띄워 둔다(없으면 건너뜀)
  const BEFORE = process.env.BEFORE_URL;
  if (BEFORE) {
    const fixture = async (base: string) => {
      await page.goto(`${base}/?dev`);
      await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
      await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
      await page.getByRole('button', { name: '다음에' }).click();
    };
    const open = async (wk: string) => {
      await page.locator(`[data-week="${wk}"]`).click();
      const g = page.getByRole('button', { name: '그때 기록 열어 보기' });
      if (await g.isVisible()) await g.click();
    };
    await fixture(BEFORE);
    await cap(page, '먼저 무엇이 달라졌는지 봅니다. 이전 판(9/12)입니다.', 3000);
    await open('2022-W42');
    await cap(page, '이전: 돌아왔다가 다시 벗어난 주에도 「확인되지 않았습니다」가 붙었습니다. 사실과 다른 문장입니다.', 5000);
    await open('2024-W10');
    await page.locator('.help').scrollIntoViewIfNeeded();
    await cap(page, '이전: 위기 표현을 감지한 주에만 109 안내가 떴습니다. 감지 자체가 판정이 됩니다.', 5000);
    await fixture('');
    await cap(page, '같은 기록으로 띄운 지금 판(10/3)입니다.', 3000);
    await open('2022-W42');
    await cap(page, '이후: 재이탈 주는 따로 구분하고, 팀 문안이 정해질 때까지 문장을 붙이지 않습니다. 광물도 축과 방향으로 정해집니다.', 5500);
    await open('2024-W10');
    await page.getByText('가려 둔 글이').scrollIntoViewIfNeeded();
    await cap(page, '이후: 가린 글에는 사실만 적고, 109 안내는 어떤 주든 모든 화면 아래에 늘 있습니다.', 5000);
    await open('2025-W20');
    await cap(page, '그 뒤가 평소였던 주에는 결 표시와 함께 「그 뒤 4주는 평소 범위였습니다」가 붙고, 지층에 그 4주가 밑줄로 표시됩니다.', 5500);
    await page.getByRole('button', { name: '설정' }).click();
    await page.getByRole('button', { name: '모두 지우기' }).click();
    await page.getByRole('button', { name: '정말 지웁니다' }).click();
  }

  await page.goto('/');
  await cap(page, 'Mine D 입니다. 이미 있는 기록만 쓰고, 파일은 이 브라우저 밖으로 나가지 않습니다.', 4000);

  // 1. 가져오기와 판정
  await page.getByRole('switch', { name: /건강.*가져오기/ }).check();
  await cap(page, '가져올 기록을 스위치로 고릅니다. 켜면 그 기록을 내보내는 방법이 열립니다.', 4000);
  await cap(page, '여기서는 가짜 샘플(합성 인물 2년치)로 보여 드립니다.', 3000);
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await cap(page, '카카오톡·인스타그램·AI 대화·건강·메모·사진을 브라우저 안에서 읽고, 주 단위로 계산합니다.', 4000);
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await hideCap(page);
  await page.waitForTimeout(800);

  await cap(page, '여는 화면은 가장 최근에 글과 사진이 남은 주입니다. 격자나 순위보다 그때의 기록이 먼저 보입니다.', 5000);

  // 2. 지층과 광물 9종
  await cap(page, '한 줄이 한 해, 한 칸이 한 주입니다. 색이 있는 칸이 직전 1년과 견줘 평소를 벗어난 주입니다.', 4500);
  await page.locator('.legend').scrollIntoViewIfNeeded();
  await cap(page, '광물은 어느 축이 많았는지 적었는지를 말합니다. 걸음이 많으면 호박, 적으면 황철석입니다.', 4500);
  await page.getByRole('button', { name: '다음에' }).click();

  // 3. 주 상세
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  for (const wk of [...weeks].reverse()) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    if (await page.locator('.memo').first().isVisible()) break;
  }
  await page.locator('.sentence').first().scrollIntoViewIfNeeded();
  await cap(page, '첫 문장은 순위 대신 「평소보다」로 씁니다. 두드러진 주도 한 번 더 묻지 않고 바로 열립니다.', 4500);
  await page.locator('.memo').first().scrollIntoViewIfNeeded();
  await cap(page, '그때 쓴 글은 요약하지 않고 그대로 돌려줍니다.', 3500);
  await page.getByText('왜 이 주인가').click();
  await page.locator('.gauges').scrollIntoViewIfNeeded();
  await cap(page, '순위·근거·네 축 게이지는 「왜 이 주인가」 안에 접어 두었습니다. 남과 비교하지 않습니다.', 4500);
  await cap(page, '도움을 받을 수 있는 곳은 어떤 주인지와 상관없이 모든 화면 아래에 늘 있습니다.', 4000);

  // 4. 민디에게 묻기와 모아 보기
  await page.locator('.ask').scrollIntoViewIfNeeded();
  // 샘플에서 두 주 이상 잡힌 칸을 찾아 묻는다(모아 보기 버튼은 두 주 이상일 때만 나온다)
  for (const q of ['화면을 많이 본 주는 언제야?', '기록을 많이 남긴 주는 언제야?', '걸음 적었던 주는 언제야?', '잠을 못 잔 주는 언제야?', '기록을 적게 남긴 주는?']) {
    await page.getByLabel('민디에게 직접 묻기').fill(q);
    await page.getByRole('button', { name: '묻기', exact: true }).click();
    await page.waitForTimeout(300);
    if (await page.getByRole('button', { name: '그 주들 모아 보기' }).isVisible()) break;
  }
  await cap(page, '민디에게 직접 물을 수 있습니다. 이 기기 안에서 질문을 알아듣고, 계산한 값으로만 답합니다.', 4500);
  await page.getByRole('button', { name: '그 주들 모아 보기' }).click();
  await cap(page, '같은 질문에 해당하는 주들을 모아, 그때 쓴 글과 사진을 고치지 않고 한 화면에 보여 줍니다.', 4500);
  await page.locator('[data-week]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '처음 화면' }).click();
  await page.locator(`[data-week="${weeks[weeks.length - 1]}"]`).click();
  const gate2 = page.getByRole('button', { name: '그때 기록 열어 보기' });
  if (await gate2.isVisible()) await gate2.click();
  await page.locator('.ask').scrollIntoViewIfNeeded();
  await page.getByLabel('민디에게 직접 묻기').fill('그때 많이 힘들었지?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await cap(page, '마음을 묻는 말에는 판정하지 않는다고 답합니다.', 3500);

  // 5. 편지
  await page.getByRole('button', { name: '편지', exact: true }).click();
  await page.getByLabel('편지 내용').fill('한 달 뒤의 나에게. 오늘은 산책을 오래 했다.');
  await page.getByLabel('다음 달').check();
  await page.getByRole('button', { name: '받침대에 두기' }).click();
  await cap(page, '앞으로의 나에게 편지를 둡니다. 알림은 오지 않고, 열릴 날짜도 보여 주지 않습니다.', 4500);
  await cap(page, '열 때가 되면 다음에 들어왔을 때 편지를 캘 수 있습니다.', 3500);

  // 6. 기록 더하기
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await page.locator('.extras').scrollIntoViewIfNeeded();
  await page.getByLabel('스크린타임 캡처').setInputFiles([{ name: 'Screenshot_20250304-221233.png', mimeType: 'image/png', buffer: shot }]);
  await expect(page.getByLabel('Screenshot_20250304-221233.png 분')).toHaveValue('263', { timeout: 60000 });
  await cap(page, '스크린타임 캡처를 넣으면 이 기기 안에서 글자를 읽어 사용 시간만 남깁니다.', 4500);
  await page.getByRole('button', { name: '저장하고 다시 계산' }).click();
  await expect(page.getByText('스크린타임 1개를 더했습니다.')).toBeVisible({ timeout: 60000 });
  await cap(page, '깃 커밋 기록도 같은 방식으로 더할 수 있습니다.', 3000);

  // 7. 나의 방
  await page.getByRole('button', { name: '처음 화면' }).click();
  await cap(page, '같은 이름을 다섯 주에 붙여 보겠습니다.', 2500);
  for (const wk of weeks.slice(0, 5)) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
    await page.getByRole('button', { name: '붙이기' }).click();
    await page.waitForTimeout(200);
  }
  await page.getByRole('button', { name: '나의 방', exact: false }).first().click();
  await expect(page.locator('.room-stage canvas')).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await cap(page, '나의 방에는 그 주들에 찍은 사진이 액자로, 쓴 글이 다이어리로, 주마다 광물 표본 하나가 놓입니다.', 4500);
  await page.getByRole('button', { name: '다이어리 펼치기' }).click();
  await cap(page, '헤드셋 브라우저에서는 같은 방을 가상현실로 걸어 다닐 수 있습니다.', 3500);

  await page.getByRole('button', { name: '편지 받침대' }).click();
  await cap(page, '방에는 편지 받침대 다섯 개가 놓입니다. 편지 수만 보이고, 열릴 날짜는 보이지 않습니다.', 4000);

  // 8. 영어 자막과 전시용 키오스크
  await page.goto('/?en');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });
  const hit = await page.locator('.strata .wk.hit').last().getAttribute('data-week');
  const g3 = page.getByRole('button', { name: '다음에' });
  if (await g3.isVisible()) await g3.click();
  await page.locator(`[data-week="${hit}"]`).click();
  await cap(page, '영어 자막을 켜면 주 문장과 민디의 답 아래에 영어가 함께 나옵니다. 번역기가 아니라 같은 계산 값에서 만든 문장입니다.', 5500);
  await page.goto('/?kiosk=8');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });
  await cap(page, '전시용 키오스크 모드입니다. 아무도 만지지 않으면 관람객이 남긴 것을 지우고 처음 화면으로 돌아갑니다.', 4000);
  await expect(page.getByText('처음 화면을 준비하고 있습니다.')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });

  // 9. 마무리
  await page.getByRole('button', { name: '설정' }).click();
  await cap(page, '기록은 언제든 이 브라우저에서 모두 지울 수 있습니다. 원래 파일은 그대로 남습니다.', 4000);
  await cap(page, 'Mine D · 이미 있는 기록으로, 판정하지 않고, 그때 그대로를 돌려줍니다.', 4000);
  await hideCap(page);
  await page.waitForTimeout(1000);
});
