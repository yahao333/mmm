import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  webServer: {
    command: 'pnpm -s run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

