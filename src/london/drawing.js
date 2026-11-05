// Small Canvas primitives. Every texture is generated from geometry, never a PNG.
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const mod = (n, d) => ((n % d) + d) % d;
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}
export function rect(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
export function line(c, color, x, y, xx, yy, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'butt';
  c.beginPath(); c.moveTo(Math.round(x) + .5, Math.round(y) + .5);
  c.lineTo(Math.round(xx) + .5, Math.round(yy) + .5); c.stroke();
}
export function poly(c, color, pts, stroke, width = 1) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
  c.closePath(); c.fillStyle = color; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'miter'; c.stroke(); }
}
export function ellipse(c, color, x, y, rx, ry) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
export function arch(c, x, y, w, h, { fill = '#ffca63', stroke = '#6b3851', lineWidth = 2, pointed = false } = {}) {
  const shoulder = y + (pointed ? w * .65 : w * .5);
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, shoulder);
  if (pointed) { c.quadraticCurveTo(x, y + w * .25, x + w / 2, y); c.quadraticCurveTo(x + w, y + w * .25, x + w, shoulder); }
  else c.arc(x + w / 2, shoulder, w / 2, Math.PI, 0);
  c.lineTo(x + w, y + h); c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
}
export function brickwork(c, { x, y, w, h, seed = 1, colors = ['#c17967', '#b36760', '#d18a70'], brickW = 12, brickH = 6 }) {
  const r = rng(seed);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let row = 0; row < h / brickH; row++) {
    for (let col = -1; col < w / brickW; col++) {
      const xx = x + col * brickW + (row % 2) * brickW / 2, yy = y + row * brickH;
      rect(c, colors[Math.floor(r() * colors.length)], xx, yy, brickW - 1, brickH - 1);
      if (r() > .72) rect(c, '#efac7e55', xx + 2, yy, brickW - 4, 1);
    }
  }
  c.restore();
}
export function mix(a, b, t) {
  const aa = parseInt(a.slice(1), 16), bb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((aa >> s) & 255) * (1 - t) + ((bb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
