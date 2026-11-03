// v2(11/03) 민디와 이야기 · 라이프로그 챗봇 상태 화면: 답 기다리는 중 / 그만 기다리기 / 연결 오류 → 다시 연결해 보기.
// 챗봇 서버는 page.route 로 흉내 낸다(실제 기록·외부 모델을 쓰지 않는다).
import { expect, test, type Page } from '@playwright/test';

async function openTalk(page: Page) {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
  await page.locator('.obs-btn.c').click();
  await page.getByRole('tab', { name: '이야기 나누기' }).click();
  await page.getByRole('button', { name: '알겠어요' }).click();
}

async function sendFree(page: Page, t: string) {
  await page.getByLabel('민디에게 직접 묻기').fill(t);
  await page.getByRole('button', { name: '보내기' }).click();
}

test('챗봇 상태: 기다리는 중 → 그만 기다리기, 연결 오류 → 다시 연결해 보기', async ({ page }) => {
  test.setTimeout(240000);
  let mode: 'hang' | 'fail' | 'ok' = 'hang';
  await page.route('**/api/lifebot/health', (r) => r.fulfill({ status: 200, body: '{"ok":true}' }));
  await page.route('**/api/lifebot/chat', async (r) => {
    if (mode === 'hang') { await new Promise((res) => setTimeout(res, 9000)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { reply: '늦은 답', tools: [], focus_title: null } }) }).catch(() => {}); }
    if (mode === 'fail') return r.fulfill({ status: 502, body: 'bad gateway' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { reply: '바다 사진이 세 장 있어요.', tools: ['photos'], focus_title: null } }) });
  });
  await openTalk(page);

  // 기다리는 중: 바로 보이고, 6초가 넘으면 「조금 더」가 붙는다
  await sendFree(page, '바다 좋아해?');
  const wait = page.locator('.chat-wait');
  await expect(wait).toContainText('민디가 기록을 찾는 중이에요.');
  await expect(wait).toContainText('조금 더 걸리고 있어요', { timeout: 9000 });
  await page.screenshot({ path: 'test-results/chat-wait.png' });
  await page.getByRole('button', { name: '그만 기다리기' }).click();
  await expect(page.locator('.talk-log')).toContainText('기다리기를 멈췄어요.');
  await expect(page.locator('.chat-err')).toHaveCount(0);

  // 연결 오류: 기기 안 답 + 안내 + 다시 연결해 보기
  mode = 'fail';
  await sendFree(page, '바다 사진 있어?');
  const err = page.locator('.chat-err');
  await expect(err).toContainText('챗봇과 연결되지 않았어요.');
  await page.screenshot({ path: 'test-results/chat-error.png' });
  mode = 'ok';
  await err.getByRole('button', { name: '다시 연결해 보기' }).click();
  await expect(page.locator('.talk-log')).toContainText('바다 사진이 세 장 있어요.');
  await expect(page.locator('.chat-err')).toHaveCount(0);
});
