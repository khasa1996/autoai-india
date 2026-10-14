import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/workspace/autoai-browser-cache';
const { chromium } = await import('@playwright/test');
const temporary = await mkdtemp(join(tmpdir(), 'autoai-asset-test-'));
const server = createServer(async (req, res) => {
  if (req.url === '/harness.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(join(temporary, 'harness.js'))); }
  else if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><title>Test-only GLB runtime harness</title></head><body><canvas style="width:640px;height:480px"></canvas><script type="module" src="/harness.js"></script></body></html>'); }
  else { res.statusCode = 404; res.end(); }
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await build({ entryPoints: [resolve('tests/assets-browser/harness.ts')], outfile: join(temporary, 'harness.js'), bundle: true, platform: 'browser', format: 'esm', sourcemap: false });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ deviceScaleFactor: 1 }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction(() => 'runAssetRuntimeTest' in window);
  const result = await page.evaluate(() => (window as unknown as { runAssetRuntimeTest(): Promise<{ ok: boolean }> }).runAssetRuntimeTest());
  assert(result.ok); assert.deepEqual(errors, []); console.log(JSON.stringify(result, null, 2));
} finally { await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temporary, { recursive: true, force: true }); }
