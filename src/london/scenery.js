import { canvas, rng, rect, line, poly, ellipse, mix, mod, clamp } from './drawing.js';

export const VIEW = Object.freeze({ width: 1536, height: 1024, worldWidth: 6144, water: 704, promenade: 912, ground: 958, tile: 768 });
const CLOUD = ['#9170ad', '#bd78b0', '#e58bb2', '#ffa58f', '#ffcf7b'];

// A stepped circular mass; the small strata are facets of a volume, not noise.
function lobe(c, x, y, rx, ry, seed, palette = CLOUD) {
  const r = rng(seed), step = 3;
  for (let dy = -ry; dy < ry; dy += step) {
    const reach = Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * rx;
    const edge = Math.floor(reach / step) * step;
    const shade = dy < -ry * .54 ? 4 : dy < -ry * .18 ? 3 : dy < ry * .36 ? 2 : dy < ry * .7 ? 1 : 0;
    rect(c, palette[shade], x - edge, y + dy, edge * 2, step);
    if (dy < ry * .25 && edge > 5) rect(c, palette[Math.min(4, shade + 1)], x - edge, y + dy, 3 + Math.floor(r() * 2) * 3, step);
  }
}

// Volumes are generated once on a fine lattice. Lighting follows the curved
// masses; neither the silhouette nor its pixels are resampled from reference art.
function cloud(seed, w, h, kind) {
  const result = canvas(w, h), g = result.getContext('2d'), r = rng(seed);
  const families = [
    [[.14,.68,.17,.19],[.32,.46,.22,.34],[.45,.55,.2,.28],[.62,.64,.22,.2],[.81,.74,.17,.11]],
    [[.13,.72,.15,.12],[.33,.64,.22,.19],[.51,.52,.18,.28],[.68,.64,.2,.19],[.83,.73,.16,.1]],
    [[.14,.69,.16,.14],[.35,.57,.23,.23],[.53,.61,.22,.18],[.75,.72,.24,.11]],
    [[.19,.74,.22,.1],[.41,.69,.25,.13],[.64,.72,.23,.11],[.84,.77,.16,.06]],
  ];
  const masses = families[kind % 4].map(([x,y,rx,ry],i) => ({
    x:(x+(r()-.5)*.035)*w,y:(y+(r()-.5)*.05)*h,
    rx:rx*w*(.92+r()*.16),ry:ry*h*(.9+r()*.2),z:i*.02,
  }));
  const palette=['#a675ad','#bf7fb1','#dc91b4','#ef9faf','#ffb797','#ffd093'];
  for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){
    let front=null,z=-1;
    for(const m of masses){
      const nx=(x-m.x)/m.rx,ny=(y-m.y)/m.ry;
      const edge=.025*Math.sin(x*.14+seed)+.02*Math.sin(y*.19+x*.07);
      const q=nx*nx+ny*ny;
      if(q>1+edge)continue;
      // Each cap keeps its own outline and a nearly horizontal underbelly.
      // Selecting the front mass by a shallow depth avoids concentric stripes.
      const zz=Math.sqrt(Math.max(0,1-q))*.3+m.z;
      if(zz>z){z=zz;front={nx,ny};}
    }
    if(!front)continue;
    const cap=front.ny+front.nx*.07+Math.sin(x*.048+seed)*.07;
    let shade=cap<-.65?5:cap<-.28?4:cap<.22?3:cap<.57?2:1;
    if(y>h*.77)shade=Math.min(shade,1);
    rect(g,palette[shade],x,y,3,3);
  }
  // Thin irregular tails stay attached to each bank, not long isolated sky bars.
  for(let i=0;i<5;i++){
    const x=w*(.68+i*.045),y=h*(.78+(i%3)*.02);
    rect(g,['#d68bb4','#e9a2b6','#ffc098'][i%3],x,y,8+r()*16,2);
  }
  return result;
}

export function makeSky() {
  const c = canvas(VIEW.width, VIEW.water), g = c.getContext('2d');
  const stops = [[0, '#8268c1'], [.21, '#a979c6'], [.4, '#db80b6'], [.53, '#f795a3'], [.63, '#ffb776'], [.76, '#ee94af'], [1, '#ba84aa']];
  for (let y = 0; y < VIEW.water; y += 2) {
    const t = y / VIEW.water;
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    rect(g, mix(stops[i][1], stops[i + 1][1], (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])), 0, y, VIEW.width, 2);
  }
  // Quiet air remains between authored formations. A local warm horizon, not a filter.
  const glow = g.createRadialGradient(450, 350, 5, 450, 350, 330);
  glow.addColorStop(0, '#ffd17a66'); glow.addColorStop(.42, '#ffc78833'); glow.addColorStop(1, '#ffbc8300');
  g.fillStyle = glow; g.fillRect(0, 120, 900, 470);
  return c;
}

const CLOUD_LAYOUT = [
  [5, 3, 210, 78, 12, .54], [215, 22, 365, 155, 21, 1],
  [592, 120, 337, 98, 45, .78], [1100, 5, 320, 88, 29, .48],
  [1215, 81, 430, 181, 62, .94], [-85, 129, 320, 137, 13, .9],
  [180, 240, 310, 68, 53, .57], [785, 233, 385, 88, 84, .54],
];
export function makeClouds() {
  return CLOUD_LAYOUT.map(([x, y, w, h, seed, opacity], kind) => ({ x, y, opacity, sprite: cloud(seed, w, h, kind), depth: .027 + kind % 3 * .007 }));
}
export function drawSky(c, sky, clouds, camera, time) {
  c.drawImage(sky, 0, 0);
  const sx = 450 - camera * .024;
  c.save();c.translate(sx,337);
  lobe(c,0,0,38,38,98,['#fff0a3','#fff0a3','#fff2a6','#fff1a6','#fff3aa']);
  rect(c,'#ffc98d',-44,18,91,3);rect(c,'#ffc98d',-32,30,80,3);c.restore();
  for (const bank of clouds) {
    const drift = mod(time * (.48 + bank.depth * 12) + bank.x + 500, 2200) - 500;
    c.globalAlpha = bank.opacity;
    c.drawImage(bank.sprite, drift - camera * bank.depth, bank.y);
  }
  c.globalAlpha = 1;
  // Birds share simulation time; the architecture stays perfectly rigid.
  for (let i = 0; i < 5; i++) {
    const x = mod(900 + i * 117 + time * (8 + i), 1920) - 160 - camera * .04;
    const y = 210 + i * 19 + Math.sin(time * .3 + i) * 12;
    const beat=Math.sin(time*(3.1+i*.21)+i*2.2);
    const glide=(Math.sin(time*.39+i*1.7)+1)*.5;
    const wing=beat*(.8+glide*2.2);
    c.save();c.translate(x,y);c.beginPath();
    c.moveTo(-5,-1+wing);c.lineTo(0,1);c.lineTo(5,-1+wing);
    c.strokeStyle='#705a96';c.lineWidth=1.6;c.stroke();c.restore();
  }
}

export { makeDistantCity } from './urban-depth.js';

export function drawQuay(c, from, to) {
  rect(c, '#494963', from, 662, to - from, 42);
  // A lit coping has a top plane, a cooler vertical return, then its own
  // contact shadow. All of these belong to the cached world-space masonry.
  rect(c, '#f1c7a4', from, 661, to - from, 2);
  rect(c, '#c9a89e', from, 663, to - from, 3);
  rect(c, '#a08794', from, 666, to - from, 7);
  rect(c, '#64576e', from, 673, to - from, 3);
  for (let row = 0; row < 3; row++) for (let x = Math.floor(from / 38) * 38 - 38; x < to; x += 38) {
    const xx = x + (row % 2) * 19, y = 677 + row * 9;
    rect(c, ['#958399', '#a18b9c', '#8c7c93'][(Math.abs(Math.floor(x / 38)) + row) % 3], xx, y, 35, 7);
    rect(c, row === 2 ? '#9a899c' : '#c1a2ae', xx + 2, y, 30, 1);
    rect(c, '#74657f', xx + 32, y + 2, 3, 5);
  }
  for (let x = Math.floor(from / 198) * 198; x < to; x += 198) {
    rect(c, '#42425c55', x + 11, 670, 5, 32);
    rect(c, '#5e536c', x, 667, 12, 37);
    rect(c, '#c6a9a5', x + 2, 668, 6, 32);
    rect(c, '#e1bdab', x + 2, 668, 1, 31);
    rect(c, '#8b788e', x + 8, 669, 3, 32);
    rect(c, '#e5c0a6', x - 2, 662, 16, 3);
    rect(c, '#b6999c', x - 2, 665, 16, 2);
  }
  // A darker, damp foot gives the wall weight at the waterline.
  rect(c, '#4d526f', from, 699, to - from, 3);
  rect(c, '#303d5c', from, 702, to - from, 2);
}

export { makeTrees, drawTrees } from './foliage.js';

export function makePromenade() {
  const c = canvas(768, 112), g = c.getContext('2d'), r = rng(8052);
  rect(g, '#53465f', 0, 0, c.width, c.height);
  // A few deep paving rows, not a dense wire grid. Widths divide the cached tile.
  const rows = [0, 12, 31, 64], widths=[96,128,192];
  for (let row = 0; row < rows.length - 1; row++) {
    const y = rows[row], h = rows[row + 1] - y, w = widths[row];
    for (let x = -w; x < c.width + w; x += w) {
      const xx = x + (row % 2) * w / 2;
      const inset=row*3;
      poly(g, ['#b78d8d', '#bc9390', '#aa828a', '#c29a91'][(Math.floor(r() * 4))], [[xx+inset, y], [xx + w - 3+inset, y], [xx + w - 7+inset, y + h - 2], [xx - 4+inset, y + h - 2]]);
      // Broad quiet value planes and narrow bevels give each slab thickness;
      // the joints, facets and shadows all move as one cached paving surface.
      poly(g, '#7b62762e', [[xx-1+inset,y+h*.68],[xx+w-6+inset,y+h*.68],[xx+w-7+inset,y+h-2],[xx-4+inset,y+h-2]]);
      line(g, '#e5b799', xx+inset, y + 1, xx + w - 5+inset, y + 1, 1);
      line(g,'#d3a38f',xx+inset,y+2,xx-3+inset,y+h-3,1);
      line(g,'#705d73',xx+w-4+inset,y+2,xx+w-7+inset,y+h-3,2);
      line(g,'#8d7181',xx-3+inset,y+h-3,xx+w-8+inset,y+h-3,1);
      // Mineral patches follow one slab rather than being scattered over the plane.
      poly(g,'#a87f8655',[[xx+w*.22,y+h*.36],[xx+w*.49,y+h*.24],[xx+w*.59,y+h*.5],[xx+w*.39,y+h*.64],[xx+w*.16,y+h*.53]]);
      if(row===2 && r()>.58) {
        line(g,'#96717e',xx+w*.7,y+3,xx+w*.67,y+h*.45,1);
        line(g,'#96717e',xx+w*.67,y+h*.45,xx+w*.73,y+h*.66,1);
      }
    }
  }
  rect(g, '#e5b39a', 0, 64, 768, 2);
  rect(g, '#ad8590', 0, 66, 768, 3);
  rect(g, '#876c82', 0, 69, 768, 9);
  rect(g, '#5e4b65', 0, 78, 768, 4);
  rect(g, '#493c58', 0, 82, 768, 30);
  for (let row = 0; row < 2; row++) for (let x = -30; x < 800; x += 58) {
    const xx = x + row * 29, y = 86 + row * 15;
    rect(g, '#6f536e', xx, y, 55, 12); rect(g, '#987183', xx + 3, y + 1, 48, 1);
    poly(g,'#80607a',[[xx+7,y+3],[xx+30,y+2],[xx+44,y+7],[xx+37,y+10],[xx+13,y+8]]);
  }
  return c;
}
export function drawPromenade(c, sprite, camera) {
  const x = -mod(camera, sprite.width);
  for (let i = x; i < VIEW.width; i += sprite.width) c.drawImage(sprite, i, VIEW.promenade);
}

export { drawWalker } from './walker.js';
