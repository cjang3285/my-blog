import { defineConfig, devices } from '@playwright/test';

// 테스트 대상 서버 주소
// CI: GitHub Actions에서 PLAYWRIGHT_BASE_URL 주입
// 로컬: frontend/config/.env.test 또는 기본값
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4322';

export default defineConfig({
  testDir: '../tests/e2e',
  outputDir: '../playwright-results',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: '../playwright-report', open: 'never' }]]
    : [['html', { outputFolder: '../playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
