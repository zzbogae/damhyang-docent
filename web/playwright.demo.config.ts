// 시연 영상 녹화 전용 설정(메인 시험과 분리). 결과 영상은 test-results/demo/ 아래에 webm 으로 남는다.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /demo\.spec\.ts/,
  timeout: 900000,
  use: {
    baseURL: 'http://localhost:5182',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 120 },
  },
  outputDir: 'test-results/demo',
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:5182', timeout: 240000, reuseExistingServer: true },
});
