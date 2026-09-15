// 시연 영상 녹화: 가짜 샘플 기록으로 전 과정을 한 번에 보여 준다(자막은 녹화용으로 화면에 덧그린다).
// 실행: cd web && npx playwright test -c playwright.demo.config.ts
import { expect, test, type Page } from '@playwright/test';

const EVENTS = [
  { start: '2025-03-03', end: '2025-03-21', kind: 'hard', note: '몸이 아팠던 때' },
  { start: '2025-06-23', end: '2025-06-27', kind: 'good', note: '제주 여행' },
  { start: '2025-09-01', end: '', kind: 'change', note: '이직' },
];

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
  test.setTimeout(600000);
  await page.goto('/');
  await cap(page, 'Mine D 멘토 뼈대입니다. 이미 있는 기록만 쓰고, 파일은 이 브라우저 밖으로 나가지 않습니다.', 4000);

  // 1. 결과를 보기 전에 사건 봉인
  await page.getByRole('button', { name: '사건 먼저 적기' }).click();
  await cap(page, '실제 기록 평가는 결과를 보기 전에 날짜가 확실한 일을 적는 것부터 시작합니다.', 3500);
  for (const e of EVENTS) {
    await page.getByLabel('어떤 일').selectOption(e.kind);
    await page.getByLabel('시작한 날').fill(e.start);
    if (e.end) await page.getByLabel('끝난 날(하루면 비워 둠)').fill(e.end);
    await page.getByLabel('메모(선택, 이 기기에만 남음)').fill(e.note);
    await page.getByRole('button', { name: '사건 더하기' }).click();
    await page.waitForTimeout(400);
  }
  await cap(page, '아팠던 주, 여행, 이직처럼 날짜를 확인할 수 있는 일만 적습니다. 메모는 이 기기에만 남습니다.', 3500);
  await page.getByRole('button', { name: '봉인하기' }).click();
  await cap(page, '봉인하면 사건 목록의 확인값이 저장되고, 뒤에 고치면 그 사실이 보고서에 남습니다.', 3500);

  // 2. 가져오기와 판정
  await page.getByRole('button', { name: '기록 가져오러 가기' }).click();
  await cap(page, '이제 기록을 가져옵니다. 여기서는 가짜 샘플(합성 인물 2년치)로 보여 드립니다.', 3500);
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await cap(page, '카카오톡·인스타그램·AI 대화·건강·메모·사진을 브라우저 안에서 읽고, Python 판정 코어가 주 단위로 판정합니다.', 4000);
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await hideCap(page);
  await page.waitForTimeout(800);

  // 3. 지층과 민디
  await cap(page, '한 줄이 한 해, 한 칸이 한 주입니다. 색이 있는 칸이 직전 52주와 견줘 평소를 벗어난 주입니다.', 4500);
  await cap(page, '민디는 들어올 때 한 번만 먼저 말을 겁니다. 그다음부터는 묻는 말에만 답합니다.', 3500);
  await page.getByRole('button', { name: '다음에' }).click();

  // 4. 주 상세
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  let photoWeek = '';
  for (const wk of [...weeks].reverse()) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) {
      await cap(page, '판정이 두드러진 주는 바로 열지 않고 한 번 더 묻습니다.', 2500);
      await gate.click();
    }
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first().or(page.getByText('보여 드릴 수 있는 사진이 없습니다.'))).toBeVisible({ timeout: 60000 });
    if (await page.locator('.photos .more').first().isVisible()) { photoWeek = wk!; break; }
  }
  await page.locator('.sentence').first().scrollIntoViewIfNeeded();
  await cap(page, '판정 문장은 계산한 순위를 그대로 옮긴 것입니다. AI 가 지어낸 문장이 아닙니다.', 4000);
  await page.locator('.gauges').scrollIntoViewIfNeeded();
  await cap(page, '걸음·잠·화면·기록 네 축으로 그 주의 자리를 보여 주고, 어떤 기록이 근거인지 적습니다.', 4000);
  await page.locator('.memo').first().scrollIntoViewIfNeeded();
  await cap(page, '그때 쓴 글은 요약하지 않고 그대로 돌려줍니다. 비밀번호처럼 보이는 메모는 가립니다.', 4000);
  await page.locator('.photos').first().scrollIntoViewIfNeeded();
  await cap(page, '사진은 기기 안에서 얼굴·글자·화면 캡처를 걸러냅니다. 거의 같은 사진은 한 장만 보여 줍니다.', 4000);
  const more = page.locator('.photos .more').first();
  if (await more.isVisible()) {
    await more.click();
    await cap(page, '버튼을 누르면 묶어 둔 사진이 펼쳐집니다.', 2500);
  }

  // 5. 민디에게 묻기와 이름 붙이기
  await page.getByRole('button', { name: '왜 이 주를 골랐어?' }).click();
  await page.locator('.ask').scrollIntoViewIfNeeded();
  await cap(page, '민디에게 물으면 판정값으로 만든 문장으로만 답하고, 앞일은 모른다고 말합니다.', 4000);
  await page.getByLabel('이 주에 붙일 이름').scrollIntoViewIfNeeded();
  await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
  await page.getByRole('button', { name: '붙이기' }).click();
  await cap(page, '주에 이름을 붙일 수 있습니다. 같은 이름을 다섯 주에 붙이면 그 이름의 방이 열립니다.', 4000);

  // 6. 시기와 두 기간 비교
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '두 기간 비교' })).toBeVisible();
  await cap(page, '여러 기록이 함께 달라진 지점으로 시기를 나눕니다. 계절 때문에 해마다 되풀이되는 변화는 뺐습니다.', 4500);
  await page.locator('.era-block').first().scrollIntoViewIfNeeded();
  await cap(page, '시기마다 무엇이 얼마나 달라졌는지 수치로 적고, 모든 줄은 원래 주로 이어집니다.', 4000);

  // 7. 이어진 섬
  await page.getByRole('button', { name: '이어진 섬' }).click();
  await cap(page, '이어진 섬은 설계 시연입니다. 초대 코드를 받은 이웃만 보이고, 내가 공개한 방 이름만 건너갑니다.', 4000);
  await page.getByLabel('초대 코드').fill('MINE-3F7K');
  await page.getByRole('button', { name: '받기' }).click();
  await page.getByRole('checkbox', { name: /긴 겨울/ }).check();
  await cap(page, '같은 이름의 방이 있을 때만 다리가 놓입니다. 이웃 섬에서는 원문도 날짜도 보이지 않습니다.', 4000);
  await page.getByRole('button', { name: '섬에 들르기' }).click();
  await cap(page, '이웃 섬에는 공개한 방 이름과 방명록만 있습니다. 판정 문장도, 그때 쓴 글도 건너가지 않습니다.', 4000);

  // 8. 나의 방
  await page.getByRole('button', { name: '처음 화면' }).click();
  await cap(page, '같은 이름을 다섯 주에 붙여 보겠습니다.', 2500);
  const five = weeks.slice(0, 5);
  for (const wk of five) {
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
  await cap(page, '나의 방에는 그 이름의 주들에 찍은 사진이 액자로, 쓴 글이 다이어리로, 주마다 광물 표본 하나가 놓입니다.', 4500);
  await page.getByRole('button', { name: '다이어리 펼치기' }).click();
  await cap(page, '헤드셋 브라우저에서는 같은 방을 가상현실로 걸어 다닐 수 있습니다.', 3500);

  // 9. 평가 마무리
  await page.getByRole('button', { name: '평가', exact: true }).click();
  await page.getByRole('button', { name: '가린 주 고르기' }).click();
  await cap(page, '판정된 주와 평범한 주를 섞어 날짜만 보여 주고, 기억에 남는 주였는지 묻습니다.', 4000);
  const answers = ['기억에 남는 주였습니다', '평범한 주였습니다', '잘 모르겠습니다'];
  for (let i = 0; i < 30; i++) {
    if (await page.getByText('모두 답했습니다').isVisible()) break;
    await page.getByRole('button', { name: answers[i % 3] }).click();
    await page.waitForTimeout(120);
  }
  await page.getByLabel('참가 코드').fill('P1');
  await page.getByRole('button', { name: '계산하기' }).click();
  await cap(page, '봉인한 사건과 방금 답한 내용으로 판정이 얼마나 맞았는지 이 브라우저 안에서 계산합니다.', 5000);
  await expect(page.getByRole('button', { name: '보고서 내려받기' })).toBeVisible({ timeout: 180000 });
  await page.locator('.report').scrollIntoViewIfNeeded();
  await cap(page, '사건 재현율, 우연보다 몇 배 몰렸는지, 채널 하나를 빼도 남는지까지 숫자로 나옵니다.', 5000);
  await cap(page, '멘토에게 보내는 보고서에는 숫자만 들어갑니다. 날짜와 원문은 기기에 남습니다.', 4500);

  // 10. 마무리
  await page.getByRole('button', { name: '설정' }).click();
  await cap(page, '기록은 언제든 이 브라우저에서 모두 지울 수 있습니다. 원래 파일은 그대로 남습니다.', 4000);
  await cap(page, 'Mine D 멘토 뼈대 · 판정 코어와 화면, 명령줄 가져오기, 실제 기록 평가까지.', 4000);
  await hideCap(page);
  await page.waitForTimeout(1000);
});
