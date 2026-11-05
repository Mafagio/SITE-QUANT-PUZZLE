#!/usr/bin/env node
/** Browser checks and reproducible captures. Does not install dependencies or start a server. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readdir, access, writeFile, readFile } from 'node:fs/promises';
import { homedir, platform, arch } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && !args[outputIndex + 1]) throw new Error('--output attend un chemin.');
const output = path.resolve(outputIndex === -1 ? 'artifacts/london/final' : args[outputIndex + 1]);
const url = process.env.LONDON_URL || 'http://127.0.0.1:8877/london-code-demo.html';
const report = {
  startedAt: new Date().toISOString(), url, output, success: false,
  environment: { node: process.version, platform: platform(), arch: arch() },
  checks: [], pageErrors: [], consoleErrors: [], failedRequests: [], traversals: [], captures: [],
};

async function exists(file) { try { await access(file); return true; } catch { return false; } }

async function findPlaywright() {
  for (const name of ['playwright', '@playwright/test']) {
    try { return { module: require(name), source: require.resolve(name) }; } catch {}
  }
  const cache = path.join(homedir(), '.npm', '_npx');
  let entries = [];
  try { entries = await readdir(cache); } catch {}
  for (const entry of entries.sort().reverse()) {
    const candidate = path.join(cache, entry, 'node_modules', 'playwright');
    try { return { module: require(candidate), source: candidate }; } catch {}
  }
  throw new Error('Playwright introuvable. Voir docs/london-running.md. Aucune installation automatique effectuée.');
}

function checkPng(bytes, width = 1536, height = 1024) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Signature PNG');
  assert.equal(bytes.readUInt32BE(16), width, 'Largeur PNG');
  assert.equal(bytes.readUInt32BE(20), height, 'Hauteur PNG');
}

async function check(name, fn) {
  const start = performance.now();
  try {
    const detail = await fn();
    report.checks.push({ name, passed: true, durationMs: Math.round(performance.now() - start), ...(detail ? { detail } : {}) });
    process.stdout.write(`OK  ${name}\n`);
    return detail;
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    throw error;
  }
}

function watch(page, label) {
  page.on('pageerror', error => report.pageErrors.push({ page: label, message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push({ page: label, message: message.text() });
  });
  page.on('requestfailed', request => report.failedRequests.push({ page: label, url: request.url(), error: request.failure()?.errorText }));
}

async function openScene(context, label) {
  const page = await context.newPage();
  watch(page, label);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.worldlab));
  await page.evaluate(async () => { await window.worldlab.ready; });
  assert.equal(await page.locator('#error').isVisible(), false);
  return page;
}

const state = page => page.evaluate(() => window.worldlab.getState());
const stats = page => page.evaluate(() => window.worldlab.stats());
const setState = (page, patch) => page.evaluate(p => window.worldlab.setState(p), patch);
const renderAt = (page, camera, time = 5) => page.evaluate(({ camera, time }) => window.worldlab.renderAt(time, camera), { camera, time });
const hash = page => page.evaluate(() => window.worldlab.pixelHash());

async function saveCanvas(page, filename) {
  const snapshot = await page.evaluate(() => ({
    data: document.getElementById('london').toDataURL('image/png').split(',')[1],
    state: window.worldlab.getState(), hash: window.worldlab.pixelHash(),
  }));
  const bytes = Buffer.from(snapshot.data, 'base64');
  checkPng(bytes);
  await writeFile(path.join(output, filename), bytes);
  const capture = { file: filename, state: snapshot.state, hash: snapshot.hash, width: 1536, height: 1024 };
  report.captures.push(capture);
  return capture;
}

let browser;
await mkdir(output, { recursive: true });
try {
  const playwright = await findPlaywright();
  report.environment.playwright = playwright.source;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.CHROME_PATH || (await exists(localChrome) ? localChrome : undefined);
  if (process.env.CHROME_PATH) assert.ok(await exists(executablePath), 'CHROME_PATH doit désigner un navigateur existant.');
  browser = await playwright.module.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  report.environment.browserVersion = browser.version();
  report.environment.browserExecutable = executablePath || 'Chromium géré par Playwright';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, acceptDownloads: true });
  const sceneReferences = [];
  context.on('request', request => { if (/\/LONDON\//.test(request.url())) sceneReferences.push(request.url()); });
  const page = await openScene(context, 'desktop');
  report.environment.userAgent = await page.evaluate(() => navigator.userAgent);
  report.environment.viewport = { width: 1440, height: 1100, deviceScaleFactor: 1 };

  await check('Démarrage, Canvas 3:2 et décor indépendant des PNG', async () => {
    assert.deepEqual(await page.locator('#london').evaluate(c => [c.width, c.height]), [1536, 1024]);
    assert.equal(sceneReferences.length, 0, 'Aucun PNG de référence ne doit charger au démarrage.');
    assert.equal((await stats(page)).referenceImagesInScene, 0);
    await renderAt(page, 0);
    const initial = await hash(page);
    await page.waitForTimeout(400);
    assert.equal(await hash(page), initial, 'Scène en pause strictement stable.');
  });

  await check('Parcours aller-retour, raccords et cache borné reproductible', async () => {
    await setState(page, { facing: 1 });
    await renderAt(page, 0);
    const firstHash = await hash(page);
    const cameras = [0, 740, 768, 800, 1700, 2400, 2700, 3300, 4100, 4608];
    for (const camera of [...cameras, ...cameras.slice(0, -1).reverse()]) {
      await renderAt(page, camera);
      const snapshot = { camera, state: await state(page), stats: await stats(page) };
      assert.equal(snapshot.state.camera, camera);
      assert.ok(snapshot.stats.cacheTiles <= 6, 'Cache courant ≤ 6');
      assert.ok(snapshot.stats.peakTiles <= 6, 'Pic du cache ≤ 6');
      report.traversals.push(snapshot);
    }
    assert.ok((await stats(page)).evictions > 0, 'La traversée doit exercer les évictions.');
    assert.equal(await hash(page), firstHash, 'Même temps/caméra après éviction = mêmes pixels.');
    await renderAt(page, 0);
    assert.equal(await hash(page), firstHash, 'Appel renderAt répété reproductible.');
  });

  await check('Captures des quatre quartiers et du raccord, à t=5', async () => {
    for (const [name, camera] of [['first-view', 0], ['warehouses', 1700], ['crane', 2700], ['terminal', 4100], ['seam', 768]]) {
      await renderAt(page, camera);
      await saveCanvas(page, `${name}.png`);
    }
    await renderAt(page, 0);
    await page.screenshot({ path: path.join(output, 'desktop-1440x1100.png'), fullPage: true });
    const box = await page.locator('#london').boundingBox();
    assert.ok(Math.abs(box.width / box.height - 1.5) < .01, 'Ratio conservé à l’affichage.');
  });

  await check('Marche automatique, pause intégrale et retour au départ', async () => {
    await renderAt(page, 0);
    const before = await state(page);
    await page.locator('#auto').click();
    await page.waitForTimeout(450);
    const moved = await state(page);
    assert.ok(moved.playerX > before.playerX);
    assert.ok(moved.distance > before.distance);
    await page.locator('#pause').click();
    const frozen = await state(page), frozenHash = await hash(page);
    assert.equal(frozen.paused, true);
    await page.waitForTimeout(400);
    assert.deepEqual(await state(page), frozen, 'Pause : temps, position et distance figés.');
    assert.equal(await hash(page), frozenHash, 'Pause : tous les pixels figés.');
    const resetState = await page.evaluate(async () => await window.worldlab.reset());
    assert.equal(resetState.time, 0); assert.equal(resetState.camera, 0);
    assert.equal(resetState.playerX, 330); assert.equal(resetState.distance, 0); assert.equal(resetState.auto, false);
    await setState(page, { paused: true });
    await renderAt(page, 1700);
    await page.locator('#reset').click();
    await page.waitForFunction(() => window.worldlab.getState().camera === 0 && window.worldlab.getState().distance === 0);
    await setState(page, { paused: true });
  });

  await check('Boutons gauche/droite maintenus puis relâchés', async () => {
    await renderAt(page, 800);
    for (const [id, sign] of [['right', 1], ['left', -1]]) {
      const button = page.locator(`#${id}`), before = await state(page);
      await button.hover(); await page.mouse.down();
      await page.waitForTimeout(350); await page.mouse.up();
      const after = await state(page);
      assert.ok((after.playerX - before.playerX) * sign > 0, `Déplacement ${id}`);
      await page.waitForTimeout(160);
      assert.equal((await state(page)).playerX, after.playerX, 'Relâcher arrête le personnage.');
    }
    await setState(page, { paused: true });
  });

  await check('Exploration par curseur et boutons de quartier', async () => {
    await page.locator('#travel').evaluate(input => { input.value = '2400'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => window.worldlab.getState().camera === 2400);
    for (const camera of [0, 1700, 2700, 4608]) {
      await page.locator(`[data-camera="${camera}"]`).click();
      await page.waitForFunction(c => window.worldlab.getState().camera === c, camera);
      assert.equal(await page.locator(`[data-camera="${camera}"]`).getAttribute('aria-current'), 'location');
    }
  });

  await check('Clavier : flèches, espace et R', async () => {
    await renderAt(page, 800);
    await page.locator('#london').focus();
    const before = await state(page);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
    assert.ok((await state(page)).playerX > before.playerX);
    await page.keyboard.press('Space'); assert.equal((await state(page)).paused, true);
    const frozenHash = await hash(page); await page.waitForTimeout(200); assert.equal(await hash(page), frozenHash);
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => window.worldlab.getState().camera === 0);
    await setState(page, { paused: true });
  });

  await check('Référence séparée et capture PNG téléchargeable', async () => {
    assert.equal(sceneReferences.length, 0, 'Toujours aucun PNG avant l’ouverture de la comparaison.');
    await renderAt(page, 0);
    await page.locator('#compare').click();
    await page.locator('#reference-image').evaluate(image => image.decode());
    assert.match(await page.locator('#reference-image').getAttribute('src'), /LONDON\/frame01\.png$/);
    assert.equal(await page.locator('#comparison').isVisible(), true);
    await page.locator('[data-camera="4608"]').click();
    await page.waitForFunction(() => window.worldlab.getState().camera === 4608);
    await page.locator('#reference-image').evaluate(image => image.decode());
    assert.match(await page.locator('#reference-image').getAttribute('src'), /frame11_pont_aeroport\.png$/);
    await page.locator('#compare').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#capture').click();
    const download = await downloadPromise, destination = path.join(output, 'capture-button.png');
    await download.saveAs(destination); checkPng(await readFile(destination));
    report.referenceRequests = sceneReferences;
  });

  await check('Séquence animée réelle : six états espacés de 200 ms', async () => {
    await setState(page, { time: 5, camera: 0, playerX: 330, distance: 0, facing: 1, paused: false, auto: true });
    const sequence = [];
    for (let i = 0; i < 6; i++) {
      if (i) await page.waitForTimeout(200);
      sequence.push(await saveCanvas(page, `motion-${String(i).padStart(2, '0')}.png`));
    }
    await setState(page, { paused: true, auto: false });
    assert.equal(new Set(sequence.map(frame => frame.hash)).size, 6);
    for (let i = 1; i < sequence.length; i++) {
      assert.ok(sequence[i].state.time > sequence[i - 1].state.time);
      assert.ok(sequence[i].state.playerX > sequence[i - 1].state.playerX);
      assert.ok(sequence[i].state.distance > sequence[i - 1].state.distance);
    }
    report.animatedSequence = sequence.map(({ file, state, hash }) => ({ file, state, hash }));
  });

  await check('Mesure de cadence rAF sur cinq secondes après préchauffage', async () => {
    await setState(page, { time: 5, camera: 1700, facing: 1, paused: false, auto: true });
    await page.waitForTimeout(1200);
    const before = await stats(page);
    const measurement = await page.evaluate(() => new Promise(resolve => {
      let first = 0, previous = 0;
      const intervals = [];
      function sample(now) {
        if (!first) first = now;
        if (previous) intervals.push(now - previous);
        previous = now;
        if (now - first < 5000) { requestAnimationFrame(sample); return; }
        const sorted = [...intervals].sort((a, b) => a - b), elapsedMs = now - first;
        resolve({ elapsedMs, intervals: intervals.length, cadenceRafHz: intervals.length * 1000 / elapsedMs,
          medianIntervalMs: sorted[Math.floor(sorted.length * .5)], p95IntervalMs: sorted[Math.floor(sorted.length * .95)],
          maxIntervalMs: Math.max(...sorted), intervalsOver33ms: intervals.filter(ms => ms > 33.4).length });
      }
      requestAnimationFrame(sample);
    }));
    await setState(page, { paused: true, auto: false });
    report.performance = { warmupMs: 1200, measurement, before, after: await stats(page),
      note: 'Cadence rAF du navigateur headless dans cet environnement ; ne garantit pas cette cadence sur les autres machines.' };
    assert.ok(measurement.elapsedMs >= 5000 && measurement.intervals > 0);
    assert.ok((await stats(page)).peakTiles <= 6);
    return measurement;
  });

  await check('Mobile 390×844 : ratio, absence de débordement et commandes tactiles', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const mobile = await openScene(mobileContext, 'mobile');
    await renderAt(mobile, 0);
    await mobile.screenshot({ path: path.join(output, 'mobile-390x844.png'), fullPage: true });
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Aucun débordement horizontal.');
    const box = await mobile.locator('#london').boundingBox();
    assert.ok(Math.abs(box.width / box.height - 1.5) < .01);
    const before = await state(mobile);
    await mobile.locator('#auto').tap(); await mobile.waitForTimeout(300); await mobile.locator('#pause').tap();
    assert.ok((await state(mobile)).playerX > before.playerX);
    assert.equal((await state(mobile)).paused, true);
    const frozenHash = await hash(mobile); await mobile.waitForTimeout(200); assert.equal(await hash(mobile), frozenHash);
    await mobile.locator('#right').scrollIntoViewIfNeeded();
    const right = await mobile.locator('#right').boundingBox();
    const cdp = await mobileContext.newCDPSession(mobile), beforeHold = await state(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2 }] });
    await mobile.waitForTimeout(250); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const afterHold = await state(mobile);
    assert.ok(afterHold.playerX > beforeHold.playerX, 'Maintien tactile de la direction.');
    await mobile.waitForTimeout(160); assert.equal((await state(mobile)).playerX, afterHold.playerX);
    report.mobile = { state: await state(mobile), stats: await stats(mobile), canvasBox: box };
    await mobileContext.close();
  });

  await check('Préférence de réduction des animations et reprise explicite au clavier', async () => {
    const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    const reduced = await openScene(reducedContext, 'reduced-motion');
    const initial = await state(reduced), frozenHash = await hash(reduced);
    assert.equal(initial.paused, true); assert.equal(initial.time, 0); assert.equal(initial.auto, false);
    await reduced.waitForTimeout(400); assert.deepEqual(await state(reduced), initial); assert.equal(await hash(reduced), frozenHash);
    await reduced.locator('#london').focus(); await reduced.keyboard.press('Space');
    await reduced.waitForTimeout(150); assert.equal((await state(reduced)).paused, false);
    assert.ok((await state(reduced)).time > 0);
    await reduced.keyboard.press('Space'); assert.equal((await state(reduced)).paused, true);
    report.reducedMotion = { initial, final: await state(reduced), stats: await stats(reduced) };
    await reducedContext.close();
  });

  await check('Aucune erreur JavaScript, console ou requête échouée', async () => {
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedRequests, []);
  });
  report.success = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.stderr.write(`ÉCHEC : ${error.message}\n`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'test-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Rapport : ${path.join(output, 'test-report.json')}\n`);
}
