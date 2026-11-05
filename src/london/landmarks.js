/* London's first composition: individual landmarks, drawn in world coordinates.
 * No source image is sampled here. All masonry, tracery and glazing is generated.
 * The renderer caches this static drawing; none of this work runs per frame.
 */
import { rect, line, poly, ellipse, rng } from './drawing.js';

const P = Object.freeze({
  ink: '#292c49', deep: '#36334f', shade: '#61506b', stone: '#d58b49',
  warm: '#ccaa7d', light: '#e6c994', edge: '#eddbb4', joint: '#a47d62',
  roof: '#263f70', roofLight: '#5278a1', blue: '#267f9d', blueLight: '#63c6cb',
  glass: '#392f63', gold: '#ffc549', white: '#fff5be',
});

// Structural courses follow the wall. Variations tint whole blocks, never noise.
function stone(c, x, y, w, h, seed = 1, dark = false) {
  c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip();
  const random = rng(seed);
  const volume = c.createLinearGradient(x, y, x + w, y + h * .08);
  volume.addColorStop(0, dark ? '#716079' : '#d6b68c');
  volume.addColorStop(.18, dark ? '#7e6576' : '#cba275');
  volume.addColorStop(.67, dark ? '#5c506e' : '#ad825f');
  volume.addColorStop(.88, dark ? '#484661' : '#8c6b5b');
  volume.addColorStop(1, dark ? '#363d5d' : '#645365');
  c.fillStyle = volume; c.fillRect(x, y, w, h);
  const bw = 13, bh = 7;
  for (let row = 0; row < h / bh; row++) {
    const yy = y + row * bh;
    c.globalAlpha = .18;
    line(c, dark ? '#353b59' : '#8c5940', x, yy, x + w, yy, 1);
    c.globalAlpha = 1;
    for (let col = -1; col < w / bw; col++) {
      const xx = x + col * bw + (row % 2) * 7;
      const left = Math.max(x, xx), right = Math.min(x + w, xx + bw);
      if (right <= left) continue;
      const tone = random();
      c.globalAlpha = .14;
      if (tone > .65) rect(c, dark ? '#8e7284' : '#efb461', left + 1, yy + 1, right - left - 2, bh - 2);
      if (tone < .2) rect(c, dark ? '#353b59' : '#956143', left + 1, yy + 1, right - left - 2, bh - 2);
      line(c, dark ? '#353b59' : '#8e5c43', xx, yy, xx, Math.min(y + h, yy + bh), 1);
      c.globalAlpha = 1;
      if (tone > .84 && right - left > 5) {
        c.globalAlpha = .28;
        line(c, dark ? '#9a7f8b' : '#efb765', left + 2, yy + 1, right - 2, yy + 1, 1);
        c.globalAlpha = 1;
      }
    }
  }
  // One lit arris, a recessed return, and an occlusion seam make a wall volume.
  line(c, dark ? '#9c7b83' : '#e0c29a', x + 1, y + 1, x + 1, y + h, 1);
  if (w > 15) {
    c.globalAlpha = .3;
    rect(c, '#303751', x + w - Math.min(5, w * .11), y + 1, Math.min(5, w * .11), h - 1);
    c.globalAlpha = 1;
  }
  c.restore();
}

function pointedPath(c, x, y, w, h) {
  const shoulder = y + Math.min(w * .8, h * .42);
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, shoulder);
  c.quadraticCurveTo(x, y + w * .28, x + w / 2, y);
  c.quadraticCurveTo(x + w, y + w * .28, x + w, shoulder);
  c.lineTo(x + w, y + h); c.closePath();
}

function gothic(c, x, y, w, h, lit = true, mullions = 1) {
  // Ocher stone belongs to the wall. Only the sun-facing arris catches a thin
  // highlight; a continuous yellow outline would flatten every recessed bay.
  const tone = (Math.round(x) * 7 + Math.round(y) * 3) % 13;
  const subdued = tone < 9, quiet = tone < 4;
  pointedPath(c, x - 4, y - 4, w + 7, h + 7); c.fillStyle = '#3e3c58'; c.fill();
  pointedPath(c, x - 2, y - 2, w + 3, h + 3); c.fillStyle = lit ? '#b58550' : '#796073'; c.fill();
  // The reveal is thick on the shadow side and bright only on the projecting lip.
  pointedPath(c, x, y, w, h + 1); c.fillStyle = '#493d53'; c.fill();
  pointedPath(c, x + 1, y + 1, w - 2, h - 1); c.fillStyle = lit ? P.gold : P.glass; c.fill();
  if (lit) {
    c.save(); pointedPath(c, x + 1, y + 1, w - 2, h - 1); c.clip();
    const glass = c.createLinearGradient(x, y, x, y + h);
    glass.addColorStop(0, quiet ? '#86718b' : subdued ? '#d99d52' : '#ffe294');
    glass.addColorStop(.48, quiet ? '#756075' : subdued ? '#c48239' : '#ffc34b');
    glass.addColorStop(1, quiet ? '#51455f' : subdued ? '#795038' : '#cb762c');
    c.fillStyle = glass; c.fillRect(x + 1, y + 1, w - 2, h - 1);
    rect(c, quiet ? '#3c3e5b' : '#71402e', x + 1, y + 2, 3, h);
    rect(c, quiet ? '#a38a92' : subdued ? '#e4ac62' : '#ffedb2', x + w * .4, y + 5, Math.max(1, w * .1), Math.max(5, h * .48));
    if (!quiet) rect(c, subdued ? '#dda54e' : '#ffcf62', x + w * .65, y + 7, Math.max(1, w * .12), h - 9);
    c.restore();
    const shoulder = y + Math.min(w * .8, h * .42);
    c.beginPath(); c.moveTo(x - 1, y + h - 1); c.lineTo(x - 1, shoulder);
    c.quadraticCurveTo(x - 1, y + w * .28 - 2, x + w / 2, y - 2);
    c.strokeStyle = quiet ? '#b08a54' : subdued ? '#c89a58' : '#e6bd74';
    c.lineWidth = 1; c.stroke();
  } else {
    line(c, '#747590', x + 3, y + w * .65, x + 3, y + h - 2, 1);
    rect(c, '#232e4c', x + w - 4, y + w * .65, 3, h - w * .65);
  }
  for (let n = 1; n <= mullions; n++) {
    const xx = x + n * w / (mullions + 1);
    line(c, lit ? '#925633' : '#5f4b63', xx, y + w * .5, xx, y + h, 2);
  }
  if (h > 30) line(c, lit ? '#925633' : '#5f4b63', x + 1, y + h * .58, x + w - 1, y + h * .58, 2);
  if (w >= 14 && h > 27) {
    const cy = y + w * .38;
    poly(c, P.shade, [[x + w / 2,cy - 2],[x + w / 2 + 3,cy + 2],[x + w / 2,cy + 6],[x + w / 2 - 3,cy + 2]]);
    rect(c, lit ? '#c99851' : '#8a6550', x + w / 2 - 1, cy + 1, 2, 2);
  }
  rect(c, P.deep, x - 3, y + h, w + 6, 3);
  rect(c, lit ? '#bd8d4b' : '#89634d', x - 3, y + h - 1, w + 6, 1);
}

function cornice(c, x, y, w, large = false) {
  // Broad cast shadow below a projecting, bevelled stone slab.
  rect(c, '#383b59', x + 1, y + 3, w + 4, large ? 10 : 6);
  rect(c, '#765369', x - 2, y, w + 4, large ? 7 : 4);
  poly(c, '#ad8c6e', [[x - 4,y - 3],[x + w + 2,y - 3],[x + w + 5,y],[x - 2,y + 2]]);
  line(c, '#dec3a0', x - 4, y - 3, x + w * .72, y - 3, 1);
  line(c, '#6c5063', x + w * .72, y - 3, x + w + 4, y, 2);
  if (large) for (let xx = x + 3; xx < x + w - 1; xx += 9) {
    rect(c, '#664b59', xx + 1, y + 2, 4, 5);
    rect(c, '#b99b79', xx, y + 1, 3, 3);
  }
}

function finial(c, x, y, height = 22, color = P.light) {
  line(c, P.ink, x, y - height, x, y + 3, 3);
  line(c, color, x, y - height + 2, x, y + 1, 1);
  poly(c, color, [[x - 3, y - height + 7], [x, y - height + 2], [x + 3, y - height + 7], [x, y - height + 11]], P.deep);
}

function pinnacle(c, x, y, height = 53, width = 10, baseY = y + height) {
  const shoulder = y + height * .42;
  // A turret is a masonry shaft with a cap, not an isolated roof decoration.
  // Its explicit foot overlaps the roof/parapet which actually carries it.
  stone(c, x - width / 2, shoulder, width, baseY - shoulder, (x + y) | 0);
  rect(c,'#54485e',x+width*.2,shoulder+1,width*.3,baseY-shoulder-1);
  poly(c, P.roof, [[x - width * .62, y + height * .43], [x, y], [x + width * .62, y + height * .43]], P.ink, 2);
  line(c, P.light, x - width * .5, y + height * .41, x, y + 4, 1);
  cornice(c, x - width / 2, y + height * .43, width);
  finial(c, x, y, 9);
  line(c, P.light, x - width / 2 + 2, y + height * .48, x - width / 2 + 2, baseY, 1);
  if(baseY>y+height+3){
    cornice(c,x-width/2-1,baseY-3,width+2);
    poly(c,'#7c5c62',[[x-width/2,baseY-10],[x+width/2,baseY-10],[x+width/2+3,baseY+2],[x-width/2-3,baseY+2]]);
    line(c,P.warm,x-width/2,baseY-9,x-width/2-2,baseY,1);
  }
}

function clockFace(c, x, y, radius) {
  ellipse(c, P.deep, x, y, radius + 5, radius + 5);
  ellipse(c, P.light, x, y, radius + 3, radius + 3);
  ellipse(c, P.deep, x, y, radius + 1, radius + 1);
  ellipse(c, P.white, x, y, radius - 1, radius - 1);
  for (let i = 0; i < 60; i++) {
    const angle = i * Math.PI / 30 - Math.PI / 2;
    const outer = radius - 2, inner = radius - (i % 5 ? 4 : 7);
    line(c, P.deep, x + Math.cos(angle) * inner, y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer, y + Math.sin(angle) * outer, i % 5 ? 1 : 2);
  }
  c.fillStyle = P.deep; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 7px Georgia, serif';
  ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((v, i) => {
    const a = i * Math.PI / 6 - Math.PI / 2;
    c.fillText(v, Math.round(x + Math.cos(a) * (radius - 10)), Math.round(y + Math.sin(a) * (radius - 10)));
  });
  // A fixed clock belongs to the cached architecture, not to wall-clock time.
  line(c, P.deep, x, y, x + 12, y - 14, 3);
  line(c, P.deep, x, y, x - 7, y - 12, 4);
  ellipse(c, P.deep, x, y, 3, 3);
  ellipse(c, P.light, x, y, 1, 1);
}

function drawElizabethTower(c) {
  // The golden shaft reads as four deep bays, with a darker east-facing return.
  const x = 990, w = 79;
  stone(c, x, 365, w, 297, 203);
  poly(c, '#514760', [[x + w, 365], [x + w + 17, 374], [x + w + 17, 662], [x + w, 662]], P.deep, 2);
  for (let yy = 379; yy < 658; yy += 14) {
    line(c, '#927080', x + w + 2, yy, x + w + 15, yy + 5, 1);
  }
  for (let col = 0; col < 4; col++) {
    const xx = x + 8 + col * 17;
    gothic(c, xx, 382, 10, 48, col !== 3, 0);
    gothic(c, xx, 453, 10, 57, col !== 3, 0);
    gothic(c, xx, 529, 10, 59, col !== 3, 0);
    gothic(c, xx, 609, 10, 45, col !== 3, 0);
    line(c, col === 3 ? '#98785e' : '#e1ad61', xx - 4, 376, xx - 4, 657, 1);
    line(c, '#443c57', xx + 12, 378, xx + 12, 659, 3);
  }
  for (const yy of [370, 438, 518, 596]) cornice(c, x - 2, yy, w + 4, true);
  // Two narrow lancets on the shadowed side preserve the tower's volume.
  for (const yy of [390, 464, 540, 614]) {
    gothic(c, 1075, yy, 6, 38, yy === 464, 0);
  }
  // Clock chamber: a square face, four corner shields and open gallery below.
  stone(c, 986, 291, 88, 63, 209);
  rect(c, '#a75a35', 990, 296, 79, 55);
  clockFace(c, 1030, 322, 26);
  for (const xx of [990, 1065]) {
    rect(c, P.edge, xx, 294, 4, 58);
    for (const yy of [297, 344]) poly(c, P.light, [[xx - 2, yy], [xx + 3, yy - 3], [xx + 8, yy], [xx + 3, yy + 3]], P.deep);
  }
  poly(c, P.shade, [[1074, 291], [1087, 298], [1087, 357], [1074, 354]], P.deep, 2);
  ellipse(c, P.gold, 1080, 323, 4, 20);
  line(c, P.deep, 1080, 321, 1081, 310, 1);
  cornice(c, 982, 357, 96, true);
  for (let xx = 992; xx < 1074; xx += 10) gothic(c, xx, 359, 5, 10, true, 0);
  cornice(c, 982, 288, 97, true);
  stone(c, 992, 263, 77, 22, 210);
  for (let xx = 997; xx < 1068; xx += 10) gothic(c, xx, 266, 6, 17, true, 0);
  // The mansard is tiered, with dormers and ridge highlights, rather than a cone.
  poly(c, P.roof, [[987, 261], [1001, 237], [1007, 224], [1055, 224], [1062, 244], [1074, 261]], P.deep, 3);
  poly(c, '#172e51', [[1040,225],[1055,224],[1062,244],[1072,260],[1045,260]]);
  poly(c, '#4c6c95', [[1007,225],[1020,225],[1006,260],[989,260]]);
  line(c, P.roofLight, 991, 258, 1008, 228, 2);
  line(c, '#102d54', 1046, 226, 1059, 258, 3);
  for (let xx = 1004; xx < 1064; xx += 16) {
    gothic(c, xx, 242, 5, 9, true, 0);
    poly(c, P.light, [[xx - 2, 241], [xx + 2, 236], [xx + 7, 241]]);
  }
  cornice(c, 1008, 224, 46, true);
  stone(c, 1010, 196, 42, 24, 211);
  for (let xx = 1014; xx < 1050; xx += 9) gothic(c, xx, 199, 5, 18, true, 0);
  cornice(c, 1007, 194, 48);
  poly(c, P.roof, [[1007, 191], [1017, 167], [1024, 137], [1030, 116], [1036, 143], [1042, 169], [1056, 191]], P.deep, 2);
  poly(c, '#172f50', [[1030,119],[1036,143],[1042,169],[1054,190],[1034,190]]);
  line(c, P.light, 1009, 188, 1028, 120, 2);
  for (const [xx, yy] of [[1022, 169], [1033, 156], [1039, 179], [1026, 184]]) {
    rect(c, P.light, xx, yy, 2, 4);
    rect(c, P.deep, xx + 2, yy, 1, 5);
  }
  finial(c, 1030, 119, 23);
  for (const [xx, yy, foot] of [[1007,184,225],[1056,184,225],[986,255,291],[1075,255,291]]) {
    pinnacle(c, xx, yy - 17, 25, 7, foot);
  }
}

function palaceBay(c, x, y, w, height, seed) {
  stone(c, x, y, w, height, seed);
  // Buttresses alternate light edges with long, violet recesses.
  rect(c, P.deep, x + 1, y, 4, height);
  rect(c, P.warm, x + 5, y, 4, height);
  line(c, '#dfae65', x + 8, y + 3, x + 8, y + height, 1);
  // A projecting buttress has a lit face, a dark return and a cast shadow.
  rect(c, '#473f5c', x + w - 11, y + 4, 10, height - 4);
  rect(c, '#b77e48', x + w - 7, y, 4, height);
  line(c, '#e1ac62', x + w - 7, y + 2, x + w - 7, y + height, 1);
  for (const yy of [559, 608, 658]) {
    if (yy > y + 5 && yy < y + height + 1) cornice(c, x + 3, yy, w - 6);
  }
  const windowWidth = Math.min(17, w - 19);
  // Floor levels continue across adjacent wings, rather than following roof steps.
  for (const [row, yy] of [520, 570, 620].entries()) {
    if (yy < y + 8) continue;
    gothic(c, x + (w - windowWidth) / 2 + 1, yy, windowWidth, 30, (row + seed) % 9 !== 0, 1);
  }
  if (y < 500) gothic(c, x + (w - 12) / 2 + 1, y + 8, 12, 18, seed % 3 !== 0, 0);
  for (const yy of [561, 610]) {
    if (yy < y + 10) continue;
    const xx = x + w / 2;
    poly(c, '#b87442', [[xx - 4,yy + 3],[xx,yy],[xx + 4,yy + 3],[xx,yy + 6]], P.shade, 1);
    line(c, '#e2a558', xx - 2, yy + 3, xx + 2, yy + 3, 1);
  }
  // A tiny cusp in the parapet gives each bay its Gothic rhythm.
  pinnacle(c, x + 5, y - 20, 26, 5);
  rect(c, '#be8c53', x + 7, y - 2, w - 9, 2);
}

function drawVictoriaTower(c) {
  const x = 615, y = 359, w = 116, h = 303;
  stone(c, x, y, w, h, 420);
  rect(c, '#504861', x + w - 17, y, 17, h);
  line(c, '#a27665', x + w - 17, y + 4, x + w - 17, y + h, 2);
  // Tall, deeply recessed four-light gallery.
  rect(c, P.deep, x + 21, y + 41, 71, 86);
  for (let i = 0; i < 4; i++) gothic(c, x + 25 + i * 17, y + 43, 11, 79, true, 0);
  for (const yy of [y + 16, y + 33, y + 133, y + 183, y + 231, y + 276]) cornice(c, x - 1, yy, w + 2, yy === y + 133);
  for (let xx = x + 9; xx < x + w - 7; xx += 24) {
    gothic(c, xx, y + 147, 14, 28, true, 1);
    gothic(c, xx, y + 197, 14, 26, true, 1);
    gothic(c, xx, y + 245, 14, 25, true, 1);
    gothic(c, xx, y + 287, 14, 14, true, 0);
  }
  // Four tall corner turrets, with separate octagonal lower faces.
  for (const [xx, peak] of [[622, 309], [650, 303], [698, 319], [726, 309]]) {
    stone(c, xx - 6, 340, 12, 322, xx);
    rect(c, '#46415d', xx + 3, 341, 3, 319);
    for (const yy of [365, 394, 448, 494, 543, 589, 635]) cornice(c, xx - 6, yy, 12);
    pinnacle(c, xx, peak, 47, 12);
  }
  // Crenellations and slender central tracery above the gallery.
  for (let xx = x + 12; xx < x + w - 8; xx += 11) {
    rect(c, P.warm, xx, y - 12, 6, 13);
    rect(c, P.edge, xx, y - 12, 6, 2);
  }
  for (const xx of [661, 676, 689]) pinnacle(c, xx, xx === 676 ? 319 : 331, 33, 7);
  line(c, P.light, 676, 320, 676, 284, 2);
  finial(c, 676, 287, 10);
}

function drawCentralSpire(c) {
  const x = 807;
  // The two flanking stair turrets and the central lantern rise from one
  // continuous, stepped stone crossing rather than hanging beside its shaft.
  stone(c,x-30,446,62,216,813);
  poly(c,'#d09953',[[x-30,446],[x-20,433],[x+22,433],[x+32,446]]);
  cornice(c,x-33,447,67,true);
  for(const side of [-1,1]){
    const xx=x+side*23;
    stone(c,xx-5,432,10,230,805+side);
    rect(c,'#4a425d',xx+2,433,3,229);
    for(const yy of [487,559,609])cornice(c,xx-6,yy,12);
  }
  stone(c, x - 14, 410, 30, 252, 65);
  rect(c, P.shade, x + 9, 410, 7, 250);
  for (const yy of [452, 509, 562, 611]) cornice(c, x - 17, yy, 36, true);
  gothic(c, x - 7, 466, 14, 37, true, 1);
  gothic(c, x - 7, 522, 14, 31, true, 1);
  gothic(c, x - 7, 577, 14, 29, true, 1);
  gothic(c, x - 7, 627, 14, 31, true, 1);
  poly(c, P.roof, [[x - 15, 410], [x - 9, 382], [x - 5, 356], [x, 325], [x + 5, 358], [x + 10, 383], [x + 17, 410]], P.ink, 2);
  line(c, P.light, x - 13, 405, x - 1, 334, 2);
  cornice(c, x - 12, 385, 25);
  finial(c, x, 329, 17);
  pinnacle(c, x - 22, 394, 44, 10, 488);
  pinnacle(c, x + 24, 399, 40, 10, 488);
}

function drawPalace(c) {
  // Roof silhouettes come first; bays and buttresses then give the facade depth.
  const roof = [[475, 541], [490, 513], [599, 512], [609, 528], [748, 521], [765, 479], [868, 479], [893, 517], [983, 524], [993, 551]];
  poly(c, '#485678', roof, P.deep, 2);
  poly(c, '#2b3e60', [[765,479],[868,479],[893,517],[792,520]]);
  line(c, '#73819b', 765,479,868,479,1);
  c.save(); c.beginPath(); roof.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy)); c.closePath(); c.clip();
  for (let yy = 481; yy < 550; yy += 6) {
    line(c, '#6f7794', 477, yy, 990, yy, 1);
    for (let xx = 480 + ((yy / 6 | 0) % 2) * 6; xx < 992; xx += 13) line(c, '#354965', xx, yy, xx, yy + 5, 1);
  }
  c.restore();
  const roofHeight = x => {
    for(let i=1;i<roof.length;i++){
      const a=roof[i-1],b=roof[i];
      if(x>=a[0]&&x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    }
    return 550;
  };
  for (let xx = 485; xx < 987; xx += 34) {
    const high = xx > 741 && xx < 876;
    const foot=roofHeight(xx)+14;
    pinnacle(c, xx, (high ? 407 : 466) - (xx % 3) * 7, high ? 72 : 65, 11,foot);
  }
  const bays = [
    [476, 550, 35, 112], [511, 531, 35, 131], [546, 522, 35, 140], [581, 523, 35, 139],
    [731, 528, 35, 134], [766, 487, 35, 175], [801, 482, 35, 180],
    [836, 488, 35, 174], [871, 521, 35, 141], [906, 530, 35, 132], [941, 534, 35, 128],
  ];
  bays.forEach((b, i) => palaceBay(c, ...b, i + 42));
  drawVictoriaTower(c);
  drawCentralSpire(c);
  // Turreted entry at the west end: a lower visual counterweight to the clock.
  for (const xx of [542, 569, 596]) {
    stone(c, xx - 5, 501, 12, 161, xx);
    for (const yy of [523, 566, 611]) cornice(c, xx - 6, yy, 13);
    pinnacle(c, xx + 1, xx === 569 ? 446 : 465, 51, 10);
  }
  cornice(c, 478, 658, 515, true);
  drawElizabethTower(c);
}

function blueRail(c, x1, y1, x2, y2, railHeight = 20) {
  line(c, P.ink, x1, y1 - railHeight, x2, y2 - railHeight, 5);
  line(c, P.blueLight, x1, y1 - railHeight, x2, y2 - railHeight, 2);
  line(c, P.blue, x1, y1, x2, y2, 7);
  line(c, P.edge, x1, y1 - 3, x2, y2 - 3, 2);
  const length = Math.abs(x2 - x1);
  for (let d = 0; d < length; d += 15) {
    const t = d / length, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    line(c, P.blueLight, x, y - railHeight, x, y - 4, 2);
    if (d + 15 <= length) {
      const n = Math.min(1, (d + 15) / length), nx = x1 + (x2 - x1) * n, ny = y1 + (y2 - y1) * n;
      line(c, '#b6dfd8', x, y - railHeight + 3, nx, ny - 6, 1);
      line(c, '#b6dfd8', x, y - 6, nx, ny - railHeight + 3, 1);
    }
  }
}

function bridgeTower(c, x, roofY, base = 625) {
  const width = 94, wallY = roofY + 91, height = base - wallY;
  stone(c, x - 47, wallY, width, height, x | 0);
  rect(c, P.shade, x + 30, wallY, 17, height);
  rect(c, '#f5ba62', x - 41, wallY + 2, 4, height - 2);
  // Broad central roadway arch: dark interior and lit multiple stone voussoirs.
  gothic(c, x - 24, base - 75, 48, 75, false, 0);
  pointedPath(c, x - 19, base - 70, 38, 70); c.fillStyle = '#1e3152'; c.fill();
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI + (i + .5) * Math.PI / 7;
    const xx = x + Math.cos(angle) * 28, yy = base - 44 + Math.sin(angle) * 31;
    rect(c, P.warm, xx - 2, yy - 2, 4, 6);
  }
  const levels = [wallY + 10, wallY + 58, wallY + 105, wallY + 152];
  levels.forEach((y, i) => {
    if (y + 33 > base - 79) return;
    for (let col = 0; col < 3; col++) gothic(c, x - 31 + col * 24, y, 15, 30, col !== 2 && (col + i) % 4 !== 2, 1);
    cornice(c, x - 47, y + 36, width, true);
  });
  // Tall side turrets: each has a shadow face, a separate cap and narrow slits.
  for (const offset of [-45, 45]) {
    const xx = x + offset;
    stone(c, xx - 10, roofY + 73, 20, base - roofY - 73, xx);
    rect(c, P.shade, xx + 4, roofY + 76, 6, base - roofY - 76);
    for (let yy = roofY + 91; yy < base - 12; yy += 48) {
      gothic(c, xx - 4, yy, 7, 22, offset < 0 || yy % 3 === 0, 0);
      cornice(c, xx - 11, yy + 30, 22);
    }
    poly(c, P.roof, [[xx - 14, roofY + 74], [xx - 9, roofY + 56], [xx - 5, roofY + 40], [xx, roofY + 19], [xx + 5, roofY + 41], [xx + 10, roofY + 58], [xx + 14, roofY + 74]], P.deep, 2);
    line(c, P.roofLight, xx - 11, roofY + 69, xx - 1, roofY + 24, 2);
    cornice(c, xx - 14, roofY + 74, 28);
    finial(c, xx, roofY + 20, 16);
  }
  cornice(c, x - 47, wallY, width, true);
  // Central mansard, dormers and a gold crest make a recognizable bridge tower.
  poly(c, P.roof, [[x - 36, wallY - 4], [x - 26, roofY + 62], [x - 15, roofY + 35], [x - 10, roofY + 13], [x + 11, roofY + 13], [x + 20, roofY + 42], [x + 30, roofY + 67], [x + 37, wallY - 4]], P.deep, 3);
  poly(c, '#173352', [[x + 5,roofY + 14],[x + 11,roofY + 13],[x + 20,roofY + 42],[x + 30,roofY + 67],[x + 36,wallY - 4],[x + 12,wallY - 4]]);
  poly(c, '#49688d', [[x - 10,roofY + 14],[x - 3,roofY + 14],[x - 19,wallY - 5],[x - 33,wallY - 5],[x - 25,roofY + 63]]);
  line(c, P.roofLight, x - 32, wallY - 6, x - 10, roofY + 17, 2);
  for (const xx of [x - 17, x + 12]) {
    gothic(c, xx, wallY - 35, 9, 25, true, 0);
    poly(c, P.light, [[xx - 2, wallY - 35], [xx + 4, wallY - 43], [xx + 11, wallY - 35]], P.deep);
  }
  cornice(c, x - 10, roofY + 13, 22);
  finial(c, x, roofY + 13, 30);
  poly(c, P.gold, [[x - 4, roofY - 3], [x, roofY - 12], [x + 5, roofY - 3], [x + 4, roofY + 4], [x - 4, roofY + 4]], P.deep);
  // Four slender uprights frame the centre without flattening its bays.
  for (const off of [-35, -10, 13, 34]) {
    line(c, P.deep, x + off, wallY + 6, x + off, base - 79, 3);
    line(c, P.light, x + off - 1, wallY + 6, x + off - 1, base - 79, 1);
  }
}

function suspensionCable(c, x1, y1, x2, y2, sag, drops = true) {
  const point = t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * sag];
  let prev = point(0);
  for (let i = 1; i <= 50; i++) {
    const next = point(i / 50);
    line(c, P.deep, ...prev, ...next, 9);
    line(c, P.blue, ...prev, ...next, 6);
    line(c, P.blueLight, prev[0], prev[1] - 2, next[0], next[1] - 2, 2);
    prev = next;
  }
  if (drops) for (let t = .06; t < 1; t += .07) {
    const [x, y] = point(t);
    if (y < 617) {
      line(c, P.ink, x, y + 2, x, 621, 4);
      line(c, '#9de2e1', x, y + 2, x, 621, 2);
    }
  }
}

function archSpan(c, x1, x2, top, bottom) {
  // A real opening: draw the ring itself, so the river and skyline show through.
  c.beginPath(); c.moveTo(x1, bottom); c.lineTo(x1, top); c.lineTo(x2, top); c.lineTo(x2, bottom);
  // The controls rise above the crown: a cubic otherwise produces a shallow gap
  // hidden by the distant quay. This leaves a tall, visibly open river arch.
  c.bezierCurveTo(x2 - 20, top - 20, x1 + 20, top - 20, x1, bottom); c.closePath();
  c.fillStyle = '#34385e'; c.fill(); c.strokeStyle = P.deep; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(x1 + 2, bottom - 3);
  c.bezierCurveTo(x1 + 22, top - 19, x2 - 22, top - 19, x2 - 2, bottom - 3);
  c.strokeStyle = '#75bbcb'; c.lineWidth = 4; c.stroke();
  c.beginPath(); c.moveTo(x1 + 5, bottom - 4);
  c.bezierCurveTo(x1 + 25, top - 12, x2 - 25, top - 12, x2 - 5, bottom - 4);
  c.strokeStyle = '#bcbdc5'; c.lineWidth = 1; c.stroke();
}

function drawTowerBridge(c) {
  // The raised connecting walkway remains physically attached to both towers.
  poly(c, P.deep, [[151, 395], [353, 427], [353, 461], [151, 430]], P.ink, 2);
  poly(c, P.blue, [[151, 396], [353, 428], [353, 451], [151, 421]]);
  blueRail(c, 151, 426, 353, 457, 27);
  line(c, P.gold, 151, 434, 353, 465, 3);
  // Suspension outer sections are swept curves with independent hangers.
  suspensionCable(c, -150, 575, 70, 424, 29);
  suspensionCable(c, 435, 478, 588, 621, 22);
  suspensionCable(c, -130, 602, 73, 455, 24, false);
  suspensionCable(c, 435, 505, 588, 635, 16, false);
  // Main piers precede the upper towers; their ashlar blocks continue to the water.
  for (const xx of [112, 391]) {
    stone(c, xx - 57, 623, 114, 81, xx + 300);
    rect(c, P.shade, xx + 40, 624, 17, 80);
    cornice(c, xx - 59, 622, 118, true);
    poly(c, P.warm, [[xx - 56, 681], [xx - 65, 694], [xx - 65, 704], [xx + 64, 704], [xx + 64, 694], [xx + 56, 681]], P.deep, 2);
    line(c, P.edge, xx - 60, 694, xx + 60, 694, 3);
  }
  archSpan(c, -100, 54, 636, 704);
  archSpan(c, 170, 333, 636, 704);
  archSpan(c, 449, 589, 636, 704);
  drawBridgeDeck(c);
  bridgeTower(c, 112, 277);
  bridgeTower(c, 391, 343);
  // Crest above the high walkway: a gold shield in a tiny stone gable.
  poly(c, P.light, [[272, 436], [272, 417], [283, 399], [294, 420], [294, 439]], P.deep, 2);
  poly(c, P.blue, [[278, 419], [289, 420], [289, 432], [283, 436], [278, 431]], P.deep);
  line(c, P.gold, 283, 422, 283, 432, 2); finial(c, 283, 402, 12);
}

function drawBridgeDeck(c) {
  rect(c, P.deep, -100, 623, 690, 12);
  rect(c, '#345b78', -100, 625, 690, 5);
  rect(c, P.edge, -100, 622, 690, 2);
  rect(c, '#67bfc6', -100, 633, 690, 2);
  blueRail(c, -100, 623, 590, 623, 13);
  for (let x = -95; x < 585; x += 17) rect(c, P.edge, x, 615, 5, 4);
}

function drawShard(c) {
  const cx = 1459, top = 181, base = 662;
  const pts = [[cx - 54, base], [cx - 31, 411], [cx - 8, 216], [cx - 3, top], [cx + 3, top + 5], [cx + 7, 222], [cx + 42, 479], [cx + 55, base]];
  poly(c, '#4d639c', pts, '#49416d', 3);
  c.save(); c.beginPath(); pts.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.clip();
  poly(c, '#8b9bca', [[cx - 12, top], [cx - 2, top], [cx - 4, base], [cx - 47, base]]);
  poly(c, '#324f86', [[cx + 1, top], [cx + 12, 240], [cx + 55, base], [cx + 4, base]]);
  const random = rng(451);
  for (let y = top + 33; y < base; y += 11) {
    const half = Math.max(3, (y - top) * .126);
    line(c, '#2d4073', cx - half, y, cx + half, y, 2);
    for (let x = cx - half + 2; x < cx + half; x += 10) {
      const level = Math.round((y - top) / 11);
      const lit = level % 6 === 0 || (level % 6 < 3 && random() > .64);
      rect(c, lit ? '#ffd27a' : x > cx ? '#4f658b' : '#92a4c1', x, y + 3, 7, 4);
      if (lit) rect(c, '#f7d99c', x, y + 2, 6, 1);
    }
  }
  for (const off of [-21,-8,5,20,33]) line(c, '#d8bad2', cx + off * .06, top + 10, cx + off, base, 1);
  c.restore();
  line(c, '#e8d1cc', cx - 3, top, cx - 51, base, 2);
  line(c, '#1f3968', cx + 5, top + 9, cx + 53, base, 3);
  // Separate splinter gives the skyline a shard, not a simple triangle.
  line(c, '#d4c5cf', cx + 10, top + 6, cx + 13, top + 102, 2);
}

function drawGherkin(c) {
  const x = 1122, y = 396, w = 83, h = 266;
  const pts = [[x - 29,y + h],[x - 37,y + 225],[x - 42,y + 145],[x - 35,y + 74],[x - 22,y + 28],[x - 10,y + 7],[x,y],[x + 10,y + 7],[x + 22,y + 28],[x + 35,y + 74],[x + 42,y + 145],[x + 37,y + 225],[x + 29,y + h]];
  poly(c, '#535d8c', pts, P.deep, 3);
  c.save(); c.beginPath(); pts.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy)); c.closePath(); c.clip();
  poly(c, '#7180a4', [[x - 18,y],[x + 1,y],[x - 3,y + h],[x - 33,y + h]]);
  for (let row = -2; row < 12; row++) {
    for (let col = -4; col < 4; col++) {
      const xx = x + col * 19 + (row % 2) * 9.5, yy = y + row * 25;
      const lit = (row + col + 28) % 5 === 0 || (row > 5 && col === -1);
      poly(c, lit ? '#edba66' : col > 0 ? '#536a8d' : '#8a97b1', [[xx,yy],[xx + 8,yy + 12],[xx,yy + 24],[xx - 8,yy + 12]], '#34456e', 2);
    }
  }
  // Diagonal spiral bands are continuous across the diamond glazing.
  for (let n = -5; n < 7; n++) line(c, '#3f4977', x - w, y + n * 53, x + w, y + n * 53 + 180, 7);
  for (let yy = y + 17; yy < y + h; yy += 24) line(c, '#69779b', x - w / 2, yy, x + w / 2, yy, 1);
  c.restore();
  line(c, '#c1adab', x - 3, y + 5, x - 28, y + 75, 2);
  // Ground lobby and foundation anchor the glazed volume to the river bank.
  rect(c,'#313e60',x-40,640,80,22);
  rect(c,'#91849a',x-43,639,86,3);
  for(let xx=x-31;xx<x+34;xx+=13){
    rect(c,'#6d7493',xx,645,10,14);
    rect(c,xx%3?'#d6a969':'#9a8ca4',xx+2,647,4,10);
    line(c,'#263b59',xx+10,643,xx+10,661,2);
  }
  rect(c,'#494663',x-44,660,88,3);
}

const RIVER_HOUSES = [
  { wall:'#c3b39f', light:'#e1d0af', side:'#877a7d', trim:'#e8d6b6', roof:'#46516c', join:'#a29388', door:'#365b5e', curtain:'#d7d4b7' },
  { wall:'#b5867e', light:'#d3aa96', side:'#795f6d', trim:'#dec3ab', roof:'#48506b', join:'#9c7775', door:'#4a5547', curtain:'#dfc8b8' },
  { wall:'#8d9b92', light:'#b8c0a9', side:'#657378', trim:'#d4ccb3', roof:'#404a66', join:'#7d8a84', door:'#544853', curtain:'#c8d4ca' },
  { wall:'#a1a0b5', light:'#c3bfd0', side:'#737489', trim:'#e1d2c1', roof:'#3f4b67', join:'#8c8a9f', door:'#675154', curtain:'#d8c8c1' },
];

function houseWindow(c,x,y,w,h,p,lit,detail) {
  // Pale painted joinery sits in a deep opening; curtains and an interior lamp
  // explain the light rather than turning the whole opening into a gold tile.
  rect(c,'#514b60',x-2,y-2,w+4,h+4);
  rect(c,p.trim,x-1,y-1,w+2,h+2);
  const glass=c.createLinearGradient(x,y,x,y+h);
  glass.addColorStop(0,lit?'#f5d7a3':'#7d879b');
  glass.addColorStop(1,lit?'#bc8a66':'#424d6a');
  c.fillStyle=glass;c.fillRect(x,y,w,h);
  rect(c,lit?'#8b6e65':'#39445f',x+w-2,y,2,h);
  if(lit){
    rect(c,p.curtain,x,y,2,h-2);rect(c,p.curtain,x+w-3,y,2,h-2);
    rect(c,'#b2a291',x+1,y+h*.55,2,2);
    if(detail%3===0){
      line(c,'#6c5250',x+w*.5,y+1,x+w*.5,y+4,1);
      poly(c,'#fff1ca',[[x+w*.5-2,y+4],[x+w*.5+2,y+4],[x+w*.5+3,y+7],[x+w*.5-3,y+7]]);
    }else if(detail%3===1){
      rect(c,'#8d6754',x+2,y+h-4,w-4,2);
      rect(c,'#e2c6a6',x+3,y+h-6,3,2);
    }
  }else line(c,'#a3adba',x+1,y+2,x+w-4,y+5,1);
  line(c,p.trim,x+w*.5,y,x+w*.5,y+h,1);
  line(c,p.trim,x,y+h*.4,x+w,y+h*.4,1);
  rect(c,'#605968',x-3,y+h+2,w+6,2);
  rect(c,p.trim,x-3,y+h+1,w+6,1);
  rect(c,p.light,x-2,y-3,w+4,1);
}

function houseRoof(c,x,y,w,p,seed) {
  const mansard=w>68,peak=mansard?19:Math.min(21,w*.3);
  const roof=mansard?[[x-2,y],[x+7,y-peak],[x+w-9,y-peak],[x+w+2,y]]:[[x-2,y],[x+w*.5,y-peak],[x+w+2,y]];
  poly(c,p.roof,roof,'#393f59',1);
  c.save();c.beginPath();roof.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.closePath();c.clip();
  for(let yy=y-peak+3;yy<y;yy+=4){
    line(c,'#6e738a',x,yy,x+w,yy,1);
    for(let xx=x+((yy%8)?3:0);xx<x+w;xx+=9)line(c,'#39445f',xx,yy,xx,yy+3,1);
  }
  c.restore();
  if(mansard){
    const n=w>95?3:2;
    for(let i=0;i<n;i++){
      const dx=Math.round(x+w*(i+1)/(n+1))-5;
      rect(c,p.wall,dx,y-13,10,13);
      rect(c,p.trim,dx+1,y-12,8,10);rect(c,'#555c76',dx+2,y-11,6,8);
      line(c,p.trim,dx+5,y-11,dx+5,y-3,1);
      poly(c,p.trim,[[dx-2,y-13],[dx+5,y-20],[dx+12,y-13]],'#41475f',1);
      line(c,p.light,dx-1,y-14,dx+5,y-19,1);
    }
  }
  // The flue penetrates the roof and has distinct clay pots on a stone cap.
  const chx=x+w-18;
  rect(c,'#8b6d68',chx,y-peak-9,6,peak+7);
  for(let yy=y-peak-5;yy<y-4;yy+=4)line(c,'#695967',chx,yy,chx+6,yy,1);
  rect(c,'#bda58d',chx-1,y-peak-10,8,2);
  for(const off of [0,4]){rect(c,'#a97561',chx+off,y-peak-14,2,4);rect(c,'#584d5c',chx+off,y-peak-14,2,1);}
  rect(c,'#4a4d64',x-2,y,w+4,3);rect(c,p.trim,x-2,y,w+4,1);
}

function riverOffice(c, x, y, w, h, seed) {
  const p=RIVER_HOUSES[seed%RIVER_HOUSES.length],base=y+h,shopY=base-27;
  const wall=c.createLinearGradient(x,y,x+w,y);
  wall.addColorStop(0,p.light);wall.addColorStop(.13,p.wall);wall.addColorStop(.83,p.wall);wall.addColorStop(1,p.side);
  c.fillStyle=wall;c.fillRect(x,y,w,h);
  rect(c,p.side,x+w-7,y,7,h);
  // Occasional dressed corners, not a texture laid over every painted wall.
  if(seed%2===0)for(let yy=y+6,i=0;yy<shopY-5;yy+=10,i++){
    rect(c,p.trim,x,yy,i%2?3:5,5);
    rect(c,p.side,x+w-6,yy,i%2?5:3,5);
  }
  const cols=Math.max(2,Math.floor((w-9)/22)),step=(w-17)/cols,ww=Math.min(12,step-8);
  const rows=Math.max(1,Math.floor((shopY-y-5)/29));
  for(let row=0;row<rows;row++){
    const yy=y+11+row*29;
    if(yy+18>shopY-2)continue;
    for(let col=0;col<cols;col++){
      const xx=Math.round(x+5+(col+.5)*step-ww*.5),detail=seed+row*7+col;
      houseWindow(c,xx,yy,ww,16,p,detail%5<3,detail);
      if(row===rows-1&&col===0&&seed%3===0){
        rect(c,'#756059',xx-1,yy+19,ww+2,3);
        for(let i=0;i<ww;i+=3){rect(c,'#54735d',xx+i,yy+16,3,4);rect(c,'#819367',xx+i,yy+15,2,2);}
        rect(c,'#b78b77',xx+2,yy+18,2,1);
      }
    }
    if(row<rows-1)rect(c,p.join,x+3,yy+22,w-12,1);
  }
  if(h>110&&seed%2===0){
    const bx=x+7,by=y+33,bw=w-23;
    rect(c,'#595769',bx,by+3,bw,2);
    rect(c,p.trim,bx-2,by+1,bw+4,2);
    line(c,'#3d475b',bx,by-5,bx+bw,by-5,1);
    for(let xx=bx;xx<=bx+bw;xx+=4)line(c,'#3d475b',xx,by-5,xx,by+1,1);
    for(const xx of [bx+4,bx+bw-7])poly(c,p.side,[[xx,by+4],[xx+4,by+4],[xx+1,by+8]]);
  }
  // A shopfront is a single constructed object: fascia, shelf, panes and door.
  const shop=seed%3!==1,doorX=x+w-20,doorY=shopY+8,displayX=x+5,displayW=w-31;
  rect(c,p.side,x,shopY,w,27);rect(c,p.trim,x-1,shopY-2,w+2,3);
  rect(c,p.door,doorX-2,shopY+5,15,22);
  rect(c,'#e0c39b',doorX,doorY,9,5);rect(c,'#75665f',doorX,doorY+6,9,10);
  rect(c,p.door,doorX+1,doorY+7,7,8);rect(c,'#d7bd83',doorX+7,doorY+10,1,2);
  if(shop){
    rect(c,p.door,displayX-2,shopY+5,displayW+4,22);
    const glass=c.createLinearGradient(0,shopY+8,0,base);
    glass.addColorStop(0,'#f1d5a5');glass.addColorStop(1,'#b98668');
    c.fillStyle=glass;c.fillRect(displayX,shopY+9,displayW,15);
    line(c,'#755a52',displayX,base-10,displayX+displayW,base-10,1);
    if(seed%3===0){
      for(let i=2;i<displayW-3;i+=5){rect(c,i%3?'#6f7d7c':'#a17270',displayX+i,base-16-(i%2),3,5+(i%2));rect(c,'#d9c095',displayX+i,base-15,1,2);}
    }else{
      for(let i=4;i<displayW-3;i+=11){rect(c,'#ead2a5',displayX+i,base-8,7,2);rect(c,'#9a775c',displayX+i+1,base-11,5,3);}
    }
    for(let i=15;i<displayW;i+=17)line(c,p.door,displayX+i,shopY+8,displayX+i,base-3,2);
    rect(c,p.door,displayX-2,shopY+1,displayW+4,6);
    c.save();c.font='5px Georgia,serif';c.textAlign='center';c.fillStyle='#e6d3ad';c.fillText(seed%3===0?'BOOKS':'TEA ROOM',displayX+displayW*.5,shopY+6);c.restore();
    if(seed%2===0){
      poly(c,p.door,[[displayX-3,shopY+7],[displayX+displayW+3,shopY+7],[displayX+displayW+5,shopY+11],[displayX-5,shopY+11]]);
      for(let xx=displayX-3;xx<displayX+displayW+2;xx+=8)rect(c,'#c8bba2',xx,shopY+8,4,3);
      rect(c,'#3c4857',displayX-5,shopY+11,displayW+10,1);
    }
  }else for(let xx=x+8;xx<doorX-8;xx+=17)houseWindow(c,xx,shopY+8,8,12,p,false,0);
  // Downpipes, threshold and basement stone all end on the same firm bank.
  line(c,'#555363',x+w-5,y+2,x+w-5,base-2,2);
  for(let yy=y+13;yy<base-5;yy+=24)rect(c,p.trim,x+w-6,yy,3,1);
  rect(c,'#514d60',x,base-3,w,4);rect(c,p.trim,x-1,base-3,w+2,1);
  houseRoof(c,x,y,w,p,seed);
}

export function drawLandmarks(c, range = { left: -Infinity, right: Infinity }) {
  const visible = (left, right) => right >= range.left && left <= range.right;
  if (visible(1399, 1521)) drawShard(c);
  if (visible(1078, 1167)) drawGherkin(c);
  if (visible(1132, 1211)) riverOffice(c, 1136, 596, 73, 66, 817);
  if (visible(1201, 1284)) riverOffice(c, 1205, 516, 77, 146, 818);
  if (visible(1275, 1339)) riverOffice(c, 1279, 568, 58, 94, 819);
  if (visible(1315, 1403)) riverOffice(c, 1319, 600, 78, 62, 820);
  if (visible(1392, 1519)) riverOffice(c, 1396, 557, 116, 105, 821);
  if (visible(1503, 1625)) riverOffice(c, 1508, 516, 110, 146, 822);
  if (visible(1608, 1728)) riverOffice(c, 1613, 583, 107, 79, 823);
  if (visible(468, 1090)) drawPalace(c);
  if (visible(-155, 596)) drawTowerBridge(c);
}

export const landmarkLights = Object.freeze([
  { x: 111, width: 48, color: '#ffd267', strength: .9 },
  { x: 390, width: 52, color: '#ffc761', strength: 1 },
  { x: 557, width: 30, color: '#f6a547', strength: .72 },
  { x: 673, width: 61, color: '#ffd267', strength: 1 },
  { x: 803, width: 48, color: '#ffc761', strength: .8 },
  { x: 932, width: 28, color: '#f4b351', strength: .7 },
  { x: 1030, width: 56, color: '#ffe189', strength: 1 },
  { x: 1144, width: 27, color: '#c695e2', strength: .65 },
  { x: 1431, width: 25, color: '#f4a0c9', strength: .8 },
  { x: 1550, width: 39, color: '#ffd276', strength: .75 },
]);
