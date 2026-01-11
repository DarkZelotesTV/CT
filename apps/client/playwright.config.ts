import { defineConfig } from '@playwright/test';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const port = 4173;
const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/screenshots',
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{testFileName}-snapshots/{arg}{ext}',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: `npm run dev -- --host 0.0.0.0 --port ${port}`,
    cwd: configDir,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SCREENSHOT: 'true',
    },
  },
});
