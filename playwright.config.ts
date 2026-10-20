import { defineConfig, devices } from '@playwright/test';

const apiUrl = 'http://127.0.0.1:4000';
const webUrl = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @starter/api dev',
      url: `${apiUrl}/health`,
      env: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '4000',
        WEB_ORIGIN: webUrl,
        BETTER_AUTH_URL: apiUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @starter/web dev',
      url: webUrl,
      env: {
        VITE_API_BASE_URL: apiUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
