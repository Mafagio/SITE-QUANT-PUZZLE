import { canvas, clamp, rect } from './drawing.js';
import { drawLandmarks } from './landmarks.js';
import { drawDocks, drawDockMotion, drawFootbridgeDeck, drawFootbridgeFarRail, drawFootbridgeNearRail, drawAirportForeground, drawAircraftGround, drawAircraft } from './docks.js';
import { AIRPORT } from './airport-geometry.js';
import { createJourney, beginJourney, journeyRoute, sampleJourney, advanceJourney } from './journey.js';
import { VIEW, makeSky, makeClouds, drawSky, makeDistantCity, drawQuay, makeTrees, drawTrees, makePromenade, drawPromenade, drawWalker } from './scenery.js';
import { makeWater, drawWater } from './water.js';
import { createDeparture, advanceDeparture, sampleDeparture } from './departure.js';
import { makeRiversideLife, drawRiversideLife } from './riverside-life.js';
import { makeRiverLife, drawRiverLife } from './river-life.js';

const MAX_CAMERA = VIEW.worldWidth - VIEW.width;
const WALK_SPEED = 92;
const $ = id => document.getElementById(id);
const display = $('london'), ctx = display.getContext('2d', { alpha: false });
// Texture generation keeps its pixel grid; only image placement is interpolated.
ctx.imageSmoothingEnabled = true;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const initialState = (speed = 1) => ({ time: 0, camera: 0, playerX: 330, distance: 0, gaitDistance: 0, gaitSpeed: speed, motionBlend: 0, poseAngle: 0, poseVelocity: 0, facing: 1, auto: false, paused: reducedQuery.matches, speed, moving: false, zoom: 1, journey: createJourney(), departure: createDeparture() });
const state = initialState();
let held = 0, ready = false, lastTimestamp = 0, loading = false, seekSerial = 0, renderCount = 0;
let simulationFrames = 0, simulationMs = 0, reviewing = false;
let tilePrepHandle = null, tilePrepUsesIdle = false, idleWorkSinceFrame = 0;
const frameTimes = [], fullFrameTimes = [], frameIntervals = [], idlePrepTimes = [], waterTimes = [];
const buildTimes = [];
const start = performance.now();

class TileCache {
  constructor() { this.tiles = new Map(); this.lights = new Map(); this.builds = 0; this.evictions = 0; this.peak = 0; }
  visible(camera) {
    const first = Math.floor(camera / VIEW.tile), last = Math.ceil((camera + VIEW.width) / VIEW.tile) - 1;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }
  wanted(camera, facing = 1) {
    const visible = this.visible(camera), first = visible[0], last = visible.at(-1);
    const ahead = facing > 0 ? [last + 1, last + 2, first - 1] : [first - 1, first - 2, last + 1];
    return [...visible, ...ahead].filter(i => i >= 0 && i < VIEW.worldWidth / VIEW.tile).slice(0, 6);
  }
  build(index, keep) {
    if (this.tiles.has(index)) return;
    // Evict before allocating. At most six 768×704 RGBA architectural tiles.
    if (this.tiles.size >= 6) {
      const victim = [...this.tiles.keys()].find(i => !keep.includes(i));
      if (victim === undefined) return;
      const old = this.tiles.get(victim); old.width = 1; old.height = 1;
      this.tiles.delete(victim); this.lights.delete(victim); this.evictions++;
    }
    const then = performance.now(), tile = canvas(VIEW.tile, VIEW.water), c = tile.getContext('2d');
    const x = index * VIEW.tile, range = { left: x, right: x + VIEW.tile };
    c.translate(-x, 0);
    // The bridge spans the water. Its piers must not be hidden by the far quay.
    if (range.right > 596) drawQuay(c, Math.max(596, x), x + VIEW.tile);
    if (range.left < 596) rect(c, '#3e4b79', x, 662, Math.min(VIEW.tile, 596 - x), 42);
    drawLandmarks(c, range); drawDocks(c, range);
    const pixels = c.getImageData(0, 0, VIEW.tile, VIEW.water).data, lights = [];
    for (let xx = 6; xx < VIEW.tile; xx += 12) {
      let count = 0;
      for (let yy = 370; yy < 658; yy += 4) {
        const p = (yy * VIEW.tile + xx) * 4;
        if (pixels[p] > 234 && pixels[p + 1] > 163 && pixels[p + 2] < 177 && pixels[p + 3] > 200) count++;
      }
      if (count > 2) lights.push({ x: x + xx, energy: clamp(count / 23, .28, .92) });
    }
    const groups = new Map();
    for (const light of lights) {
      const bucket = Math.floor(light.x / 64);
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(light);
    }
    this.lights.set(index, [...groups.values()].map(group => ({
      x: group.reduce((n, source) => n + source.x * source.energy, 0) / group.reduce((n, source) => n + source.energy, 0),
      width: clamp((group.at(-1).x - group[0].x + 12) * .65, 10, 40),
      energy: clamp(group.reduce((n, source) => n + source.energy, 0) / group.length + .22, .55, 1)
    })));
    this.tiles.set(index, tile); this.builds++;
    this.peak = Math.max(this.peak, this.tiles.size);
    buildTimes.push(performance.now() - then);
  }
  async ensure(camera, facing = 1, current = () => true) {
    const keep = this.wanted(camera, facing);
    for (const i of this.visible(camera)) {
      if (!current()) return;
      this.build(i, keep);
      // Yield between construction jobs. Large seeks never build a whole world in one frame.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  warmOne(camera, facing) {
    const keep = this.wanted(camera, facing), next = keep.find(i => !this.tiles.has(i));
    if (next !== undefined) this.build(next, keep);
  }
  memoryBytes() { return this.tiles.size * VIEW.tile * VIEW.water * 4; }
}

const cache = new TileCache();
const sky = makeSky(), clouds = makeClouds(), farCity = makeDistantCity(), trees = makeTrees();
const water = makeWater(), paving = makePromenade();
const riversideLife = makeRiversideLife(), riverLife = makeRiverLife();
const cityLayer = canvas(VIEW.width, VIEW.water), city = cityLayer.getContext('2d');
city.imageSmoothingEnabled = true;
const baseBytes = [sky, farCity, water.canvas, paving, cityLayer, display, ...clouds.map(i => i.sprite), ...trees.sprites, ...riversideLife.sprites, ...riverLife.sprites].reduce((n, c) => n + c.width * c.height * 4, 0);

function cancelTilePrep() {
  if (tilePrepHandle === null) return;
  if (tilePrepUsesIdle) cancelIdleCallback(tilePrepHandle);
  else clearTimeout(tilePrepHandle);
  tilePrepHandle = null;
}

function scheduleTilePrep() {
  if (!ready || loading || reviewing || document.hidden || tilePrepHandle !== null) return;
  if (!cache.wanted(state.camera, state.facing).some(index => !cache.tiles.has(index))) return;
  const prepare = () => {
    tilePrepHandle = null;
    if (loading || reviewing || document.hidden) return;
    const begin = performance.now();
    // One finite job per idle callback. Never build tiles in the rAF callback.
    cache.warmOne(state.camera, state.facing);
    const elapsed = performance.now() - begin;
    idleWorkSinceFrame += elapsed;
    idlePrepTimes.push(elapsed); if (idlePrepTimes.length > 360) idlePrepTimes.shift();
    scheduleTilePrep();
  };
  tilePrepUsesIdle = typeof requestIdleCallback === 'function';
  tilePrepHandle = tilePrepUsesIdle
    ? requestIdleCallback(prepare, { timeout: 750 })
    : setTimeout(prepare, 50);
}

function draw() {
  const begin = performance.now(), camera = state.camera;
  const actor = currentActor();
  const aircraft = sampleDeparture(state.departure);
  // Fractional framing can leave partly covered edge pixels between layers.
  // Start opaque so repeated paused draws never accumulate their coverage.
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#283c6a';
  ctx.imageSmoothingEnabled = true;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  // One continuous framing transform. Near ground stays at y958 while boarding
  // gently brings the distant passenger and the actual aircraft door closer.
  ctx.setTransform(state.zoom, 0, 0, state.zoom, 768 * (1 - state.zoom), 958 * (1 - state.zoom));
  drawSky(ctx, sky, clouds, camera, state.time);
  city.clearRect(0, 0, VIEW.width, VIEW.water);
  city.imageSmoothingEnabled = true;
  city.drawImage(farCity, -camera * .38, 0);
  for (const index of cache.visible(camera)) {
    const tile = cache.tiles.get(index);
    if (tile) city.drawImage(tile, index * VIEW.tile - camera, 0);
  }
  drawTrees(city, trees, camera, state.time);
  city.save(); city.translate(-camera, 0);
  drawDockMotion(city, state.time, { left: camera, right: camera + VIEW.width });
  // Two minor working lights breathe at a bounded 6% amplitude; not all windows blink.
  for (const x of [3315, 5135]) if (x > camera && x < camera + VIEW.width) {
    city.globalAlpha = .08 + Math.sin(state.time * .75 + x) * .03;
    rect(city, '#fff5b0', x, x < 4000 ? 504 : 600, 9, 5);
  }
  city.globalAlpha = 1; city.restore();
  // The plane, its ground shadow and its reflected image share the same world
  // projection. Static terminal tiles never contain a second parked aircraft.
  city.save(); city.translate(-camera, 0);
  const airportRange = { left: camera, right: camera + VIEW.width };
  drawAircraftGround(city, aircraft, airportRange);
  drawAircraft(city, aircraft, airportRange);
  city.restore();
  ctx.drawImage(cityLayer, 0, 0);
  const waterStart = performance.now();
  drawWater(ctx, cityLayer, water, camera, state.time, cache.visible(camera).flatMap(i => cache.lights.get(i) || []));
  waterTimes.push(performance.now() - waterStart); if (waterTimes.length > 360) waterTimes.shift();
  drawRiverLife(ctx, riverLife, camera, state.time);
  drawPromenade(ctx, paving, camera);
  drawRiversideLife(ctx, riversideLife, camera, state.time);
  ctx.save(); ctx.translate(-camera, 0);
  const range = { left: camera, right: camera + VIEW.width };
  drawFootbridgeDeck(ctx, range); drawFootbridgeFarRail(ctx, range); ctx.restore();
  ctx.save();
  if (actor.entering) {
    const d = AIRPORT.doorRect;
    ctx.beginPath(); ctx.rect(d.x - camera, d.y, d.width, d.height); ctx.clip();
  }
  // Entry is clipped by the real door until the passenger is entirely inside.
  // Afterwards the occupied cabin moves; no figure remains at the old doorway.
  if (!actor.finished) drawWalker(ctx, { ...state, speed: state.gaitSpeed, camera, playerX: actor.x, playerY: actor.y, scale: actor.scale, facing: actor.facing, orientation: actor.orientation, climbing: actor.stage === 'MONTEE_ESCALIER' });
  ctx.restore();
  ctx.save(); ctx.translate(-camera, 0);
  drawFootbridgeNearRail(ctx, range); drawAirportForeground(ctx, range, aircraft); ctx.restore();
  ctx.restore();
  renderCount++;
  frameTimes.push(performance.now() - begin);
  if (frameTimes.length > 360) frameTimes.shift();
}

function currentActor() {
  if (state.journey.active) return sampleJourney(state.journey);
  return { x: state.playerX, y: VIEW.ground, scale: 1, facing: state.facing, orientation: 'side', stage: 'PROMENADE', progress: 0, entering: false, finished: false, zoomTarget: 1 };
}

function getState() {
  const actor = currentActor();
  return { ...state, departure: { ...state.departure, history: [...state.departure.history] }, aircraft: sampleDeparture(state.departure), journey: { ...state.journey, history: [...state.journey.history] }, actor, routeState: actor.stage, routeDistance: state.journey.distance };
}

function startBoarding({ automatic = false, resume = true } = {}) {
  if (state.journey.active || (!automatic && Math.abs(state.playerX - AIRPORT.route.approach.x) > 90)) return false;
  state.journey = beginJourney(state.playerX); state.auto = false; held = 0; state.moving = true;
  state.departure = createDeparture();
  if (resume) state.paused = false;
  syncUI(); return true;
}

function frameJourney(dt, physicalDistance) {
  if (sampleJourney(state.journey).finished) { frameDeparture(dt); return; }
  const consumed = advanceJourney(state.journey, physicalDistance);
  const actor = sampleJourney(state.journey);
  state.playerX = actor.x; state.facing = actor.facing;
  state.distance += consumed; state.gaitDistance += consumed;
  if (consumed > 0) state.gaitSpeed = state.speed;
  state.moving = consumed > 0 && !actor.finished;
  const cameraEase = 1 - Math.exp(-2.5 * dt), zoomEase = 1 - Math.exp(-2 * dt);
  state.camera += (4260 - state.camera) * cameraEase;
  state.zoom += (actor.zoomTarget - state.zoom) * zoomEase;
  if (actor.finished) {
    state.auto = false;
    state.departure = { ...createDeparture({ active: true }), startZoom: state.zoom, startCamera: state.camera };
    const usedTime = consumed / (WALK_SPEED * state.speed);
    frameDeparture(Math.max(0, dt - usedTime));
  }
}

function frameDeparture(dt) {
  state.moving = false;
  advanceDeparture(state.departure, dt);
  const aircraft = sampleDeparture(state.departure);
  // Open the view gently before taxiing, keeping the lift-off within the
  // existing panorama. Camera motion never changes the plane's world path.
  const u = clamp(aircraft.elapsed / 4, 0, 1), ease = u*u*u*(10+u*(-15+6*u));
  const targetZoom = (state.departure.startZoom ?? 1.75) * (1-ease) + ease;
  state.zoom += (targetZoom-state.zoom)*(1-Math.exp(-4*dt));
  const targetCamera = clamp(aircraft.pivotX-640, state.departure.startCamera ?? 4260, MAX_CAMERA);
  state.camera += (targetCamera-state.camera)*(1-Math.exp(-2.4*dt));
}

function step(dt, directionOverride = null, force = false) {
  if (!force && (state.paused || loading || document.hidden)) return;
  stepWorld(dt, directionOverride);
  // Blend the displayed pose without changing the physical distance or speed.
  state.motionBlend += ((state.moving ? 1 : 0) - state.motionBlend) * (1 - Math.exp(-18 * dt));
  // A critically damped pivot starts with the body's existing angular velocity.
  // Reversing direction therefore cannot jump most of the turn in its first frame.
  const targetAngle=state.facing < 0 ? -Math.PI : 0, omega=18;
  const offset=state.poseAngle-targetAngle, spring=state.poseVelocity+omega*offset;
  const damping=Math.exp(-omega*dt);
  state.poseAngle=targetAngle+(offset+spring*dt)*damping;
  state.poseVelocity=(state.poseVelocity-omega*spring*dt)*damping;
}

function stepWorld(dt, directionOverride) {
  state.time += dt;
  const travel = WALK_SPEED * state.speed * dt;
  if (state.journey.active) { frameJourney(dt, travel); return; }
  const direction = directionOverride ?? (held || (state.auto ? state.facing : 0));
  if (!direction) { state.moving = false; state.camera = followCamera(state.playerX, dt); return; }
  const previous = state.playerX;
  const next = clamp(previous + direction * travel, 80, MAX_CAMERA + 1100);
  if (state.auto && direction > 0 && previous <= AIRPORT.route.approach.x && next >= AIRPORT.route.approach.x) {
    const used = AIRPORT.route.approach.x - previous;
    state.playerX = AIRPORT.route.approach.x; state.distance += used; state.gaitDistance += used;
    const usedTime = travel > 0 ? dt * used / travel : 0;
    state.camera = followCamera(state.playerX, usedTime);
    startBoarding({ automatic: true, resume: false });
    frameJourney(dt - usedTime, Math.max(0, travel - used));
    return;
  }
  state.playerX = next; state.distance += Math.abs(next - previous); state.gaitDistance += Math.abs(next - previous);
  state.facing = direction; state.moving = next !== previous; state.camera = followCamera(next, dt);
  if (state.moving) state.gaitSpeed = state.speed;
  if (previous === next) state.auto = false;
}

function followCamera(playerX, dt) {
  // The dead zone supplies a target, never an immediate lock to a screen pixel.
  // Exponential damping behaves the same at different display refresh rates.
  const screenX = playerX - state.camera;
  const target = clamp(screenX > 500 ? playerX - 500 : screenX < 330 ? playerX - 330 : state.camera, 0, MAX_CAMERA);
  return state.camera + (target - state.camera) * (1 - Math.exp(-4.5 * dt));
}

function district(camera) {
  if (camera < 1100) return ['Westminster & Tower Bridge', 0];
  if (camera < 2400) return ['Les entrepôts de la Tamise', 1];
  if (camera < 3700) return ['La grue & les docks', 2];
  return ['Le terminal & la passerelle', 3];
}
const referenceList = [
  ['frame01.png', 'frame01 · Monuments', 'Référence pixel art de Tower Bridge, Westminster et Elizabeth Tower au coucher du soleil.'],
  ['frame05.png', 'frame05 · Entrepôts', 'Référence des entrepôts de brique à pignons sur la Tamise.'],
  ['frame06.png', 'frame06 · Grue et docks', 'Référence des entrepôts et de la grue portuaire.'],
  ['frame11_pont_aeroport.png', 'frame11 · Terminal et passerelle', 'Référence du terminal vitré, de l’avion stationné et de la passerelle.']
];
let selectedReference = -1;
let announcedStage = '';
const journeyLabels = {
  APPROCHE_PASSERELLE: 'Au pied de la passerelle. Direction l’aéroport.',
  TRAVERSEE: 'Traversée de la passerelle…', QUAI_AEROPORT: 'Arrivée sur le quai de l’aéroport.',
  APPROCHE_AVION: 'En route vers l’avion…', MONTEE_ESCALIER: 'Montée de l’escalier…',
  ENTREE_AVION: 'Entrée dans l’avion…', EMBARQUE: 'Vous êtes à bord. Préparation du départ…',
  STATIONNE: 'À bord. Fermeture de la porte…', PREPARATION: 'L’escalier se retire. Départ imminent…',
  ROULAGE: 'L’avion prend de la vitesse…', DECOLLAGE: 'Décollage…', EN_VOL: 'Bon voyage !'
};
function syncUI() {
  const [label, chapter] = district(state.camera);
  $('district').textContent = label;
  $('travel').value = String(Math.round(state.camera));
  $('progress').textContent = state.camera < 1 ? 'Départ' : `${Math.round(state.camera / MAX_CAMERA * 100)} %`;
  $('position').textContent = `${Math.round(state.camera / 8)} m`;
  $('auto').setAttribute('aria-pressed', String(state.auto));
  $('auto').querySelector('span').textContent = state.auto ? 'Arrêter la marche' : 'Marche auto';
  $('pause').setAttribute('aria-pressed', String(state.paused));
  $('pause').querySelector('span').textContent = state.paused ? 'Reprendre' : 'Pause';
  $('pause').setAttribute('aria-label', state.paused ? 'Reprendre tous les mouvements' : 'Figer tous les mouvements');
  const actor = currentActor(), locked = state.journey.active;
  for (const id of ['left', 'right', 'auto', 'travel']) $(id).disabled = locked;
  document.querySelectorAll('[data-camera]').forEach(button => { button.disabled = locked; });
  $('speed').value = String(state.speed);
  const speedText = `${Number(state.speed.toFixed(2)).toString().replace('.', ',')}×`;
  $('speed-value').textContent = speedText; $('speed').setAttribute('aria-valuetext', speedText);
  document.querySelectorAll('[data-speed]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
  const nearby = !locked && Math.abs(state.playerX - AIRPORT.route.approach.x) <= 90;
  $('journey-panel').hidden = !locked && !nearby;
  $('board').hidden = !nearby; $('replay').hidden = !actor.finished;
  const messageStage = nearby ? 'APPROCHE_PASSERELLE' : actor.finished && state.departure.active ? sampleDeparture(state.departure).stage : actor.stage;
  if (announcedStage !== messageStage) {
    $('journey-status').textContent = journeyLabels[messageStage] || '';
    announcedStage = messageStage;
  }
  document.querySelectorAll('[data-camera]').forEach((button, i) => {
    if (i === chapter) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
  });
  if (!$('comparison').hidden && selectedReference !== chapter) {
    const [name, caption, alt] = referenceList[chapter];
    $('reference-image').src = `./LONDON/${name}`; $('reference-image').alt = alt;
    $('reference-caption').textContent = `${caption} — dessin cible, non utilisé dans le décor.`;
    selectedReference = chapter;
  }
  if (document.querySelector('details').open) $('statistics').textContent = JSON.stringify(stats(), null, 2);
}

function stats() {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const p95 = values => { const ordered = [...values].sort((a, b) => a - b); return ordered[Math.floor(ordered.length * .95)] || 0; };
  return {
    resolution: [VIEW.width, VIEW.height], worldWidth: VIEW.worldWidth, maxCamera: MAX_CAMERA,
    cacheTiles: cache.tiles.size, cacheLimit: 6, peakTiles: cache.peak, tileBuilds: cache.builds, evictions: cache.evictions,
    cacheMiB: +(cache.memoryBytes() / 1048576).toFixed(2), estimatedCanvasMiB: +((baseBytes + cache.memoryBytes()) / 1048576).toFixed(2),
    renderCount, renderMeanMs: +avg(frameTimes).toFixed(2), renderP95Ms: +(sorted[Math.floor(sorted.length * .95)] || 0).toFixed(2),
    // CPU time includes step, drawing, UI, scheduling and idle tile work since
    // the previous callback. Intervals additionally expose presentation delays;
    // neither value claims to measure GPU presentation.
    fullFrameMeanMs: +avg(fullFrameTimes).toFixed(2), fullFrameP95Ms: +p95(fullFrameTimes).toFixed(2),
    frameIntervalMeanMs: +avg(frameIntervals).toFixed(2), frameIntervalP95Ms: +p95(frameIntervals).toFixed(2),
    frameIntervalMaxMs: +Math.max(0, ...frameIntervals).toFixed(2), longFrameCount: frameIntervals.filter(ms => ms > 25).length,
    idlePrepMeanMs: +avg(idlePrepTimes).toFixed(2), idlePrepMaxMs: +Math.max(0, ...idlePrepTimes).toFixed(2),
    tileBuildMaxMs: +Math.max(0, ...buildTimes).toFixed(2),
    waterSubmitMeanMs: +avg(waterTimes).toFixed(2), waterPatternCache: water.reflectionCache?.size || 0,
    observedRafHz: simulationMs > 0 ? +(simulationFrames * 1000 / simulationMs).toFixed(1) : 0,
    observationSeconds: +(simulationMs / 1000).toFixed(1), reducedMotion: reducedQuery.matches,
    referenceImagesInScene: 0, artSeed: 'fixed per-component seeds', staticReadyMs: ready ? +readyAt.toFixed(1) : null
  };
}
let readyAt = 0;
function pixelHash() {
  const pixels = ctx.getImageData(0, 0, VIEW.width, VIEW.height).data;
  let h = 2166136261;
  for (let i = 0; i < pixels.length; i++) { h ^= pixels[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function applyState(patch = {}) {
  const serial = ++seekSerial;
  const targetCamera = Number.isFinite(patch.camera) ? clamp(patch.camera, 0, MAX_CAMERA) : state.camera;
  loading = true; cancelTilePrep();
  await cache.ensure(targetCamera, patch.facing ?? state.facing, () => serial === seekSerial);
  if (serial !== seekSerial) return getState();
  if (patch.journey) {
    state.departure = createDeparture();
    if (patch.journey.active) {
      state.journey = beginJourney(Number.isFinite(patch.journey.startX) ? patch.journey.startX : AIRPORT.route.approach.x);
      advanceJourney(state.journey, Math.max(0, Number(patch.journey.distance) || 0));
      // Explicit review sampling carries its own reproducible walking phase.
      if (!Number.isFinite(patch.gaitDistance)) state.gaitDistance = state.journey.distance;
      if (typeof patch.moving !== 'boolean') state.moving = !sampleJourney(state.journey).finished;
    } else state.journey = createJourney();
  }
  if (Number.isFinite(patch.time)) state.time = Math.max(0, patch.time);
  if (Number.isFinite(patch.camera) && !state.journey.active) {
    state.camera = targetCamera;
    state.playerX = Number.isFinite(patch.playerX) ? clamp(patch.playerX, targetCamera + 40, targetCamera + VIEW.width - 40) : targetCamera + 330;
    state.distance = Number.isFinite(patch.distance) ? Math.max(0, patch.distance) : targetCamera;
    state.gaitDistance = Number.isFinite(patch.gaitDistance) ? Math.max(0, patch.gaitDistance) : state.distance;
    state.zoom = 1;
  }
  state.camera = targetCamera;
  for (const key of ['distance', 'playerX', 'gaitDistance']) if (Number.isFinite(patch[key])) state[key] = Math.max(0, patch[key]);
  if (Number.isFinite(patch.speed)) state.speed = clamp(Math.round(patch.speed * 4) / 4, .25, 3);
  if (Number.isFinite(patch.gaitSpeed)) state.gaitSpeed = patch.gaitSpeed;
  if (Number.isFinite(patch.motionBlend)) state.motionBlend = clamp(patch.motionBlend, 0, 1);
  if (Number.isFinite(patch.zoom)) state.zoom = clamp(patch.zoom, 1, 1.8);
  if (typeof patch.moving === 'boolean') {
    state.moving = patch.moving;
    if (!patch.moving) state.motionBlend = 0;
  }
  if (state.journey.active) { const actor = currentActor(); state.playerX = actor.x; state.facing = actor.facing; }
  for (const key of ['paused', 'auto']) if (typeof patch[key] === 'boolean') state[key] = patch[key];
  if (patch.facing === 1 || patch.facing === -1) {
    state.facing = patch.facing;
    state.poseAngle = patch.facing < 0 ? -Math.PI : 0;
    state.poseVelocity = 0;
  }
  if (Number.isFinite(patch.poseAngle)) { state.poseAngle = patch.poseAngle; state.poseVelocity = 0; }
  if (state.journey.active && sampleJourney(state.journey).finished && (patch.journey || patch.departure || !state.departure.active)) {
    const active = patch.departure?.active !== false;
    state.departure = { ...createDeparture({ active }), startZoom: patch.departure?.startZoom ?? state.zoom, startCamera: patch.departure?.startCamera ?? state.camera };
    if (Number.isFinite(patch.departure?.elapsed)) advanceDeparture(state.departure, patch.departure.elapsed);
  }
  held = 0; loading = false; lastTimestamp = 0;
  draw(); syncUI(); scheduleTilePrep(); return getState();
}

async function reset() { return applyState(initialState(state.speed)); }
function togglePause() { state.paused = !state.paused; syncUI(); }
function capture() {
  draw();
  const a = document.createElement('a');
  a.download = `london-c${Math.round(state.camera)}-t${state.time.toFixed(2)}.png`;
  a.href = display.toDataURL('image/png'); a.click();
  $('notice').textContent = 'Capture PNG enregistrée.';
}

function frame(timestamp) {
  const begin = performance.now(), prepMs = idleWorkSinceFrame;
  idleWorkSinceFrame = 0;
  if (lastTimestamp) {
    const elapsed = timestamp - lastTimestamp;
    if (elapsed > 0 && !document.hidden) {
      simulationFrames++; simulationMs += elapsed;
      frameIntervals.push(elapsed); if (frameIntervals.length > 360) frameIntervals.shift();
    }
    step(elapsed > 200 ? 0 : Math.min(elapsed / 1000, .05));
  }
  lastTimestamp = timestamp;
  if (!loading && !reviewing) draw();
  scheduleTilePrep();
  if (renderCount % 12 === 0) syncUI();
  requestAnimationFrame(frame);
  fullFrameTimes.push(performance.now() - begin + prepMs);
  if (fullFrameTimes.length > 360) fullFrameTimes.shift();
}

function bindHold(id, direction) {
  const button = $(id);
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (state.journey.active) return;
    button.setPointerCapture(event.pointerId); held = direction;
    state.auto = false; state.facing = direction; state.paused = false; syncUI();
  });
  const release = () => { if (held === direction) held = 0; };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  // Keyboard activation (Enter/Space) also gives a small deliberate step.
  button.addEventListener('click', event => { if (event.detail === 0) applyState({ camera: state.camera + direction * 44, facing: direction, paused: true, auto: false }); });
}
bindHold('left', -1); bindHold('right', 1);
$('auto').addEventListener('click', () => {
  if (state.journey.active) return;
  if (state.playerX >= MAX_CAMERA + 1099) state.facing = -1;
  if (state.playerX <= 81) state.facing = 1;
  state.auto = !state.auto; if (state.auto) state.paused = false; syncUI();
  if (state.auto && state.facing > 0 && state.playerX >= AIRPORT.route.approach.x - 1) startBoarding({ automatic: true });
});
$('pause').addEventListener('click', togglePause); $('reset').addEventListener('click', reset); $('capture').addEventListener('click', capture);
$('travel').addEventListener('input', event => applyState({ camera: Number(event.target.value), auto: false }));
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => applyState({ camera: Number(button.dataset.camera), auto: false })));
$('compare').addEventListener('click', () => { const open = $('comparison').hidden; $('comparison').hidden = !open; $('compare').setAttribute('aria-expanded', String(open)); syncUI(); });
$('speed').addEventListener('input', event => { state.speed = clamp(Math.round(Number(event.target.value) * 4) / 4, .25, 3); syncUI(); });
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => { state.speed = Number(button.dataset.speed); syncUI(); }));
$('board').addEventListener('click', () => startBoarding()); $('replay').addEventListener('click', reset);
addEventListener('keydown', event => {
  if (/INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    if (state.journey.active) return;
    event.preventDefault(); held = event.code === 'ArrowRight' ? 1 : -1; state.facing = held; state.auto = false; state.paused = false;
  } else if (event.code === 'Space' && !event.repeat) { event.preventDefault(); togglePause(); }
  else if (event.code === 'KeyR' && !event.repeat) reset();
  syncUI();
});
addEventListener('keyup', event => { if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') held = 0; });
addEventListener('blur', () => { held = 0; lastTimestamp = 0; });
document.addEventListener('visibilitychange', () => {
  held = 0; lastTimestamp = 0;
  if (document.hidden) cancelTilePrep(); else scheduleTilePrep();
});
reducedQuery.addEventListener('change', event => {
  if (event.matches) { state.paused = true; state.auto = false; held = 0; }
  $('motion-note').textContent = event.matches ? 'Animations réduites : scène figée au départ. Reprendre pour l’animer.' : 'Départ à l’arrêt. À vous de prendre la rive.';
  syncUI();
});
if (reducedQuery.matches) $('motion-note').textContent = 'Animations réduites : scène figée au départ. Reprendre pour l’animer.';

const readyPromise = (async () => {
  await cache.ensure(0); ready = true; readyAt = performance.now() - start;
  $('loading').hidden = true; draw(); syncUI(); requestAnimationFrame(frame);
  return true;
})().catch(error => {
  $('error').hidden = false; $('error').textContent = `La scène n’a pas pu démarrer : ${error.message}. Lancez-la avec le serveur local indiqué dans docs/london-running.md.`;
  throw error;
});

async function simulate(seconds, { direction = null, force = true } = {}) {
  await readyPromise;
  const wasPaused = state.paused; state.paused = true; reviewing = true; cancelTilePrep();
  try {
    let left = clamp(Number(seconds) || 0, 0, 300);
    if (force || !wasPaused) while (left > 1e-10) {
      const dt = Math.min(left, 1 / 60); step(dt, direction, true); left -= dt;
    }
    // Review stepping builds only its final visible region, never every tile
    // crossed by a long simulated traversal.
    await cache.ensure(state.camera, state.facing);
  } finally {
    lastTimestamp = 0; state.paused = wasPaused; reviewing = false;
  }
  draw(); syncUI(); scheduleTilePrep(); return getState();
}
function ambientHash() {
  // Review-only readback, never a per-frame operation. Both regions exclude
  // the promenade actor so different walking speeds can be compared fairly.
  const regions = [[0, 0, VIEW.width, 260], [0, 708, VIEW.width, 160]];
  let h = 2166136261;
  for (const region of regions) for (const byte of ctx.getImageData(...region).data) { h ^= byte; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
window.worldlab = Object.freeze({
  ready: readyPromise, getState, setState: applyState,
  renderAt: (time = 5, camera = 0) => applyState({ time, camera, paused: true, auto: false, moving: false, zoom: 1, facing: 1, journey: { active: false } }),
  simulate, advance: (seconds, direction = null) => simulate(seconds, { direction, force: false }),
  startBoarding, route: () => journeyRoute(state.journey), ambientHash,
  render: draw, reset, stats, pixelHash, capture, config: { ...VIEW, maxCamera: MAX_CAMERA, walkSpeed: WALK_SPEED, airport: AIRPORT, seed: 'fixed per-component seeds' }
});
