import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for SuperApp V2.
 * Tests can run against local static web preview or remote hosted deployment.
 */
export default defineConfig({
  testDir: './e2e/playwright',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    bypassCSP: true,
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  /* Start local web preview server automatically */
  webServer: {
    command: 'npx serve dist -l 8081 -s',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: true,
    timeout: 60000,
  },
});

