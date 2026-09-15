import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/filter.spec.ts', '**/similar.spec.ts', '**/demo.spec.ts'], // 필터·비슷한 사진 측정은 playwright.lab.config.ts 로 따로 돌린다
  timeout: 240000,
  use: { baseURL: 'http://localhost:5182', viewport: { width: 1360, height: 900 } },
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:5182', timeout: 240000, reuseExistingServer: true },
});
