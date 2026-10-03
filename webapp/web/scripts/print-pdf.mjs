// 단계별 작업 정리 HTML 을 A4 PDF 로 인쇄한다(크로미움 인쇄 엔진).
//   cd mined/web && node scripts/print-pdf.mjs <입력.html> <출력.pdf>
import { chromium } from '@playwright/test';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.resolve(input), { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
const foot = '<div style="width:100%;font-size:8pt;color:#5d5966;font-family:-apple-system,sans-serif;padding:0 14mm;display:flex;justify-content:space-between"><span>Mine D 단계별 작업 정리 · 2026-09-12</span><span class="pageNumber"></span></div>';
await page.pdf({ path: path.resolve(output), format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: foot, margin: { top: '16mm', bottom: '14mm', left: '14mm', right: '14mm' } });
await browser.close();
console.log('wrote', output);
