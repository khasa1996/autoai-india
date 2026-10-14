import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium', headless: true });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('http://127.0.0.1:3010', { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  assert(await page.getByText('Find your next chapter.').isVisible());
  await page.getByText('Finance', { exact: true }).click();
  assert(await page.getByText('Make the numbers work.').isVisible());
  await page.getByLabel('Annual interest rate percent').fill('0');
  await page.getByLabel('Loan principal in rupees').fill('600000');
  await page.getByLabel('Loan term in months').fill('60');
  assert(await page.getByText('₹10,000').isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, checks: ['Expo web export loads', 'mobile navigation', 'local EMI calculation', 'no horizontal overflow', 'no page errors'] }, null, 2));
} finally { await browser.close(); }
