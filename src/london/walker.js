import { AIRPORT, stairHeightAt } from './airport-geometry.js';
import { sampleJourney, journeyRoute } from './journey.js';

const TAU = Math.PI * 2, CYCLE = 48, GROUND = 958;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const mod = (value, size) => ((value % size) + size) % size;
const unit = (x, y, fallback = { x: 1, y: 0 }) => {
  const length = Math.hypot(x, y);
  return length > .00001 ? { x: x / length, y: y / length } : fallback;
};

// Moving geometry uses floating positions. Small stepped silhouettes retain the
// scene's grain without quantising a joint or the passenger's world position.
function shape(c, color, points, outline) {
  c.beginPath(); points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath(); c.fillStyle = color; c.fill();
  if (outline) { c.strokeStyle = outline; c.lineWidth = .8; c.lineJoin = 'round'; c.stroke(); }
}
function stroke(c, color, width, points) {
  c.beginPath(); points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function block(c, color, x, y, width, height) {
  c.fillStyle = color; c.fillRect(x, y, width, height);
}
function oval(c, color, x, y, rx, ry) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
}

function routeGeometry(state) {
  if (!state.journey?.active) return null;
  const route = journeyRoute(state.journey);
  const first = route.segments[0];
  const entryHeading = first?.orientation === 'side'
    ? unit(first.to.x - first.from.x, first.to.y - first.from.y)
    : { x: 1, y: 0 };
  const at = distance => distance < 0
    ? { x: state.journey.startX + distance * entryHeading.x, y: GROUND + distance * entryHeading.y, scale: 1 }
    : sampleJourney({ ...state.journey, distance: clamp(distance, 0, route.totalDistance) });
  const headingAt = distance => {
    const before = at(distance - 12), after = at(distance + 12);
    const tangent = unit(after.x - before.x, after.y - before.y, entryHeading);
    const u = clamp(distance / 14, 0, 1), turn = u * u * (3 - 2 * u);
    return unit(mix(entryHeading.x, tangent.x, turn), mix(entryHeading.y, tangent.y, turn), entryHeading);
  };
  return { route, at, headingAt, distance: state.journey.distance };
}

function fallbackHeading(state) {
  // A manual reversal can pivot through the back view over a few frames. Keep
  // the signed angle continuous; no facing threshold or mirrored sprite swap.
  if (Number.isFinite(state.poseAngle)) return { x: Math.cos(state.poseAngle), y: Math.sin(state.poseAngle) };
  const facing = state.facing < 0 ? -1 : 1;
  if (state.orientation === 'back') return { x: 0, y: -1 };
  return unit(facing, state.orientation === 'threeQuarter' ? -.42 : 0);
}

function bodyPosition(state, geometry) {
  let x = state.playerX, y = state.playerY ?? GROUND;
  if (state.climbing && geometry) {
    const stairs = geometry.route.segments.find(segment => segment.stage === 'MONTEE_ESCALIER');
    if (stairs) {
      // The pelvis transfers weight continuously over the risers; the feet use
      // the actual stepped surface below. Both ends remain exact route anchors.
      const u = clamp((geometry.distance - stairs.startDistance) / stairs.length, 0, 1);
      x = mix(AIRPORT.stairs.bottom.x, AIRPORT.stairs.top.x, u);
      y = mix(AIRPORT.stairs.bottom.y, AIRPORT.stairs.top.y, u);
    }
  } else if (state.climbing) {
    const u = clamp((AIRPORT.stairs.bottom.x - x) / (AIRPORT.stairs.bottom.x - AIRPORT.stairs.top.x), 0, 1);
    y = mix(AIRPORT.stairs.bottom.y, AIRPORT.stairs.top.y, u);
  }
  return { x, y };
}

function footPose(state, geometry, body, heading, phase, side, blend, scale) {
  const swing = phase >= .6, u = clamp((phase - .6) / .4, 0, 1);
  // During stance, d + f is constant: df/dd = -1. The other foot has the same
  // identity with its half-cycle offset. Swing matches the planted velocity at
  // both ends, rather than snapping into and out of contact.
  const f = swing ? -14.4 - 19.2 * u + 144 * u * u - 96 * u * u * u : 14.4 - CYCLE * phase;
  const sample = distance => {
    if (geometry) {
      const position = geometry.at(distance), tangent = geometry.headingAt(distance);
      return {
        x: position.x - tangent.y * side * 2.3 * position.scale,
        y: position.y + tangent.x * side * 2.3 * position.scale,
        scale: position.scale,
        heading: tangent,
      };
    }
    return {
      x: state.playerX + distance * heading.x * scale - heading.y * side * 2.3 * scale,
      y: (state.playerY ?? GROUND) + distance * heading.y * scale + heading.x * side * 2.3 * scale,
      scale,
      heading,
    };
  };
  const travelDistance = geometry ? geometry.distance + f : f;
  const restDistance = geometry ? geometry.distance + side * 3.6 : side * 3.6;
  const contact = sample(travelDistance), rest = sample(restDistance);
  if (state.climbing) {
    contact.y = stairHeightAt(contact.x);
    rest.y = stairHeightAt(rest.x);
  }
  const speed = clamp(state.speed ?? state.gaitSpeed ?? 1, .25, 3);
  const lift = swing ? Math.sin(Math.PI * u) ** 2 * mix(7.2, 9.2, clamp((speed - 1) / 2, 0, 1)) : 0;
  return {
    x: (mix(rest.x, contact.x, blend) - body.x) / scale,
    y: (mix(rest.y, contact.y, blend) - body.y) / scale - lift * blend,
    heading: contact.heading,
    shoeScale: mix(rest.scale, contact.scale, blend) / scale,
    planted: !swing,
  };
}

function drawLeg(c, hip, foot, heading, front, blend) {
  const shoeScale = foot.shoeScale ?? 1;
  const ankle = { x: foot.x, y: foot.y - 2.8 * shoeScale };
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y, distance = Math.hypot(dx, dy);
  // A relaxed standing leg reads almost straight in projection. Full knee
  // flexion belongs to the walking cycle, not to a short resting ankle span.
  const bend = Math.sqrt(Math.max(0, 15.5 ** 2 - distance ** 2 / 4)) * mix(.14, 1, blend);
  const profile = clamp(heading.x / .6, -1, 1);
  const knee = {
    x: (hip.x + ankle.x) / 2 + dy / Math.max(distance, .01) * bend * profile,
    y: (hip.y + ankle.y) / 2 - dx / Math.max(distance, .01) * bend * profile,
  };
  const points = [[hip.x, hip.y], [knee.x, knee.y], [ankle.x, ankle.y]];
  stroke(c, '#202c43', 7, points);
  stroke(c, front ? '#455873' : '#303f59', 5.2, points);
  stroke(c, front ? '#738291' : '#4b5c75', 1.1, [[knee.x + .8, knee.y + .4], [ankle.x + .7, ankle.y - .7]]);
  const toe = foot.heading.x * 3.6 * shoeScale, width = (3.5 + Math.abs(foot.heading.x) * 1.3) * shoeScale;
  shape(c, front ? '#263348' : '#202b3e', [
    [foot.x - width, foot.y - 3.1 * shoeScale], [foot.x + width * .55, foot.y - 3.2 * shoeScale],
    [foot.x + width + toe, foot.y - 1.6 * shoeScale], [foot.x + width + toe, foot.y],
    [foot.x - width, foot.y],
  ]);
  // Every shoe dimension belongs to the planted contact's perspective scale.
  stroke(c, '#9ca8ac', .9 * shoeScale, [[foot.x - width + .3 * shoeScale, foot.y], [foot.x + width + toe - .5 * shoeScale, foot.y]]);
}

function drawArm(c, x, y, sweep, heading, front, blend) {
  const handX = x + heading.x * sweep, handY = y + 17 + heading.y * sweep * .22;
  const elbowX = mix(x, handX, .6) + heading.x * 1.9 * blend;
  const elbowY = y + 9.8 - Math.abs(sweep) * .09;
  stroke(c, '#1b3346', front ? 6.3 : 5.5, [[x, y], [elbowX, elbowY], [handX, handY]]);
  stroke(c, front ? '#426c71' : '#2b4f60', front ? 4.4 : 3.8, [[x, y], [elbowX, elbowY], [handX, handY - 1.7]]);
  stroke(c, '#c99878', 3.8, [[handX, handY - .9], [handX + heading.x * .7, handY + 1.6]]);
  if (front) stroke(c, '#75908a', 1, [[x - 1, y + 1], [elbowX - .8, elbowY]]);
}

function drawPack(c, x, y, width, bob) {
  const left = x - width / 2;
  shape(c, '#8d6148', [[left - 1, y + 3], [left + 2, y], [left + width - 1, y], [left + width + 1, y + 4], [left + width, y + 18], [left, y + 18]], '#614b43');
  shape(c, '#bd9164', [[left + 1, y + 1], [left + width - 2, y + 1], [left + width - 1, y + 15], [left + 1, y + 15]]);
  shape(c, '#d4af7d', [[left + 1, y + 2], [left + width - 2, y + 2], [left + width - 3, y + 6 + bob], [left + 2, y + 6 + bob]]);
  stroke(c, '#735440', 1.1, [[left + width * .3, y + 3], [left + width * .3, y + 15]]);
  stroke(c, '#735440', 1.1, [[left + width * .76, y + 3], [left + width * .76, y + 15]]);
  block(c, '#e3c28a', left + width * .3 - .8, y + 8, 1.7, 2);
  block(c, '#e3c28a', left + width * .76 - .8, y + 8, 1.7, 2);
}

/** Draw a passenger around an exact world anchor; main owns the door clipping. */
export function drawWalker(c, state) {
  const scale = Math.max(.01, state.scale ?? 1), geometry = routeGeometry(state);
  const body = bodyPosition(state, geometry);
  const heading = geometry ? geometry.headingAt(geometry.distance) : fallbackHeading(state);
  const blend = clamp(state.motionBlend ?? (state.moving === false ? 0 : 1), 0, 1);
  const phase = mod(state.gaitDistance ?? state.distance ?? 0, CYCLE) / CYCLE, angle = phase * TAU;
  const time = state.time ?? 0, away = clamp(-heading.y * 1.8, 0, 1), depth = clamp(Math.abs(heading.y) * 1.7, 0, 1);
  const a = footPose(state, geometry, body, heading, phase, 1, blend, scale);
  const b = footPose(state, geometry, body, heading, mod(phase + .5, 1), -1, blend, scale);
  const bob = Math.cos(angle * 2) * 1.45 * blend;
  const sway = Math.sin(angle) * .48 * blend;
  const breath = Math.sin(time * 1.7) * .17 * (1 - blend * .6);
  const hip = { x: heading.x * .7 * blend + sway, y: -29 + bob };
  const shoulders = 6.7 + depth * 2.3, chestX = hip.x + heading.x * .7 * blend;
  const chestY = -45.8 + bob * .65 + breath, headY = -61.3 + bob * .18 + breath * .4;
  const armSwing = Math.sin(angle - .32) * 6.2 * blend;
  c.save(); c.translate(body.x - (state.camera ?? 0), body.y); c.scale(scale, scale);
  oval(c, '#1d27384a', 0, 1.3, 15.5, 2.5);
  oval(c, '#24304455', hip.x, .6, 9.5, 1.5);
  // The joints sit under the coat. The far hip has the same projected depth
  // offset as its foot, so it does not begin in a permanently bent crouch.
  drawLeg(c, { x: hip.x + heading.y * 2.5, y: hip.y - 3.2 - heading.x * 2.3 }, b, heading, false, blend);
  drawArm(c, chestX - shoulders * .7, chestY + 2, -armSwing, heading, false, blend);
  drawLeg(c, { x: hip.x - heading.y * 2.5, y: hip.y - 3.2 + heading.x * 2.3 }, a, heading, true, blend);
  shape(c, '#244758', [
    [chestX - shoulders, chestY + 1], [chestX - 3, chestY - 3], [chestX + 3.5, chestY - 2.7],
    [chestX + shoulders, chestY + 1], [hip.x + 8.3, hip.y - .3], [hip.x - 8.2, hip.y],
  ], '#1a3045');
  shape(c, '#3a666d', [[chestX - shoulders + 2, chestY + 2], [chestX + shoulders - 2, chestY + 2], [hip.x + 5.7, hip.y - 3], [hip.x - 4.8, hip.y - 2.7]]);
  shape(c, '#527d7d', [[chestX - shoulders + 2, chestY + 2], [chestX - 1, chestY + 1], [hip.x - .7, hip.y - 4], [hip.x - 4.8, hip.y - 3]]);
  stroke(c, '#173749', 1.2, [[hip.x - 7, hip.y - 1], [hip.x + 7, hip.y - 1.5]]);
  stroke(c, '#92a59a', .8, [[chestX + heading.x * 3, chestY + 4], [hip.x + heading.x * 2.5, hip.y - 5]]);
  block(c, '#afb29a', hip.x + heading.x * 2 - .7, hip.y - 9, 1.4, 1.8);
  const packX = mix(-heading.x * 10, -heading.x * 2.6, away) + Math.sin(angle - .68) * .35 * blend;
  drawPack(c, packX, chestY + 1.2 + Math.sin(angle - .5) * .34 * blend, 6.2 + away * 9, .3 * Math.sin(angle - .8) * blend);
  drawArm(c, chestX + shoulders * .68, chestY + 2, armSwing, heading, true, blend);
  // The skull stays steadier than the pelvis; the face and backpack reveal the
  // changing heading continuously instead of replacing a profile with a flip.
  block(c, '#b98369', chestX - 2.6, headY + 9, 5.7, 5.5);
  shape(c, '#4b454d', [[chestX - 6.4, headY - 1], [chestX - 4.3, headY - 4], [chestX + 5, headY - 3.5], [chestX + 7, headY], [chestX + 6, headY + 9.3], [chestX - 6, headY + 9.3]]);
  const faceX = chestX + heading.x * 3.1, faceWidth = 10.3 - away * 7.3;
  c.save(); c.globalAlpha *= 1 - away;
  shape(c, '#e1b08d', [[faceX - faceWidth / 2, headY + .5], [faceX + faceWidth / 2, headY + .5], [faceX + faceWidth / 2 + heading.x * 1.1, headY + 7], [faceX + heading.x * 2.5, headY + 10], [faceX - faceWidth / 2, headY + 8.6]]);
  shape(c, '#f0c8a2', [[faceX - 1, headY + 1], [faceX + faceWidth / 2, headY + 1], [faceX + faceWidth / 2 + heading.x, headY + 6.2], [faceX, headY + 6.8]]);
  block(c, '#bf8b70', chestX - heading.x * 4.5 - 1, headY + 4, 2.4, 3.5);
  block(c, '#283643', faceX + heading.x * 3.1 - .65, headY + 3.4, 1.3, 1.5);
  block(c, '#a56e5e', faceX + heading.x * 3.5 - .8, headY + 8, 1.6, .7);
  c.restore();
  shape(c, '#a77c41', [[chestX - 7.2, headY - 2], [chestX - 5.2, headY - 6], [chestX + 4.5, headY - 6.4], [chestX + 7, headY - 2], [chestX + 7.3, headY + .6], [chestX - 7.4, headY + .6]]);
  shape(c, '#d4ad64', [[chestX - 5.8, headY - 3], [chestX - 4.2, headY - 5.4], [chestX + 3.7, headY - 5.5], [chestX + 5.7, headY - 2.5]]);
  block(c, '#775d42', chestX - 7.2, headY - .6, 14.7, 1.8);
  shape(c, '#e6c782', [[chestX - 9.3, headY + 1], [chestX + 8.7 + heading.x * 2, headY + .7], [chestX + 9 + heading.x * 2, headY + 2.1], [chestX - 9.1, headY + 2.5]]);
  c.restore();
}
