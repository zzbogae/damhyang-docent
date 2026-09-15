import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /(filter|similar)\.spec\.ts/,
  timeout: 600000,
  use: { baseURL: 'http://localhost:5183', viewport: { width: 1360, height: 900 } },
  webServer: {
    command: 'npx vite build -c vite.lab.config.ts && npx vite preview -c vite.lab.config.ts --port 5183 --strictPort',
    url: 'http://localhost:5183/lab/filter.html',
    timeout: 240000,
    reuseExistingServer: false,
  },
});
