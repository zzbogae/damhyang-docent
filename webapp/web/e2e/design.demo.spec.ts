// 작동 영상(드라이브 디자인 적용판, 2026-10-03): 입장 → 민디 소개 → 가져오기 → 광물 지하 → 주 상세·3회 채굴 → 민디 → 편지.
// 가짜 샘플(합성 인물) 기록만 쓴다. 자막은 녹화용으로 화면에 덧그린다.
// 실행: cd web && npx playwright test -c playwright.demo.config.ts -g "작동 영상"
import { expect, test, type Page } from '@playwright/test';

async function cap(page: Page, text: string, ms = 3000, top = false) {
  await page.evaluate(([t, onTop]) => {
    let el = document.getElementById('demo-cap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-cap';
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:40px', 'transform:translateX(-50%)', 'z-index:99999',
        'max-width:82vw', 'padding:12px 24px', 'border-radius:999px', 'background:rgba(27,22,32,0.9)',
        'border:1px solid rgba(242,170,85,0.45)', 'color:#F3E9DC',
        'font:500 20px/1.45 "Pretendard Variable",-apple-system,"Apple SD Gothic Neo",sans-serif',
        'text-align:center', 'pointer-events:none', 'box-shadow:0 10px 30px rgba(0,0,0,0.4)', 'transition:opacity .3s',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = t as string;
    el.style.top = onTop ? '40%' : 'auto';
    el.style.bottom = onTop ? 'auto' : '40px';
    el.style.opacity = '1';
  }, [text, top] as const);
  await page.waitForTimeout(ms);
  await page.evaluate(() => { const el = document.getElementById('demo-cap'); if (el) el.style.opacity = '0'; });
}

test('작동 영상', async ({ page }) => {
  test.setTimeout(600000);
  // 0~1. 입장 인트로 → 민디 소개(한 화면씩 넘어간다). 자동 실행에서는 인트로가 꺼져 있어 ?intro 로 연다
  await page.goto('/?intro');
  await page.waitForTimeout(4800);
  await cap(page, 'Mine D(마인디). 폰에 이미 쌓인 기록에서, 평소와 달랐던 주를 광물로 캐냅니다.', 4000, true);
  await page.getByRole('button', { name: '입장하기' }).click();
  await page.waitForTimeout(1200);
  await cap(page, '민디가 안내합니다. 민디는 「언제」까지만 알고, 「왜」는 모른다고 말합니다.', 3500, true);
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: '다음' }).click(); await page.waitForTimeout(1600); }
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.waitForTimeout(1200);
  await cap(page, '기록은 이 브라우저 밖으로 나가지 않습니다.', 3000);

  // 2. 가져오기
  await cap(page, '구글·건강·카카오톡·인스타그램·AI 대화·사진 내보내기 파일을 이 기기 안에서 읽습니다. 여기서는 가짜 샘플 2년치로 보여 드립니다.', 5000);
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.waitForTimeout(800);

  // 3. 민디 첫 인사(누를 때만 찾는다)
  await cap(page, '민디는 한 번만 먼저 인사합니다. 이번 주와 닮은 주를 찾을지는 사용자가 정합니다.', 4000);
  await page.getByRole('button', { name: '찾아가 보기' }).click();
  await page.waitForTimeout(1200);
  await cap(page, '가장 닮은 지난 주를 찾았습니다. 그때 왜 그랬는지는 모른다고 함께 말합니다.', 4000);
  await page.getByRole('button', { name: '그 주 열어 보기' }).click().catch(() => {});
  await page.waitForTimeout(800);

  // 4. 광물 지하
  await page.locator('.yearmine').scrollIntoViewIfNeeded();
  await cap(page, '광물 지하입니다. 한 해를 크게 띄우고, 그해 평소를 벗어난 주를 광물로 보여 줍니다.', 4500);
  await cap(page, '가로는 한 해의 시기, 세로는 광물을 정한 축입니다. 걸음이 많으면 호박, 화면을 많이 보면 자수정입니다.', 5000);
  await page.getByRole('button', { name: '이전 해' }).click();
  await page.waitForTimeout(1500);
  // 광물이 여러 개인 해에서, 그때 쓴 글이 남은 주를 고른다(호박부터)
  const ores = page.locator('.ym-ore');
  const labels = await ores.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  const order = [...labels.keys()].sort((a, b) => Number(!labels[a].includes('호박')) - Number(!labels[b].includes('호박')));
  for (const i of order) {
    await ores.nth(i).click();
    await page.waitForTimeout(600);
    if (await page.locator('.memo').first().isVisible()) break;
  }
  await page.waitForTimeout(600);

  // 5. 주 상세 · 3회 채굴
  const right = page.locator('.col.right');
  await right.evaluate((e) => e.scrollTo({ top: 0 }));
  await cap(page, '광물을 누르면 그 주가 열립니다. 세 번 쳐서 캐 봅니다.', 3200);
  const ore = page.locator('.dig-ore');
  for (let i = 0; i < 3; i++) { await ore.click(); await page.waitForTimeout(700); }
  await page.waitForTimeout(800);
  await cap(page, '그때 쓴 글은 요약하지 않고 그대로 돌려줍니다.', 3800);
  await right.evaluate((e) => e.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(900);
  await cap(page, '문장은 판정하지 않습니다. 「평소보다 많았다·적었다」와 그 뒤 4주가 어땠는지만 말합니다.', 4800);
  await page.getByText('왜 이 주인가').click();
  await page.locator('.gauges').scrollIntoViewIfNeeded();
  await cap(page, '근거는 「왜 이 주인가」 안에 있습니다. 걸음·쉼·화면·기록 네 축을 내 평소와만 견줍니다.', 4800);

  // 6. 민디에게 묻기
  await page.locator('.ask').scrollIntoViewIfNeeded();
  await page.getByLabel('민디에게 직접 묻기').fill('이 주에 무엇이 달랐어?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await cap(page, '민디에게 직접 물을 수 있습니다. 이 기기 안에서 알아듣고, 계산한 값으로만 답합니다.', 4500);
  await page.getByLabel('민디에게 직접 묻기').fill('그때 많이 힘들었지?');
  await page.getByRole('button', { name: '묻기', exact: true }).click();
  await cap(page, '마음을 묻는 말에는 판정하지 않는다고 답합니다.', 3800);

  // 7. 편지
  await page.getByRole('button', { name: '편지', exact: true }).click();
  await page.getByLabel('편지 내용').fill('한 달 뒤의 나에게. 오늘은 산책을 오래 했다.');
  await page.getByLabel('다음 달').check();
  await page.getByRole('button', { name: '받침대에 두기' }).click();
  await cap(page, '앞으로의 나에게 편지를 둡니다. 알림은 오지 않고, 다음에 들어왔을 때 캘 수 있습니다.', 4500);

  // 8. 마무리
  await page.getByRole('button', { name: '처음 화면' }).click();
  await page.locator('.yearmine').scrollIntoViewIfNeeded();
  await cap(page, '이야기를 들어 줄 곳(109)은 어떤 주인지와 상관없이 모든 화면 아래에 늘 있습니다.', 4200);
  await cap(page, 'Mine D · 이미 있는 기록으로, 판정하지 않고, 그때 그대로를 돌려줍니다.', 4000);
  await page.waitForTimeout(800);
});
