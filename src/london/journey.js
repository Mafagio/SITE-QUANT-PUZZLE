import { AIRPORT } from './airport-geometry.js';

const GROUND_Y = AIRPORT.route.approach.y;
const FAR_SCALE = .42;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const lerp = (a, b, u) => a + (b - a) * u;
const smoothstep = u => u * u * (3 - 2 * u);

/** The route remains idle until an explicit manual or automatic boarding action. */
export function createJourney(startX = AIRPORT.route.approach.x) {
  return {
    active: false,
    startX: Number.isFinite(startX) ? startX : AIRPORT.route.approach.x,
    distance: 0,
    history: [],
  };
}

export function beginJourney(startX = AIRPORT.route.approach.x) {
  const journey = createJourney(startX);
  journey.active = true;
  journey.history.push('APPROCHE_PASSERELLE');
  return journey;
}

/** Integral of projected distance / scale when scale varies linearly on a segment. */
function physicalLength(from, to) {
  const projected = Math.hypot(to.x - from.x, to.y - from.y);
  const delta = to.scale - from.scale;
  return Math.abs(delta) < 1e-10
    ? projected / from.scale
    : projected * Math.log(to.scale / from.scale) / delta;
}

/** Shared geometric anchors, expressed as a physically measured polyline. */
export function journeyRoute(journey) {
  const route = AIRPORT.route;
  const startX = Number.isFinite(journey?.startX) ? journey.startX : route.approach.x;
  const segments = [];
  const position = (point, scale) => ({ x: point.x, y: point.y, scale });
  let startDistance = 0;
  const add = (stage, from, to, orientation, facing, points) => {
    const length = points
      ? points.slice(1).reduce((sum, p, i) => sum + physicalLength(points[i], p), 0)
      : physicalLength(from, to);
    if (length <= 0) return;
    const endDistance = startDistance + length;
    segments.push({ stage, from, to, length, startDistance, endDistance, orientation, facing,
      ...(points ? { kind: 'stairs', points } : {}) });
    startDistance = endDistance;
  };

  add('APPROCHE_PASSERELLE',
    { x: startX, y: GROUND_Y, scale: 1 }, position(route.approach, 1),
    'side', startX > route.approach.x ? -1 : 1);
  add('APPROCHE_PASSERELLE', position(route.approach, 1), position(route.bridgeStart, 1), 'back', 1);
  add('TRAVERSEE', position(route.bridgeStart, 1), position(route.bridgeEnd, FAR_SCALE), 'threeQuarter', 1);
  add('QUAI_AEROPORT', position(route.bridgeEnd, FAR_SCALE), position(route.apronTurn, FAR_SCALE), 'side', -1);
  add('APPROCHE_AVION', position(route.apronTurn, FAR_SCALE), position(route.stairBottom, FAR_SCALE), 'side', -1);
  add('MONTEE_ESCALIER', position(route.stairBottom, FAR_SCALE), position(route.doorThreshold, FAR_SCALE), 'threeQuarter', -1,
    AIRPORT.stairs.path.map(point => position(point, FAR_SCALE)));
  add('ENTREE_AVION', position(route.doorThreshold, FAR_SCALE), position(route.insideDoor, FAR_SCALE), 'back', -1);
  return { segments, totalDistance: startDistance };
}

function segmentFraction(segment, physicalDistance) {
  const from = segment.from, delta = segment.to.scale - from.scale;
  if (Math.abs(delta) < 1e-10) return clamp(physicalDistance / segment.length, 0, 1);
  const projected = Math.hypot(segment.to.x - from.x, segment.to.y - from.y);
  return clamp(from.scale * Math.expm1(physicalDistance * delta / projected) / delta, 0, 1);
}

function sampleSegment(segment, distance) {
  if (segment.kind !== 'stairs') {
    const u = segmentFraction(segment, distance);
    return { x: lerp(segment.from.x, segment.to.x, u), y: lerp(segment.from.y, segment.to.y, u), scale: lerp(segment.from.scale, segment.to.scale, u), u };
  }
  let remaining = distance;
  for (let i = 1; i < segment.points.length; i++) {
    const from = segment.points[i - 1], to = segment.points[i], length = physicalLength(from, to);
    if (remaining <= length || i === segment.points.length - 1) {
      const edgeU = segmentFraction({ from, to, length }, remaining);
      return { x: lerp(from.x, to.x, edgeU), y: lerp(from.y, to.y, edgeU), scale: lerp(from.scale, to.scale, edgeU), u: clamp(distance / segment.length, 0, 1) };
    }
    remaining -= length;
  }
}

function zoomFor(stage, u) {
  const targets = {
    APPROCHE_PASSERELLE: [1, 1],
    TRAVERSEE: [1, 1.22],
    QUAI_AEROPORT: [1.22, 1.32],
    APPROCHE_AVION: [1.32, 1.4],
    MONTEE_ESCALIER: [1.4, 1.75],
    ENTREE_AVION: [1.75, 1.75],
  };
  const [a, b] = targets[stage];
  return lerp(a, b, smoothstep(u));
}

/** A deterministic sample: no render-time rounding, timers or hidden state. */
export function sampleJourney(journey) {
  if (!journey?.active) {
    return {
      x: Number.isFinite(journey?.startX) ? journey.startX : AIRPORT.route.approach.x,
      y: GROUND_Y, scale: 1, orientation: 'side', facing: 1,
      stage: 'PROMENADE', progress: 0, segmentProgress: 0,
      entering: false, finished: false, zoomTarget: 1,
    };
  }
  const route = journeyRoute(journey);
  const distance = clamp(Number.isFinite(journey.distance) ? journey.distance : 0, 0, route.totalDistance);
  if (distance >= route.totalDistance) {
    const last = route.segments.at(-1);
    return {
      ...last.to, orientation: last.orientation, facing: last.facing,
      stage: 'EMBARQUE', progress: 1, segmentProgress: 1,
      entering: true, finished: true, zoomTarget: 1.75,
    };
  }
  // A boundary belongs to the next segment, never prematurely to EMBARQUE.
  const segment = route.segments.find(item => distance < item.endDistance);
  const position = sampleSegment(segment, distance - segment.startDistance), u = position.u;
  return {
    x: position.x, y: position.y, scale: position.scale,
    orientation: segment.orientation, facing: segment.facing,
    stage: segment.stage, progress: distance / route.totalDistance,
    segmentProgress: u, entering: segment.stage === 'ENTREE_AVION',
    finished: false, zoomTarget: zoomFor(segment.stage, u),
  };
}

/** Consume every crossed segment, including a surplus that crosses several at 3×. */
export function advanceJourney(journey, physicalDistance) {
  if (!journey?.active || !Number.isFinite(physicalDistance) || physicalDistance <= 0) return 0;
  const route = journeyRoute(journey);
  const previous = clamp(Number.isFinite(journey.distance) ? journey.distance : 0, 0, route.totalDistance);
  const next = Math.min(route.totalDistance, previous + physicalDistance);
  journey.distance = next;
  if (!Array.isArray(journey.history)) journey.history = [];
  for (const segment of route.segments) {
    if (segment.startDistance <= next && !journey.history.includes(segment.stage)) journey.history.push(segment.stage);
  }
  if (next >= route.totalDistance && !journey.history.includes('EMBARQUE')) journey.history.push('EMBARQUE');
  return next - previous;
}
