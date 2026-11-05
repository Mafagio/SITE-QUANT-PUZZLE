#!/usr/bin/env node
/** Browser evidence for London V2. Uses existing tools; never installs or starts a server. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readdir, access, writeFile, readFile } from 'node:fs/promises';
import { homedir, platform, arch } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2), outputIndex = args.indexOf('--output');
if (outputIndex >= 0 && !args[outputIndex + 1]) throw new Error('--output attend un chemin.');
const output = path.resolve(outputIndex < 0 ? 'artifacts/london-v2/after' : args[outputIndex + 1]);
const url = process.env.LONDON_URL || 'http://127.0.0.1:8877/london-code-demo.html';
const EXPECTED_STAGES = ['APPROCHE_PASSERELLE', 'TRAVERSEE', 'QUAI_AEROPORT', 'APPROCHE_AVION', 'MONTEE_ESCALIER', 'ENTREE_AVION', 'EMBARQUE'];
const TOLERANCE = 1e-6;
const report = {
  startedAt: new Date().toISOString(), url, success: false,
  environment: { node: process.version, platform: platform(), arch: arch(), viewport: [1440, 1100], deviceScaleFactor: 1 },
  checks: [], captures: [], traversals: [], pageErrors: [], consoleErrors: [], failedRequests: [],
  tolerance: { distancePixels: TOLERANCE, geometryPixels: TOLERANCE },
};

async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function findPlaywright() {
  for (const name of ['playwright', '@playwright/test']) {
    try { return { module: require(name), source: require.resolve(name) }; } catch {}
  }
  const cache = path.join(homedir(), '.npm', '_npx');
  let entries = []; try { entries = await readdir(cache); } catch {}
  for (const entry of entries.sort().reverse()) {
    const candidate = path.join(cache, entry, 'node_modules', 'playwright');
    try { return { module: require(candidate), source: candidate }; } catch {}
  }
  throw new Error('Playwright introuvable : aucun téléchargement ni installation automatique.');
}
function closeTo(actual, expected, message, tolerance = TOLERANCE) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} au lieu de ${expected} (tolérance ${tolerance})`);
}
function pngDimensions(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Signature PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
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
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ page: label, message: message.text() }); });
  page.on('requestfailed', request => report.failedRequests.push({ page: label, url: request.url(), error: request.failure()?.errorText }));
}
async function openScene(context, label) {
  const page = await context.newPage(); watch(page, label);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.worldlab));
  await page.evaluate(() => window.worldlab.ready);
  assert.equal(await page.locator('#error').isVisible(), false);
  return page;
}
const state = page => page.evaluate(() => window.worldlab.getState());
const stats = page => page.evaluate(() => window.worldlab.stats());
const hash = page => page.evaluate(() => window.worldlab.pixelHash());
const setState = (page, patch) => page.evaluate(patch => window.worldlab.setState(patch), patch);
const renderAt = (page, camera, time = 5) => page.evaluate(({ camera, time }) => window.worldlab.renderAt(time, camera), { camera, time });
const simulate = (page, seconds, direction = null) => page.evaluate(({ seconds, direction }) => window.worldlab.simulate(seconds, { direction }), { seconds, direction });
const route = page => page.evaluate(() => window.worldlab.route());
async function saveCanvas(page, file) {
  const capture = await page.evaluate(() => ({
    png: document.getElementById('london').toDataURL('image/png').split(',')[1],
    state: window.worldlab.getState(), config: window.worldlab.config, hash: window.worldlab.pixelHash(),
  }));
  const bytes = Buffer.from(capture.png, 'base64'); delete capture.png;
  assert.deepEqual(pngDimensions(bytes), [1536, 1024]);
  await writeFile(path.join(output, file), bytes);
  const evidence = { file, dimensions: [1536, 1024], ...capture };
  report.captures.push(evidence); return evidence;
}
async function prepareBoarding(page, speed = 2, startX = 4645) {
  await setState(page, { time: 5, camera: 4300, playerX: startX, distance: 0, speed, paused: true, auto: false, facing: 1, journey: { active: false } });
  const started = await page.evaluate(() => window.worldlab.startBoarding());
  assert.notEqual(started, false, 'Embarquement déclenché uniquement près de son entrée.');
  await setState(page, { paused: true });
  return route(page);
}
function segmentNamed(description, stage) {
  const segment = description.segments.find(segment => segment.stage === stage);
  assert.ok(segment, `Segment ${stage} exposé par route()`); return segment;
}
async function goToStageBySimulation(page, stage, fraction = .5, speed = 2) {
  const description = await prepareBoarding(page, speed);
  const segment = segmentNamed(description, stage);
  const target = segment.startDistance + segment.length * fraction;
  const initial = (await state(page)).routeDistance || 0;
  await simulate(page, Math.max(0, target - initial) / (92 * speed));
  assert.equal((await state(page)).routeState, stage);
  return { description, segment, target };
}

let browser;
await mkdir(output, { recursive: true });
try {
  const playwright = await findPlaywright(); report.environment.playwright = playwright.source;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.CHROME_PATH || (await exists(localChrome) ? localChrome : undefined);
  browser = await playwright.module.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  report.environment.browserVersion = browser.version(); report.environment.browserExecutable = executablePath || 'Chromium de Playwright';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, acceptDownloads: true });
  const references = []; context.on('request', request => { if (/\/LONDON\//.test(request.url())) references.push(request.url()); });
  const page = await openScene(context, 'desktop');
  report.environment.userAgent = await page.evaluate(() => navigator.userAgent);

  await check('Démarrage V2, résolution et commandes de vitesse accessibles', async () => {
    assert.deepEqual(await page.locator('#london').evaluate(c => [c.width, c.height]), [1536, 1024]);
    assert.equal((await state(page)).speed, 1); assert.equal(references.length, 0);
    const slider = page.locator('#speed');
    assert.equal(await slider.getAttribute('min'), '0.25'); assert.equal(await slider.getAttribute('max'), '3'); assert.equal(await slider.getAttribute('step'), '0.25');
    assert.match(await slider.getAttribute('aria-label') || await page.locator('label[for="speed"]').textContent(), /Vitesse du personnage/i);
    for (const speed of [.5, 1, 2]) {
      await page.locator(`[data-speed="${speed}"]`).click(); assert.equal((await state(page)).speed, speed);
      assert.ok((await page.locator('#speed-value').textContent()).length > 0);
    }
    await slider.evaluate(input => { input.value = '0.25'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal((await state(page)).speed, .25);
    await slider.evaluate(input => { input.value = '3'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal((await state(page)).speed, 3);
    await setState(page, { speed: 1, paused: true });
  });

  await check('Distances 0,5× / 1× / 2× et ambiance indépendante, tolérance 10⁻⁶ px', async () => {
    const measured = [], ambient = [];
    for (const speed of [.5, 1, 2]) {
      await setState(page, { speed, time: 0, camera: 1000, playerX: 1330, distance: 0, paused: true, auto: false, facing: 1, journey: { active: false } });
      await simulate(page, 2, 1);
      const after = await state(page), expected = 92 * speed * 2;
      closeTo(after.playerX - 1330, expected, `Distance à ${speed}×`); closeTo(after.distance, expected, `Phase de marche à ${speed}×`); closeTo(after.time, 2, 'Temps ambiant');
      await setState(page, { camera: 1000, time: 2, paused: true, auto: false, journey: { active: false } });
      ambient.push(await page.evaluate(() => window.worldlab.ambientHash())); measured.push({ speed, expected, state: after });
    }
    assert.equal(new Set(ambient).size, 1, 'Même caméra et même temps = même ambiance quelle que soit la vitesse du marcheur.');
    report.speedMeasurements = measured; report.ambientHashes = ambient;
  });

  await check('Exploration du terminal sans déclenchement accidentel', async () => {
    await renderAt(page, 4300); const after = await state(page);
    assert.equal(after.routeState, 'PROMENADE'); assert.equal(after.journey.active, false);
    await setState(page, { playerX: 3000, camera: 2600, paused: true, auto: false, journey: { active: false } });
    assert.equal(await page.evaluate(() => window.worldlab.startBoarding()), false, 'Impossible d’embarquer loin du pied de la passerelle.');
  });

  await check('Parcours complet automatique depuis le départ à 3×, transitions ordonnées', async () => {
    await setState(page, { time: 0, camera: 0, playerX: 330, distance: 0, speed: 3, paused: true, auto: true, facing: 1, journey: { active: false } });
    await simulate(page, 80);
    const end = await state(page);
    assert.equal(end.routeState, 'EMBARQUE');
    assert.deepEqual(end.journey.history.filter(stage => stage !== 'PROMENADE'), EXPECTED_STAGES);
    closeTo(end.actor.x, 4848, 'Position finale dans la porte'); closeTo(end.actor.y, 650, 'Seuil final');
    report.fullJourney = end;
  });

  await check('Progression du trajet à 3× sans saut spatial ni transition manquante', async () => {
    await prepareBoarding(page, 3, 4610);
    const trace = [await state(page)]; let previous = trace[0];
    for (let i = 0; i < 250 && previous.routeState !== 'EMBARQUE'; i++) {
      await simulate(page, .1); const next = await state(page);
      const displacement = Math.hypot(next.actor.x - previous.actor.x, next.actor.y - previous.actor.y);
      assert.ok(displacement <= 92 * 3 * .1 + TOLERANCE, `Aucun saut de waypoint : déplacement ${displacement}`);
      assert.ok(next.routeDistance + TOLERANCE >= previous.routeDistance, 'Distance le long du trajet monotone.');
      trace.push(next); previous = next;
    }
    assert.equal(previous.routeState, 'EMBARQUE'); assert.deepEqual(previous.journey.history.filter(stage => stage !== 'PROMENADE'), EXPECTED_STAGES);
    report.routeTrace3x = trace;
  });

  await check('Pause/reprise passerelle et escalier, changement de vitesse sans saut', async () => {
    const pauses = [];
    for (const stage of ['TRAVERSEE', 'MONTEE_ESCALIER']) {
      await goToStageBySimulation(page, stage, .5, 2);
      await setState(page, { paused: true });
      const frozen = await state(page), frozenHash = await hash(page);
      await page.waitForTimeout(300); assert.deepEqual(await state(page), frozen); assert.equal(await hash(page), frozenHash);
      await page.evaluate(() => window.worldlab.advance(.4, 1));
      assert.deepEqual(await state(page), frozen, 'advance respecte la pause générale.');
      await page.locator('#speed').evaluate(input => { input.value = '3'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      const changed = await state(page); assert.equal(changed.speed, 3);
      assert.deepEqual(changed.actor, frozen.actor); closeTo(changed.routeDistance, frozen.routeDistance, 'Changer la vitesse ne déplace pas'); closeTo(changed.time, frozen.time, 'Changer la vitesse ne change pas le temps');
      for (const id of ['left', 'right', 'auto', 'travel']) assert.equal(await page.locator(`#${id}`).isDisabled(), true, `${id} neutralisé pendant la séquence`);
      assert.equal(await page.locator('#pause').isEnabled(), true); assert.equal(await page.locator('#speed').isEnabled(), true);
      await page.locator('#pause').click(); await page.waitForTimeout(120); await setState(page, { paused: true });
      const resumed = await state(page); assert.ok(resumed.routeDistance > changed.routeDistance);
      pauses.push({ stage, frozen, changed, resumed });
      await simulate(page, 20); assert.equal((await state(page)).routeState, 'EMBARQUE');
    }
    report.pauses = pauses;
  });

  await check('Pieds sur la géométrie partagée et captures de traversée, escalier et porte', async () => {
    const description = await prepareBoarding(page, 1, 4645);
    let previousProjection = -Infinity;
    for (const fraction of [.25, .7]) {
      const segment = segmentNamed(description, 'TRAVERSEE'), distance = segment.startDistance + segment.length * fraction;
      await setState(page, { time: 5, paused: true, journey: { active: true, startX: 4645, distance } });
      const actor = (await state(page)).actor;
      // Physical distance incorporates the changing scale. It is deliberately
      // not the same parameter as the projected fraction on the bridge deck.
      const projectedFraction = (actor.y - segment.from.y) / (segment.to.y - segment.from.y);
      assert.ok(projectedFraction >= 0 && projectedFraction <= 1 && projectedFraction > previousProjection, 'Projection sur le tablier continue et monotone.');
      previousProjection = projectedFraction;
      const point = await page.evaluate(async fraction => (await import('./src/london/airport-geometry.js')).bridgePoint(fraction), projectedFraction);
      closeTo(actor.x, point.x, 'Pied au centre de la passerelle en x'); closeTo(actor.y, point.y, 'Pied sur le tablier en y');
      closeTo(actor.scale, 1 + (.42 - 1) * projectedFraction, 'Échelle progressive le long de la projection');
      await saveCanvas(page, `boarding-bridge-${Math.round(fraction * 100)}.png`);
    }
    for (const [stage, fraction, file] of [['MONTEE_ESCALIER', .5, 'boarding-stairs.png'], ['ENTREE_AVION', .25, 'boarding-door-25.png'], ['ENTREE_AVION', .75, 'boarding-door-75.png']]) {
      const segment = segmentNamed(description, stage), distance = segment.startDistance + segment.length * fraction;
      await setState(page, { time: 5, paused: true, journey: { active: true, startX: 4645, distance } });
      const actor = (await state(page)).actor;
      if (stage === 'MONTEE_ESCALIER') {
        assert.equal(segment.kind, 'stairs', 'Montée sur un escalier explicite, pas une pente.');
        assert.ok(segment.points.length >= 20, 'Girons et contremarches exposés dans la géométrie du trajet.');
        let projectedLength = 0;
        for (let i = 1; i < segment.points.length; i++) {
          const a = segment.points[i - 1], b = segment.points[i];
          const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
          assert.ok((dx <= TOLERANCE || dy <= TOLERANCE) && dx + dy > 0, 'Chaque portion est un giron horizontal ou une contremarche verticale.');
          projectedLength += Math.hypot(dx, dy);
        }
        closeTo(segment.length, projectedLength / .42, 'Longueur physique de l’escalier');
        const expected = await page.evaluate(async fraction => (await import('./src/london/airport-geometry.js')).stairPoint(fraction), fraction);
        closeTo(actor.x, expected.x, 'Pied sur le giron ou la contremarche en x');
        closeTo(actor.y, expected.y, 'Pied sur le giron ou la contremarche en y');
        // Non-central samples distinguish a staircase from its diagonal chord.
        for (const probe of [.11, .27, .73, .91]) {
          await setState(page, { time: 5, paused: true, journey: { active: true, startX: 4645, distance: segment.startDistance + segment.length * probe } });
          const sampled = (await state(page)).actor;
          const point = await page.evaluate(async fraction => (await import('./src/london/airport-geometry.js')).stairPoint(fraction), probe);
          closeTo(sampled.x, point.x, `Appui escalier ${probe} en x`); closeTo(sampled.y, point.y, `Appui escalier ${probe} en y`);
        }
        await setState(page, { time: 5, paused: true, journey: { active: true, startX: 4645, distance } });
      } else {
        closeTo(actor.x, segment.from.x + (segment.to.x - segment.from.x) * fraction, `${stage} x`);
        closeTo(actor.y, segment.from.y + (segment.to.y - segment.from.y) * fraction, `${stage} y`);
      }
      await saveCanvas(page, file);
    }
    await simulate(page, 20); assert.equal((await state(page)).routeState, 'EMBARQUE');
    await saveCanvas(page, 'boarding-complete.png');
    report.routeGeometry = description;
  });

  await check('Rejouer le trajet conserve la vitesse et réinitialise parcours et caméra', async () => {
    await setState(page, { speed: 2.5 });
    await page.locator('#replay').click();
    await page.waitForFunction(() => {
      const state = window.worldlab.getState();
      return state.routeState === 'PROMENADE' && state.camera === 0 && state.playerX === 330;
    });
    const after = await state(page);
    assert.equal(after.speed, 2.5); assert.equal(after.routeState, 'PROMENADE'); assert.equal(after.journey.active, false);
    closeTo(after.camera, 0, 'Caméra de départ'); closeTo(after.playerX, 330, 'Personnage au départ'); closeTo(after.distance, 0, 'Distance remise à zéro');
    report.replay = after;
  });

  await check('Captures comparables AVANT/APRÈS à t=5, mêmes dimensions et cadrages', async () => {
    for (const [name, camera] of [['monuments', 0], ['warehouses', 1700], ['terminal', 4100], ['footbridge', 4300]]) {
      await renderAt(page, camera); await saveCanvas(page, `${name}.png`);
    }
    await renderAt(page, 0); await page.screenshot({ path: path.join(output, 'desktop-1440x1100.png'), fullPage: true });
    const box = await page.locator('#london').boundingBox(); closeTo(box.width / box.height, 1.5, 'Ratio d’affichage', .01);
  });

  await check('Allers-retours, raccords et cache borné reproductible', async () => {
    await setState(page, { facing: 1, speed: 1 }); await renderAt(page, 0); const initial = await hash(page);
    const cameras = [0, 740, 768, 800, 1700, 2400, 2700, 3300, 4100, 4608];
    for (const camera of [...cameras, ...cameras.slice(0, -1).reverse()]) {
      await renderAt(page, camera); const current = await stats(page);
      assert.ok(current.cacheTiles <= 6 && current.peakTiles <= 6); report.traversals.push({ camera, stats: current });
    }
    assert.ok((await stats(page)).evictions > 0); assert.equal(await hash(page), initial, 'Même temps/caméra après éviction = mêmes pixels.');
  });

  await check('Vidéo courte de l’embarquement réel à 3× depuis la passerelle', async () => {
    const videoContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, recordVideo: { dir: path.join(output, 'video-raw'), size: { width: 1440, height: 1100 } } });
    const videoPage = await openScene(videoContext, 'boarding-video');
    await setState(videoPage, { time: 5, camera: 4300, playerX: 4610, distance: 0, speed: 3, paused: true, auto: false, journey: { active: false } });
    await videoPage.evaluate(() => {
      window.__boardingTrace = [];
      let last = -Infinity;
      function observe(timestamp) {
        if (timestamp - last >= 90) { window.__boardingTrace.push(window.worldlab.getState()); last = timestamp; }
        if (window.worldlab.getState().routeState !== 'EMBARQUE') requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    await videoPage.locator('#board').click();
    await videoPage.waitForFunction(() => window.worldlab.getState().routeState === 'EMBARQUE', undefined, { timeout: 20000 });
    const final = await state(videoPage), trace = await videoPage.evaluate(() => window.__boardingTrace);
    assert.deepEqual(final.journey.history.filter(stage => stage !== 'PROMENADE'), EXPECTED_STAGES);
    await videoPage.waitForTimeout(400);
    const video = videoPage.video(); await videoContext.close();
    const file = path.join(output, 'boarding.webm'); await video.saveAs(file);
    report.video = { file: 'boarding.webm', dimensions: [1440, 1100], speed: 3, trace, final, note: 'Séquence réellement jouée dans le navigateur ; examen visuel à effectuer séparément.' };
  });

  await check('Mesure du coût JS et de cadence rAF après préchauffage', async () => {
    await setState(page, { time: 5, camera: 1700, playerX: 2030, speed: 1, facing: 1, paused: false, auto: true, journey: { active: false } });
    await page.waitForTimeout(1200); const before = await stats(page);
    const measurement = await page.evaluate(() => new Promise(resolve => {
      let first = 0, previous = 0; const intervals = [];
      function sample(now) {
        if (!first) first = now; if (previous) intervals.push(now - previous); previous = now;
        if (now - first < 5000) { requestAnimationFrame(sample); return; }
        const sorted = [...intervals].sort((a, b) => a - b), elapsedMs = now - first;
        resolve({ elapsedMs, intervals: intervals.length, cadenceRafHz: intervals.length * 1000 / elapsedMs, medianIntervalMs: sorted[Math.floor(sorted.length * .5)], p95IntervalMs: sorted[Math.floor(sorted.length * .95)], maxIntervalMs: Math.max(...sorted), intervalsOver33ms: intervals.filter(ms => ms > 33.4).length });
      }
      requestAnimationFrame(sample);
    }));
    await setState(page, { paused: true, auto: false });
    report.performance = { warmupMs: 1200, measurement, before, after: await stats(page), note: 'Coût JS des commandes Canvas et cadence rAF locale ; pas une garantie de FPS GPU ou sur d’autres appareils.' };
    assert.ok(measurement.elapsedMs >= 5000 && measurement.intervals > 0); assert.ok((await stats(page)).peakTiles <= 6);
  });

  await check('Mobile, tactile et redimensionnement sans débordement', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const mobile = await openScene(mobileContext, 'mobile');
    await renderAt(mobile, 0); await mobile.screenshot({ path: path.join(output, 'mobile-390x844.png'), fullPage: true });
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.locator('[data-speed="2"]').tap(); assert.equal((await state(mobile)).speed, 2);
    const before = await state(mobile); await mobile.locator('#auto').tap(); await mobile.waitForTimeout(250); await mobile.locator('#pause').tap();
    assert.ok((await state(mobile)).playerX > before.playerX); assert.equal((await state(mobile)).paused, true);
    await mobile.setViewportSize({ width: 844, height: 390 });
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const box = await mobile.locator('#london').boundingBox(); closeTo(box.width / box.height, 1.5, 'Ratio après rotation', .01);
    await mobile.screenshot({ path: path.join(output, 'mobile-landscape-844x390.png'), fullPage: true });
    report.mobile = { state: await state(mobile), stats: await stats(mobile) }; await mobileContext.close();
    await page.setViewportSize({ width: 1024, height: 700 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.setViewportSize({ width: 1440, height: 1100 });
  });

  await check('Aucune erreur JavaScript, console ou requête échouée', async () => {
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedRequests, []);
  });
  report.success = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  process.stderr.write(`ÉCHEC : ${error.message}\n`);
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'test-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Rapport : ${path.join(output, 'test-report.json')}\n`);
}
