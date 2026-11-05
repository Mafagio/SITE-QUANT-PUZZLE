import { canvas, rect, line, poly } from './drawing.js';

const WIDTH = 1536;
const BASE = 936;
const IRON = '#303c49', IRON_LIGHT = '#6b7370', IRON_DARK = '#27333f';

// Furniture occupies the back of the promenade. The walker has a separate
// clear strip at y958, and the bridge / airport approach stays completely open.
const LAYOUT = Object.freeze([
  { kind: 'lamp', x: 82 }, { kind: 'bench', x: 156 }, { kind: 'planter', x: 244 },
  { kind: 'standard', x: 1006 }, { kind: 'bench', x: 1080 },
  { kind: 'bicycle', x: 1154 }, { kind: 'lamp', x: 1220 },
  { kind: 'lamp', x: 2228 }, { kind: 'bench', x: 2300 }, { kind: 'planter', x: 2386 },
  { kind: 'standard', x: 3266 }, { kind: 'bench', x: 3338 },
  { kind: 'bin', x: 3414 }, { kind: 'lamp', x: 3454 },
  { kind: 'lamp', x: 4074 }, { kind: 'bench', x: 4146 }, { kind: 'bicycle', x: 4226 },
]);

function ground(c, x, y, width) {
  // Short contact marks belong to each physical object, never to the camera.
  poly(c, '#51495838', [[x-width*.45,y-1],[x+width*.36,y-1],[x+width*.65,y+1],[x-width*.31,y+1]]);
}

function bench() {
  const sprite = canvas(94, 47), c = sprite.getContext('2d');
  ground(c, 47, 44, 78);
  // Cast iron ends sit behind the slatted back; the seat has a lit top plane.
  for (const x of [16, 77]) {
    line(c, IRON_DARK, x, 11, x, 36, 3);
    line(c, IRON_LIGHT, x-1, 14, x-1, 28, 1);
    poly(c, IRON, [[x-2,30],[x+3,30],[x+4,43],[x+1,43],[x,34],[x-2,42],[x-5,42]]);
    rect(c, '#263440', x-5, 42, 10, 2);
  }
  for (const y of [12, 18, 24]) {
    rect(c, '#714f49', 11, y, 71, 4);
    rect(c, '#bb8870', 11, y, 71, 1);
    rect(c, '#986e5c', 12, y+1, 68, 1);
    rect(c, '#523f42', 11, y+3, 71, 1);
    for (const x of [18, 75]) rect(c, '#d0a17d', x, y+1, 1, 1);
  }
  poly(c, '#bd8a6e', [[9,29],[80,29],[85,32],[6,32]]);
  rect(c, '#8b6254', 6, 32, 80, 4);
  rect(c, '#d2a182', 7, 31, 77, 1);
  rect(c, '#5c4545', 7, 35, 77, 1);
  for (const x of [12, 80]) {
    // Small open armrests retain their negative space at the normal CSS size.
    line(c, IRON, x, 31, x, 24, 2);
    line(c, IRON, x, 24, x+4, 22, 2);
    line(c, IRON_LIGHT, x, 23, x+3, 23, 1);
  }
  return { sprite, ox: 47, oy: 44 };
}

function lamp() {
  const sprite = canvas(44, 123), c = sprite.getContext('2d');
  ground(c, 22, 120, 26);
  rect(c, IRON_DARK, 15, 116, 15, 4);
  rect(c, IRON, 17, 112, 11, 4);
  poly(c, IRON, [[18,112],[20,102],[24,102],[26,112]]);
  rect(c, '#8d8a76', 19, 111, 2, 5);
  rect(c, IRON, 20, 37, 4, 67);
  rect(c, '#7e8275', 20, 39, 1, 64);
  for (const y of [52, 93]) {
    rect(c, IRON_DARK, 18, y, 8, 3);
    rect(c, '#8b8775', 19, y, 6, 1);
  }
  // Bounded pixel glow remains local to the glass rather than washing the water.
  rect(c, '#ffd99a08', 9, 11, 27, 27);
  rect(c, '#ffd99a0b', 13, 14, 19, 21);
  poly(c, IRON_DARK, [[15,16],[29,16],[27,33],[17,33]]);
  poly(c, '#d99a60', [[17,18],[27,18],[25,30],[19,30]]);
  poly(c, '#f1c387', [[18,18],[23,18],[23,30],[20,30]]);
  rect(c, '#fff1bd', 19, 19, 2, 8);
  line(c, IRON, 22, 17, 22, 31, 1);
  rect(c, IRON, 16, 32, 12, 3);
  rect(c, '#8b8170', 18, 32, 8, 1);
  poly(c, IRON, [[13,16],[18,10],[26,10],[31,16]]);
  line(c, '#9c967d', 15, 15, 27, 15, 1);
  rect(c, IRON_DARK, 20, 7, 4, 3);
  rect(c, '#bda777', 21, 5, 2, 2);
  // A pair of quiet brackets gives the post a recognisable Victorian profile.
  line(c, IRON, 16, 36, 12, 38, 1);
  line(c, IRON, 12, 38, 16, 41, 1);
  line(c, IRON, 16, 41, 20, 38, 1);
  line(c, IRON, 27, 36, 31, 38, 1);
  line(c, IRON, 31, 38, 27, 41, 1);
  line(c, IRON, 27, 41, 23, 38, 1);
  return { sprite, ox: 22, oy: 120 };
}

function wheel(c, x, y) {
  const pts = [[-4,-11],[4,-11],[9,-7],[11,-3],[11,4],[7,9],[3,11],[-4,11],[-9,7],[-11,3],[-11,-4],[-7,-9]];
  for (let i=0;i<pts.length;i++) {
    const a=pts[i], b=pts[(i+1)%pts.length];
    line(c, IRON_DARK, x+a[0], y+a[1], x+b[0], y+b[1], 2);
  }
  for (const [dx,dy] of [[-7,-7],[7,-7],[-7,7],[7,7],[0,-9],[0,9]]) line(c, '#8c8886', x, y, x+dx, y+dy, 1);
  rect(c, '#c5ad93', x, y, 2, 2);
}

function bicycle() {
  const sprite=canvas(70,45), c=sprite.getContext('2d');
  ground(c, 35, 42, 62);
  wheel(c, 16, 30); wheel(c, 54, 30);
  const frame='#a05f58', light='#d2997a';
  for(const [x,y,xx,yy] of [[16,30,29,30],[16,30,25,14],[25,14,29,30],[25,14,44,14],[44,14,29,30],[44,14,54,30]]) line(c, frame, x,y,xx,yy,2);
  line(c, light, 25,13,43,13,1);
  line(c, '#494a52', 44,14,42,8,2);
  line(c, IRON_DARK, 41,7,48,7,2);
  line(c, IRON_DARK, 48,7,49,10,2);
  line(c, '#766d68', 25,14,24,10,2);
  rect(c, '#373b46', 19,9,11,3);
  line(c, '#beb2a0', 29,30,34,33,1);
  rect(c, IRON_DARK, 33,33,5,2);
  line(c, '#514b4e', 34,31,37,41,1);
  // A shallow front basket and rack make it a parked everyday bicycle.
  poly(c, '#686965', [[46,11],[62,11],[60,19],[48,19]], '#3d4951', 1);
  for(const x of [50,54,58]) line(c, '#9d9784', x,12,x,17,1);
  line(c, '#b1a38c', 46,11,62,11,1);
  line(c, '#5c6567', 5,17,19,17,1);
  line(c, '#5c6567', 5,17,10,24,1);
  return {sprite,ox:35,oy:42};
}

function planter() {
  const sprite=canvas(48,47), c=sprite.getContext('2d');
  ground(c,24,44,39);
  poly(c, '#684b4b', [[7,29],[41,29],[37,43],[11,43]]);
  poly(c, '#a5715a', [[8,30],[24,30],[24,42],[12,42]]);
  rect(c, '#bd8e6c', 5,27,38,4);
  rect(c, '#5a4949', 7,31,34,1);
  rect(c, '#c2a17b', 7,27,33,1);
  // Clustered leaf planes with a small spill, not an even field of noisy dots.
  for(const [x,y,w,h,col] of [[10,18,13,11,'#3c5946'],[21,12,12,16,'#3e6448'],[29,17,12,11,'#496f49'],[8,23,11,10,'#527746'],[17,17,10,8,'#78904b'],[24,22,12,8,'#577646'],[15,14,10,5,'#94a058'],[28,15,9,5,'#8d9b55'],[4,25,9,6,'#547447']]) {
    poly(c,col,[[x+3,y],[x+w-3,y],[x+w,y+3],[x+w-2,y+h],[x+2,y+h],[x,y+4]]);
  }
  for(const [x,y] of [[12,18],[30,21],[21,24]]) {
    rect(c,'#b77972',x,y,4,3); rect(c,'#dfb07f',x+1,y,2,1);
  }
  return {sprite,ox:24,oy:44};
}

function bin() {
  const sprite=canvas(31,45), c=sprite.getContext('2d');
  ground(c,15,42,23);
  poly(c,'#283f40',[[5,11],[25,11],[24,39],[21,42],[8,42],[6,39]]);
  rect(c,'#587064',7,13,3,26);
  rect(c,'#36544b',11,13,11,26);
  for(const x of [12,17,22]) rect(c,'#233c3d',x,18,1,21);
  rect(c,'#172e37',8,13,14,5);
  rect(c,'#718272',8,12,14,1);
  poly(c,'#3c514b',[[4,10],[7,7],[22,7],[26,10],[26,12],[4,12]]);
  rect(c,'#aaa186',7,8,15,1);
  rect(c,'#bfaa7d',12,23,6,6);
  rect(c,'#675f53',14,24,2,3);
  return {sprite,ox:15,oy:42};
}

function standard() {
  const sprite=canvas(20,91), c=sprite.getContext('2d');
  ground(c,9,88,17);
  rect(c,IRON_DARK,4,85,11,3);
  rect(c,IRON,6,81,7,4);
  rect(c,'#777e77',8,6,3,76);
  rect(c,'#c8b796',8,6,1,75);
  rect(c,'#d5b77c',8,3,3,3);
  rect(c,IRON,9,0,1,3);
  return {sprite,ox:9,oy:88};
}

function unionJack() {
  const sprite=canvas(26,16), c=sprite.getContext('2d');
  for(let x=0;x<sprite.width;x++) for(let y=0;y<sprite.height;y++) {
    const u=x/(sprite.width-1), v=y/(sprite.height-1);
    const diagonal=Math.min(Math.abs(v-u),Math.abs(v-(1-u)));
    let col='#354a68';
    if(diagonal<.14) col='#e5cfb6';
    if(diagonal<.046) col='#b85963';
    if(Math.abs(u-.5)<.14 || Math.abs(v-.5)<.18) col='#eddbc1';
    if(Math.abs(u-.5)<.055 || Math.abs(v-.5)<.075) col='#bd6268';
    rect(c,col,x,y,1,1);
  }
  return sprite;
}

export function makeRiversideLife() {
  const furniture={bench:bench(),lamp:lamp(),bicycle:bicycle(),planter:planter(),bin:bin(),standard:standard()};
  const flag=unionJack();
  return { furniture, flag, sprites:[...Object.values(furniture).map(item=>item.sprite),flag], layout:LAYOUT };
}

export function drawRiversideLife(c, assets, camera, time) {
  // One world-to-view projection keeps furniture and contact shadows together.
  for(const item of assets.layout) {
    const x=item.x-camera;
    if(x < -100 || x > WIDTH+100) continue;
    const part=assets.furniture[item.kind];
    c.drawImage(part.sprite, x-part.ox, BASE-part.oy);
    if(item.kind !== 'standard') continue;
    const flagX=x+2, flagY=BASE-part.oy+8;
    for(let col=0;col<assets.flag.width;col++) {
      const along=col/(assets.flag.width-1);
      const dy=Math.sin(time*2.4-col*.31+item.x*.002)*1.65*along;
      // The hoist is fixed to the pole. Only the free cloth edge can flutter.
      c.drawImage(assets.flag,col,0,1,assets.flag.height,flagX+col,flagY+dy,1,assets.flag.height);
    }
  }
}
