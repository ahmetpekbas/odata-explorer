import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    // The production bundle is served from a subpath, as on a static host, to prove `base: './'`.
    baseURL: `http://localhost:${PORT}/sub/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', testIgnore: 'perf.spec.ts', use: { ...devices['Desktop Chrome'] } },
    {
      // Timing checks run alone, after the rest: other tests competing for the CPU would skew them.
      name: 'perf',
      testMatch: 'perf.spec.ts',
      dependencies: ['chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --base /sub/`,
    url: `http://localhost:${PORT}/sub/`,
    reuseExistingServer: false,
  },
});
