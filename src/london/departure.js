import { AIRPORT } from './airport-geometry.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => {
  const u = clamp(value, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// Integral of the quintic velocity blend. Its first two derivatives match
// rest before u=0 and constant velocity after u=1.
const integratedBlend = value => {
  const u = clamp(value, 0, 1);
  return u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;
};

export const DEPARTURE = Object.freeze({
  stationaryEnd: 1.2,
  rollStart: 3.2,
  rotationStart: 9,
  liftOff: 10.2,
  climbEstablished: 14.2,
  duration: 24,
  rollSpeed: 170,
  climbSpeed: 52,
  // The rear main-gear axle remains fixed on the apron during rotation.
  pivot: Object.freeze({ x: AIRPORT.plane.x + 89, y: AIRPORT.plane.y + 45 }),
});

const PHASES = Object.freeze([
  { time: 0, stage: 'STATIONNE' },
  { time: DEPARTURE.stationaryEnd, stage: 'PREPARATION' },
  { time: DEPARTURE.rollStart, stage: 'ROULAGE' },
  { time: DEPARTURE.liftOff, stage: 'DECOLLAGE' },
  { time: DEPARTURE.climbEstablished, stage: 'EN_VOL' },
]);

/** Inactive until the passenger has entered the aircraft. No wall-clock state. */
export function createDeparture({ active = false } = {}) {
  return { active: !!active, elapsed: 0, history: active ? ['STATIONNE'] : [] };
}

/** Consume simulation seconds, independently of the passenger speed setting. */
export function advanceDeparture(departure, dt) {
  if (!departure?.active || !Number.isFinite(dt) || dt <= 0) return 0;
  const before = clamp(Number.isFinite(departure.elapsed) ? departure.elapsed : 0, 0, DEPARTURE.duration);
  const sum = before + dt;
  const next = sum >= DEPARTURE.duration - 1e-9 ? DEPARTURE.duration : sum;
  departure.elapsed = next;
  if (!Array.isArray(departure.history)) departure.history = [];
  for (const phase of PHASES) {
    if (phase.time <= next && !departure.history.includes(phase.stage)) departure.history.push(phase.stage);
  }
  return next - before;
}

/** Pure drawing pose. Position, speed and acceleration remain continuous. */
export function sampleDeparture(departure) {
  const active = !!departure?.active;
  const elapsed = active ? clamp(Number.isFinite(departure.elapsed) ? departure.elapsed : 0, 0, DEPARTURE.duration) : 0;
  const rollTime = DEPARTURE.liftOff - DEPARTURE.rollStart;
  const rollU = clamp((elapsed - DEPARTURE.rollStart) / rollTime, 0, 1);
  const airborneTime = Math.max(0, elapsed - DEPARTURE.liftOff);
  const riseTime = DEPARTURE.climbEstablished - DEPARTURE.liftOff;
  const riseU = clamp(airborneTime / riseTime, 0, 1);
  const offsetX = DEPARTURE.rollSpeed * rollTime * integratedBlend(rollU)
    + DEPARTURE.rollSpeed * airborneTime;
  const offsetY = airborneTime > 0 ? -DEPARTURE.climbSpeed * riseTime * integratedBlend(riseU)
    - DEPARTURE.climbSpeed * Math.max(0, airborneTime - riseTime) : 0;
  const angleRadians = elapsed > DEPARTURE.rotationStart
    ? -9.5 * Math.PI / 180 * smooth((elapsed - DEPARTURE.rotationStart) / 2.6) : 0;
  const scale = 1 - .14 * smooth(airborneTime / 11);
  const gear = 1 - smooth((airborneTime - .8) / 2.7);
  const doorOpen = active ? 1 - smooth((elapsed - .2) / 1) : 1;
  const stairsOffset = active ? 90 * smooth((elapsed - 1.2) / 1.8) : 0;
  const stage = active
    ? [...PHASES].reverse().find(phase => phase.time <= elapsed).stage
    : 'STATIONNE';
  return {
    active, elapsed, stage, offsetX, offsetY, angleRadians, scale, gear,
    doorOpen, stairsOffset, progress: elapsed / DEPARTURE.duration,
    finished: active && elapsed >= DEPARTURE.duration,
    // Useful for framing and an apron shadow independent of the passenger.
    pivotX: DEPARTURE.pivot.x + offsetX,
    pivotY: DEPARTURE.pivot.y + offsetY,
    altitude: airborneTime > 0 ? -offsetY : 0,
    velocityX: elapsed <= DEPARTURE.liftOff ? DEPARTURE.rollSpeed * smooth(rollU) : DEPARTURE.rollSpeed,
    velocityY: airborneTime > 0 ? -DEPARTURE.climbSpeed * smooth(riseU) : 0,
  };
}
