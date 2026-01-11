import { test, expect, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { screenshotBaselines } from './baselines';

const identity = {
  version: 1,
  publicKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  privateKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  createdAt: '2024-01-01T00:00:00.000Z',
  displayName: 'Screenshot User',
};

const baseStorage: Record<string, string> = {
  'ct.identity.v1': JSON.stringify(identity),
  'ct.firststart.v1.done': '1',
  clover_user: JSON.stringify({ id: 1, username: 'screenshot', displayName: 'Screenshot User', fingerprint: 'demo' }),
  'ct.onboarding.v1.done': '1',
  'ct.onboarding.v1.replays': JSON.stringify({ identity: true, servers: true, voice: true, settings: true }),
};

const seedStorage = async (page: Page, overrides: Record<string, string> = {}) => {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
  }, { ...baseStorage, ...overrides });

  await page.addInitScript(() => {
    if (!('mediaDevices' in navigator)) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          enumerateDevices: async () => [],
        },
      });
    }
  });
};

const mockApi = async (
  page: Page,
  data: {
    servers?: any[];
    structure?: any;
    members?: any[];
    unreadCounts?: Record<number, number>;
  } = {}
) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      return route.fallback();
    }

    if (pathname === '/api/servers') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data.servers ?? []),
      });
    }

    if (pathname === '/api/servers/unread-counts') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data.unreadCounts ?? {}),
      });
    }

    if (/\/api\/servers\/\d+\/structure/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          data.structure ?? {
            categories: [],
            uncategorized: [],
            fallbackChannelId: null,
          }
        ),
      });
    }

    if (/\/api\/servers\/\d+\/members$/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data.members ?? []),
      });
    }

    if (/\/api\/servers\/\d+\/permissions/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
};

const disableAnimations = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
};

const compareScreenshot = async (page: Page, name: keyof typeof screenshotBaselines) => {
  const baselineBase64 = screenshotBaselines[name];
  const baselineBuffer = Buffer.from(baselineBase64, 'base64');
  await page.evaluate(() => (document as Document & { fonts?: FontFaceSet }).fonts?.ready);
  const screenshotBuffer = await page.screenshot({ fullPage: true });

  const baselinePng = PNG.sync.read(baselineBuffer);
  const screenshotPng = PNG.sync.read(screenshotBuffer);

  expect(screenshotPng.width, 'screenshot width').toBe(baselinePng.width);
  expect(screenshotPng.height, 'screenshot height').toBe(baselinePng.height);

  const diff = new PNG({ width: baselinePng.width, height: baselinePng.height });
  const diffPixels = pixelmatch(
    baselinePng.data,
    screenshotPng.data,
    diff.data,
    baselinePng.width,
    baselinePng.height,
    { threshold: 0.1 }
  );
  const totalPixels = baselinePng.width * baselinePng.height;
  const diffRatio = diffPixels / totalPixels;
  expect(diffRatio, 'diff ratio').toBeLessThanOrEqual(0.01);
};

test('auth screen screenshot', async ({ page }) => {
  await seedStorage(page);
  await page.goto('/#/__screenshots/auth');
  await page.waitForSelector('text=CloverTalk');
  await disableAnimations(page);
  await compareScreenshot(page, 'auth-screen');
});

test('main layout home screenshot', async ({ page }) => {
  await seedStorage(page, { 'ct.server_rail.order.v1': JSON.stringify([]) });
  await mockApi(page, { servers: [], unreadCounts: {} });
  await page.goto('/#/');
  await page.waitForSelector('text=Kein Server ausgewählt');
  await disableAnimations(page);
  await compareScreenshot(page, 'main-layout-home');
});

test('main layout server screenshot', async ({ page }) => {
  await seedStorage(page, { 'ct.server_rail.order.v1': JSON.stringify([1]) });

  const servers = [
    {
      id: 1,
      name: 'Clover Hub',
      icon_url: null,
      unread_count: 2,
      settings: { theme: { color: '#6366f1' } },
    },
  ];
  const structure = {
    categories: [
      {
        id: 10,
        name: 'Allgemein',
        channels: [
          { id: 101, name: 'welcome', type: 'text' },
          { id: 102, name: 'voice-lounge', type: 'voice' },
        ],
      },
    ],
    uncategorized: [{ id: 103, name: 'announcements', type: 'text' }],
    fallbackChannelId: 101,
  };
  const members = [
    { userId: 1, username: 'screenshot', status: 'online' },
    { userId: 2, username: 'ava', status: 'idle' },
  ];

  await mockApi(page, { servers, structure, members, unreadCounts: { 1: 2 } });
  await page.goto('/#/');
  await page.waitForSelector('.main-layout');
  await disableAnimations(page);
  await compareScreenshot(page, 'main-layout-server');
});

test('modal screenshot', async ({ page }) => {
  await seedStorage(page);
  await page.goto('/#/__screenshots/modal');
  await page.waitForSelector('.ct-modal');
  await disableAnimations(page);
  await compareScreenshot(page, 'modal-create-server');
});

test('voice view screenshot', async ({ page }) => {
  await seedStorage(page);
  await page.goto('/#/__screenshots/voice');
  await page.waitForSelector('.ct-voice-channel');
  await disableAnimations(page);
  await compareScreenshot(page, 'voice-view');
});
