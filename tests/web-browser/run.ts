import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors: string[] = [];
await mkdir('test-results/web', { recursive: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  desktop.on('pageerror', error => errors.push(`desktop: ${error.message}`));
  await desktop.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  assert.equal(await desktop.locator('h1').innerText(), 'Find your\nnext chapter.');
  assert(await desktop.getByRole('link', { name: 'Explore cars' }).first().isVisible());
  assert(await desktop.getByText('A catalogue built on confidence.').isVisible());
  const horizontalOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(horizontalOverflow, false);
  await desktop.screenshot({ path: 'test-results/web/home-desktop.png', fullPage: true });

  await desktop.goto('http://localhost:3000/finance', { waitUntil: 'networkidle' });
  await desktop.getByLabel('Loan principal (₹)').fill('600000');
  await desktop.getByLabel('Annual interest rate (%)').fill('0');
  await desktop.getByLabel('Loan term (months)').fill('60');
  await desktop.getByRole('button', { name: 'Calculate estimate' }).click();
  await desktop.getByText('₹10,000').waitFor();

  const identity = `browser-${Date.now()}@example.test`;
  await desktop.goto('http://localhost:3000/account', { waitUntil: 'networkidle' });
  await desktop.getByRole('button', { name: 'New here? Create an account' }).click();
  await desktop.getByLabel('Your name').fill('Browser Test User');
  await desktop.getByLabel('Email address').fill(identity);
  await desktop.getByLabel('Password').fill('browser-test-password-2026');
  await desktop.getByRole('button', { name: 'Create account' }).click();
  await desktop.getByText('Welcome, Browser Test User').waitFor();
  await desktop.goto('http://localhost:3000/support', { waitUntil: 'networkidle' });
  await desktop.getByLabel('Subject').fill('Browser flow verification');
  await desktop.getByLabel('How can we help?').fill('This synthetic ticket verifies the customer support browser workflow.');
  await desktop.getByRole('button', { name: 'Create ticket' }).click();
  await desktop.getByText('Browser flow verification').waitFor();

  for (const route of ['explore', 'vehicle', 'advisor', 'compare', 'exchange', 'garage', 'tracking', 'showroom', 'dealer', 'admin', 'studio', 'about', 'news']) {
    const response = await desktop.goto(`http://localhost:3000/${route}`, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, `/${route} should render`);
    assert(await desktop.locator('h1').first().isVisible(), `/${route} should have a visible heading`);
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  mobile.on('pageerror', error => errors.push(`mobile: ${error.message}`));
  await mobile.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  assert(await mobile.getByRole('button', { name: 'Open navigation' }).isVisible());
  await mobile.getByRole('button', { name: 'Open navigation' }).click();
  assert(await mobile.getByRole('navigation', { name: 'Mobile navigation' }).isVisible());
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  await mobile.screenshot({ path: 'test-results/web/home-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, checks: ['desktop layout', 'mobile layout and menu', 'catalogue empty state', 'finance calculation', 'registration', 'authenticated support creation', 'all public and role-gated routes render', 'no horizontal overflow', 'no page errors'], screenshots: ['test-results/web/home-desktop.png', 'test-results/web/home-mobile.png'] }, null, 2));
} finally {
  await browser.close();
}
