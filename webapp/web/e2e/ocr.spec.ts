// 스크린타임 캡처 읽기: 아이폰 스크린 타임·삼성 디지털 웰빙 화면을 흉내 낸 캡처를 만들어 기기 안 OCR 로 읽는다.
// 실행: cd web && npx playwright test -c playwright.lab.config.ts ocr
// 실제 기기 캡처가 아니므로 글꼴·배치가 다를 수 있다. 실제 캡처 시험은 팀원 캡처로 다시 한다.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../../out/ocr');

const IOS = (avg: string) => `<div style="font-family:-apple-system,'Apple SD Gothic Neo';width:390px;padding:24px;background:#f2f2f7">
  <div style="font-size:17px;font-weight:600;text-align:center">스크린 타임</div>
  <div style="margin-top:22px;font-size:13px;color:#6e6e73">일일 평균</div>
  <div style="font-size:34px;font-weight:700">${avg}</div>
  <div style="font-size:13px;color:#6e6e73;margin-top:6px">지난주 대비 12% 감소</div>
  <div style="height:120px;margin:18px 0;background:linear-gradient(90deg,#0a84ff 0 40%,#5ac8fa 40% 70%,#ffcc00 70%)"></div>
  <div style="font-size:15px;display:flex;justify-content:space-between"><span>YouTube</span><span>1시간 50분</span></div>
  <div style="font-size:15px;display:flex;justify-content:space-between;margin-top:10px"><span>카카오톡</span><span>48분</span></div></div>`;
const SAMSUNG = (today: string) => `<div style="font-family:'Apple SD Gothic Neo';width:390px;padding:24px;background:#fff">
  <div style="font-size:20px;font-weight:700">디지털 웰빙</div>
  <div style="margin-top:20px;font-size:14px;color:#555">오늘</div>
  <div style="font-size:30px;font-weight:700;color:#1a73e8">${today}</div>
  <div style="font-size:14px;margin-top:20px;display:flex;justify-content:space-between"><span>Instagram</span><span>35분</span></div></div>`;

const CASES = [
  { name: 'ios_week.png', html: IOS('4시간 23분'), minutes: 263, kind: 'week_avg' },
  { name: 'ios_week2.png', html: IOS('6시간 7분'), minutes: 367, kind: 'week_avg' },
  { name: 'samsung_today.png', html: SAMSUNG('2시간 15분'), minutes: 135, kind: 'day' },
  { name: 'samsung_today2.png', html: SAMSUNG('58분'), minutes: 58, kind: 'day' },
];

test('스크린타임 캡처에서 사용 시간을 읽는다', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = [];
  for (const c of CASES) {
    await page.setContent(`<body style="margin:0">${c.html}</body>`);
    const buf = await page.locator('body > div').screenshot({ scale: 'device' });
    fs.writeFileSync(path.join(OUT, c.name), buf);
    files.push({ name: c.name, mimeType: 'image/png', buffer: buf });
  }
  await page.goto('/lab/ocr.html');
  await page.locator('#files').setInputFiles(files);
  const rows = (await page.evaluate(() => window.__ocrRun())) as any[];
  fs.writeFileSync(path.join(OUT, 'ocr_report.json'), JSON.stringify(rows, null, 1));
  for (const c of CASES) {
    const r = rows.find((x) => x.name === c.name);
    expect(r.reading, `${c.name}: ${JSON.stringify(r.lines)}`).toMatchObject({ minutes: c.minutes, kind: c.kind });
  }
});
