import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a local server (started automatically in CI via webServer).
 * Does not call Gemini — UI + public API checks only.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:8080/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
