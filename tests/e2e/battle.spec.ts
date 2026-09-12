import { test, expect, type Page } from '@playwright/test';
// Mock the browser's hardware boundary, but use real MediaStream video, canvas capture,
// HTTP requests, server state, MediaPipe, and React UI in the full-loop test.
function syntheticCamera() {
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      ctx.fillStyle = '#19382e';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#a5c2ad';
      ctx.fillRect(245, 115, 150, 190);
      ctx.fillStyle = '#29362c';
      ctx.fillRect(254, 305, 55, 125);
      ctx.fillRect(330, 305, 55, 125);
      ctx.fillStyle = '#ddc8b0';
      ctx.beginPath();
      ctx.arc(320, 78, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8ebdd';
      ctx.fillRect(246, 430, 63, 20);
      ctx.fillRect(330, 430, 63, 20);
      ctx.fillStyle = '#b1ffde';
      ctx.font = '18px Arial';
      ctx.fillText('SIMULATED CAMERA', 20, 30);
      ctx.fillText(String(Math.floor(performance.now() / 1000)), 20, 460);
    };
    draw();
    const timer = setInterval(draw, 100);
    const stream = canvas.captureStream(10);
    stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
    return stream;
  };
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(syntheticCamera);
});
async function photoFixture(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 300;
    const x = c.getContext('2d')!;
    x.fillStyle = '#446650';
    x.fillRect(0, 0, 200, 300);
    x.fillStyle = '#abc6b0';
    x.fillRect(50, 40, 100, 150);
    return c.toDataURL('image/png').split(',')[1];
  });
  return { name: 'overshirt.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const s = JSON.parse(sessionStorage.getItem('who-mogs-who-session')!).state.credentials;
    return (
      await fetch(`/api/rooms/${s.roomCode}/state`, {
        headers: { Authorization: `Bearer ${s.accessToken}` },
      })
    ).json();
  });
}
test('two independent browsers complete practice → practice → final → podium → rematch', async ({
  browser,
}) => {
  const ctxA = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1440, height: 1000 },
  });
  const ctxB = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1440, height: 1000 },
  });
  await ctxA.addInitScript(syntheticCamera);
  await ctxB.addInitScript(syntheticCamera);
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
  await host.goto('/');
  await host.getByRole('button', { name: 'Start a mog-off', exact: true }).click();
  await host.getByLabel('Your display name').fill('Maya');
  await host
    .getByRole('dialog')
    .getByRole('button', { name: 'Start a mog-off', exact: true })
    .click();
  await expect(host).toHaveURL(/\/battle\/MOG-/);
  const code = host.url().split('/').pop()!;
  await guest.goto(`/?join=${code}`);
  await guest.getByLabel('Your display name').fill('Alex');
  await guest.getByRole('dialog').getByRole('button', { name: 'Join a mog-off', exact: true }).click();
  await expect(guest).toHaveURL(`/battle/${code}`);
  await expect(host.getByText('Alex', { exact: true })).toBeVisible();
  await expect(guest.getByText('Maya', { exact: true })).toBeVisible();
  await expect
    .poll(() => host.locator('video').evaluate((v) => (v as HTMLVideoElement).videoWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() => guest.locator('video').evaluate((v) => (v as HTMLVideoElement).videoWidth))
    .toBeGreaterThan(0);
  await host.screenshot({ path: 'test-results/lobby.png', fullPage: true });
  await host.getByRole('button', { name: 'Start the mog-off' }).click();
  for (let round = 0; round < 3; round++) {
    await expect.poll(async () => (await state(host)).room.phase).toBe('POSE');
    await expect(host.getByRole('button', { name: 'Ready · 7s capture' })).toBeEnabled({
      timeout: 30000,
    });
    await host.getByRole('button', { name: 'Ready · 7s capture' }).click();
    await expect
      .poll(async () => (await state(host)).mine.finalized, { timeout: 25000 })
      .toBe(true);
    const hidden = await state(host);
    expect(hidden.room.rounds[round].leaderboard).toBeUndefined();
    expect(hidden.mine.score).toBeUndefined();
    await expect(host.getByText('Your score is under wraps.')).toBeVisible();
    if (round === 0) {
      await host.reload();
      await expect(host.getByText('Your score is under wraps.')).toBeVisible();
    }
    await expect(guest.getByRole('button', { name: 'Ready · 7s capture' })).toBeEnabled({
      timeout: 30000,
    });
    await guest.getByRole('button', { name: 'Ready · 7s capture' }).click();
    await expect
      .poll(async () => (await state(guest)).mine.finalized, { timeout: 25000 })
      .toBe(true);
    await expect(host.getByText('THE JUDGE HAS SPOKEN')).toBeVisible();
    await expect(guest.getByText('THE JUDGE HAS SPOKEN')).toBeVisible();
    const a = await state(host);
    const b = await state(guest);
    expect(a.room.rounds[round].leaderboard).toEqual(b.room.rounds[round].leaderboard);
    expect(a.room.rounds[round].leaderboard).toHaveLength(2);
    await expect(
      host.getByRole('complementary', { name: 'Private AI styling coach' }),
    ).toBeVisible();
    await expect(host.getByText('Your next look starts here.')).toBeVisible();
    await host.screenshot({ path: `test-results/round-${round + 1}.png`, fullPage: true });
    const label = round === 2 ? 'Reveal who mogs' : 'Ready for next round';
    await host.getByRole('button', { name: label, exact: true }).click();
    await guest.getByRole('button', { name: label, exact: true }).click();
    if (round < 2) {
      await expect.poll(async () => (await state(host)).room.currentRoundIndex).toBe(round + 1);
      const reset = await state(host);
      expect(reset.mine.attemptCount).toBe(0);
      expect(reset.mine.finalized).toBe(false);
    }
  }
  await expect(
    host.getByRole('heading', { name: /Consider the room mogged|Share the spotlight/ }),
  ).toBeVisible();
  await expect(
    guest.getByRole('heading', { name: /Consider the room mogged|Share the spotlight/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      host
        .locator('.winner-card')
        .first()
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('1');
  await expect(host.locator('.podium-scene canvas')).toBeVisible();
  await host.screenshot({ path: 'test-results/podium.png', fullPage: true });
  await host.getByRole('button', { name: 'Rematch', exact: true }).click();
  await expect(host.getByRole('button', { name: 'Start the mog-off' })).toBeVisible();
  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
test('mobile create, closet privacy, upload fallback, disconnected player and final', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Start a mog-off', exact: true }).click();
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByRole('button', { name: 'Fewer rounds' }).click();
  await page.getByRole('button', { name: 'Fewer rounds' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start a mog-off', exact: true })
    .click();
  await expect(page).toHaveURL(/\/battle\//);
  await page.getByRole('button', { name: /My closet/ }).click();
  await page.locator('dialog input[type=file]').setInputFiles(await photoFixture(page));
  await expect(page.getByText('1 / 12 PIECES')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const code = page.url().split('/').pop()!;
  const other = await browser.newPage();
  await other.goto(`/?join=${code}`);
  await other.getByLabel('Your display name').fill('Casey');
  await other.getByRole('dialog').getByRole('button', { name: 'Join a mog-off', exact: true }).click();
  await expect(other).toHaveURL(`/battle/${code}`);
  expect((await state(other)).mine.closet).toHaveLength(0);
  await page.getByRole('button', { name: 'Start the mog-off' }).click();
  await expect.poll(async () => (await state(page)).room.phase).toBe('POSE');
  await page.locator('.capture-extras input[type=file]').setInputFiles(await photoFixture(page));
  await expect.poll(async () => (await state(page)).mine.finalized).toBe(true);
  await other.getByRole('button', { name: 'Leave mog-off' }).click();
  await expect(page.getByText('THE JUDGE HAS SPOKEN')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByText('Your next look starts here.')).toBeVisible();
  await page.getByRole('button', { name: 'Show me', exact: true }).click();
  await expect(page.getByText('CLOSET REFERENCE')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-coach.png', fullPage: true });
  await page.getByRole('button', { name: 'Close styling coach' }).click();
  await page.getByRole('button', { name: 'Reveal who mogs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Consider the room mogged.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await other.close();
});

test('pose guidance is advisory: Ready and capture work while framing is invalid', async ({
  page,
}) => {
  await page.route(/@mediapipe_tasks-vision\.js/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
      export const FilesetResolver = { forVisionTasks: async () => ({}) };
      export const PoseLandmarker = { createFromOptions: async () => ({
        close() {},
        detectForVideo() {
          const p = Array.from({length:33}, () => ({x:0.5,y:0.5,visibility:1}));
          p[0].y=0.12; p[27].y=0.9; p[28].y=0.9;
          if (globalThis.__invalidTestPose) p[28].visibility=0;
          return {landmarks:[p]};
        }
      }) };
    `,
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a mog-off', exact: true }).click();
  await page.getByLabel('Your display name').fill('Framing check');
  await page.getByRole('button', { name: 'Fewer rounds' }).click();
  await page.getByRole('button', { name: 'Fewer rounds' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start a mog-off', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start the mog-off' }).click();
  await page.evaluate(() => {
    (globalThis as typeof globalThis & { __invalidTestPose: boolean }).__invalidTestPose = true;
  });
  await expect(page.getByText('Step back — make sure your shoes are visible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ready · 7s capture' })).toBeEnabled();
  await page.getByRole('button', { name: 'Ready · 7s capture' }).click();
  await expect(page.locator('.countdown')).toBeVisible();
  await expect(page.getByText('Step back — make sure your shoes are visible')).toBeVisible();
  // Guidance remains invalid through zero: the photo must still reach the judge.
  await expect(page.getByText('THE JUDGE HAS SPOKEN')).toBeVisible({ timeout: 20000 });
  expect((await state(page)).mine.attemptCount).toBe(1);
});
