// Shared world geometry: the drawing and the passenger route use these anchors.
const point = (x, y) => Object.freeze({ x, y });
const bridge = Object.freeze({
  nearLeft: point(4500, 937), nearRight: point(4790, 937),
  farLeft: point(5340, 676), farRight: point(5407, 676),
  pierFractions: Object.freeze([.27, .57, .82]),
});
const door = Object.freeze({ x: 4855, y: 619, width: 18, height: 32, thresholdY: 650 });
const route = Object.freeze({
  approach: point(4645, 958),
  bridgeStart: point(4645, 937),
  bridgeEnd: point(5373.5, 676),
  apronTurn: point(5280, 676),
  stairBottom: point(4998, 676),
  doorThreshold: point(4867, 650),
  insideDoor: point(4848, 650),
});
const stairSteps = 10;
const tread = (route.stairBottom.x - route.doorThreshold.x) / stairSteps;
const rise = (route.stairBottom.y - route.doorThreshold.y) / stairSteps;
const stairPath = [route.stairBottom];
for (let i = 0; i < stairSteps; i++) {
  const x = route.stairBottom.x - (i + 1) * tread;
  stairPath.push(point(x, route.stairBottom.y - i * rise));
  stairPath.push(i === stairSteps - 1 ? route.doorThreshold : point(x, route.stairBottom.y - (i + 1) * rise));
}
Object.freeze(stairPath);
export const AIRPORT = Object.freeze({
  bridge, route,
  apron: Object.freeze({ x: 4107, y: 662, width: 1900, depth: 22 }),
  plane: Object.freeze({ x: 4630, y: 624, door }),
  doorRect: door,
  stairs: Object.freeze({ bottom: route.stairBottom, top: route.doorThreshold, width: 20, steps: stairSteps, tread, rise, path: stairPath }),
});

export function bridgePoint(fraction, across = .5) {
  const { nearLeft: a, nearRight: b, farLeft: c, farRight: d } = AIRPORT.bridge;
  const left = { x: a.x + (c.x - a.x) * fraction, y: a.y + (c.y - a.y) * fraction };
  const right = { x: b.x + (d.x - b.x) * fraction, y: b.y + (d.y - b.y) * fraction };
  return { x: left.x + (right.x - left.x) * across, y: left.y + (right.y - left.y) * across };
}

/** Interpolate distance along the actual treads and risers, never the ramp chord. */
export function stairPoint(fraction) {
  const path = AIRPORT.stairs.path;
  const total = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
  let remaining = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length || i === path.length - 1) {
      const u = length ? Math.max(0, Math.min(1, remaining / length)) : 1;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    remaining -= length;
  }
  return { ...AIRPORT.stairs.top };
}

/** The next upper tread owns its exact riser boundary; useful for planted feet. */
export function stairHeightAt(worldX) {
  const { bottom, steps, tread, rise } = AIRPORT.stairs;
  const x = Number.isFinite(worldX) ? worldX : bottom.x;
  const step = Math.max(0, Math.min(steps, Math.floor((bottom.x - x) / tread + 1e-9)));
  return bottom.y - step * rise;
}
