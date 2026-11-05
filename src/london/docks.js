/**
 * The working river: hand-authored warehouses, one dock crane and an air terminal.
 * All coordinates belong to the world, never to a numbered reference frame.
 * No reference image is loaded or sampled by this module.
 */
import { rect, line, poly, ellipse, arch, brickwork } from './drawing.js';
import { AIRPORT, bridgePoint } from './airport-geometry.js';

const P = Object.freeze({
  ink: '#302846', deep: '#45314f', mortar: '#744154', brick: '#b6544d',
  brickLight: '#d27550', brickDark: '#8e4149', stone: '#e5a46c',
  edge: '#ffcf87', roof: '#353d65', roofLight: '#525b85',
  glass: '#63426d', light: '#ffc85a', pale: '#ffe6a0',
  steel: '#236678', steelLight: '#65b3b7', steelDark: '#234459'
});

function glowWindow(c, x, y, w, h, options = {}) {
  const { round = true, seed = 1, pointed = false, lit = seed % 13 !== 3, inhabited = false } = options;
  // The recess, warm masonry reveal and inner glass are nested shapes.
  const shape = (xx, yy, ww, hh, fill, stroke, lineWidth = 1) => {
    if (round) arch(c, xx, yy, ww, hh, { fill, stroke, lineWidth, pointed });
    else { rect(c, fill, xx, yy, ww, hh); if (stroke) {
      line(c, stroke, xx, yy, xx + ww, yy, lineWidth);
      line(c, stroke, xx, yy, xx, yy + hh, lineWidth);
      line(c, stroke, xx + ww, yy, xx + ww, yy + hh, lineWidth);
    } }
  };
  shape(x - 4, y - 5, w + 8, h + 8, '#543146', '#452c43', 1);
  shape(x - 1, y - 2, w + 2, h + 4, inhabited ? '#b0937e' : lit ? '#bb8557' : '#855e57', P.brickDark, 1);
  shape(x + 2, y + 2, w - 4, h - 3, lit ? '#ffb43f' : '#41445f');
  // A narrow lit left reveal and a thick cool return make the opening a recess.
  line(c,lit?'#f2bc7a':'#b18a72',x,y+w*.5,x,y+h,1);
  line(c,'#5b354c',x+w+2,y+w*.5,x+w+2,y+h+2,3);
  // Controlled, vertically continuous illumination, never frame-random flicker.
  if (lit) {
    c.save();
    if (round) {
      c.beginPath();
      const a = Math.max(2, (w - 7) / 2);
      c.moveTo(x + 4, y + h - 1); c.lineTo(x + 4, y + a + 4);
      c.arc(x + w / 2, y + a + 4, a, Math.PI, 0);
      c.lineTo(x + w - 3, y + h - 1); c.closePath(); c.clip();
    } else { c.beginPath();c.rect(x + 3, y + 3, w - 6, h - 3);c.clip(); }
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, inhabited ? '#96726c' : '#cb703f');g.addColorStop(.3, inhabited ? '#f4cf91' : '#ffe285');
    g.addColorStop(.73, inhabited ? '#d9ae71' : '#ffc53e');g.addColorStop(1, inhabited ? '#986a56' : '#d77837');
    c.fillStyle = g;c.fillRect(x + 3, y + 2, w - 6, h);
    rect(c, '#ffdb85', x + 5, y + 8, 1, Math.max(3,h - 12));
    rect(c, '#ee9a40', x + w - 6, y + 6, 2, h - 8);
    if (seed % 3 === 0) rect(c, '#82505b', x + w * .48, y + h * .62, w * .32, h * .4);
    if (inhabited && w > 13 && h > 20) {
      // Curtains and a few interior silhouettes are fixed to their room, cached with the wall.
      const curtain = ['#d5b7a0','#b3b2a1','#c8adb2'][seed % 3];
      if (seed % 4 !== 1) {
        poly(c,curtain,[[x+3,y+4],[x+7,y+5],[x+7,y+h*.47],[x+5,y+h*.66],[x+5,y+h-2],[x+3,y+h-2]]);
        poly(c,curtain,[[x+w-3,y+4],[x+w-7,y+5],[x+w-7,y+h*.47],[x+w-5,y+h*.66],[x+w-5,y+h-2],[x+w-3,y+h-2]]);
        line(c,'#866b70',x+4,y+7,x+4,y+h*.55,1);
      }
      if (seed % 5 === 0) {
        const lx=x+w*.63, ly=y+h*.47;
        line(c,'#5c4a59',lx,y+2,lx,ly,1);
        poly(c,'#f6dfac',[[lx-3,ly],[lx+3,ly],[lx+5,ly+4],[lx-5,ly+4]]);
        rect(c,'#fff0bd',lx-2,ly+4,4,1);
      } else if (seed % 5 === 2) {
        rect(c,'#74524f',x+5,y+h-5,5,4);
        rect(c,'#4f6454',x+5,y+h-10,5,5);
        rect(c,'#6f795b',x+7,y+h-13,3,5);
      } else if (seed % 5 === 3) {
        rect(c,'#665262',x+4,y+h-8,w-8,3);
        rect(c,'#ab7b6c',x+5,y+h-12,2,4);
        rect(c,'#546071',x+8,y+h-13,3,5);
      }
    }
    c.restore();
  } else if (inhabited) {
    // Unlit glass still catches the cool sky; it is not a black hole or a second light.
    poly(c,'#82849a66',[[x+3,y+7],[x+7,y+4],[x+7,y+h-4],[x+3,y+h-1]]);
    line(c,'#9d8a9e77',x+5,y+h*.45,x+w-4,y+h*.45,1);
  }
  // The top arch is built from radial masonry blocks, with a heavier keystone.
  if (round && w > 12 && !pointed) {
    const cy=y+w/2+1,cx=x+w/2;
    for(let i=0;i<=8;i++) {
      const a=Math.PI+i*Math.PI/8;
      line(c,i%2?'#935455':inhabited?'#c7a18a':'#ffd293',cx+Math.cos(a)*(w/2+1),cy+Math.sin(a)*(w/2+1),
        cx+Math.cos(a)*(w/2+5),cy+Math.sin(a)*(w/2+5),1);
    }
    poly(c,inhabited?'#d4b49a':'#f8c282',[[cx-2,y-5],[cx+2,y-5],[cx+2,y],[cx-1,y]],'#8e4e53',1);
    line(c,'#69394c',x+w+2,y+w/2,x+w+2,y+h,2);
  }
  line(c, P.deep, x + w / 2, y + 4, x + w / 2, y + h, 2);
  if (h > 27) line(c, P.deep, x + 2, y + h * .55, x + w - 2, y + h * .55, 2);
  rect(c, P.deep, x - 4, y + h + 2, w + 8, 4);
  rect(c, inhabited ? '#bea38e' : lit ? '#e5b176' : '#9b7966', x - 3, y + h + 1, w + 6, 1);
  poly(c,'#432f4744',[[x+w+3,y+w*.5+3],[x+w+8,y+w*.5+8],[x+w+8,y+h+7],[x+w+3,y+h+4]]);
}

function roof(c, x, y, w, ridge, seed, masonry = P.brick) {
  poly(c, P.roof, [[x - 9,y+13],[x+19,y-17],[x+w-26,y-17],[x+w+8,y+13]], P.ink, 3);
  // Slate bands follow the plane of the roof, rather than covering it with noise.
  for (let row = 0; row < 5; row++) {
    const yy = y - 11 + row * 5;
    line(c, row % 2 ? '#454d73' : P.roofLight, x + 16 - row * 4, yy, x+w-22+row*4, yy, 1);
    for (let xx = x + 22 + (row % 2)*10; xx < x + w - 20; xx += 22)
      line(c, '#2d3658', xx, yy, xx-4, yy+4, 1);
  }
  line(c, P.edge, x+18,y-17,x+w-26,y-17,2);
  // Raised triangular front gable, with a sunlit rake and a shaded return.
  poly(c, P.brickDark, [[x+w*.5+5,ridge+1],[x+w-5,y+15],[x+w-10,y+26],[x+w*.5-2,ridge+10]], P.ink, 1);
  poly(c, masonry, [[x+w*.5,ridge],[x+w-9,y+15],[x+9,y+15]], P.ink, 2);
  c.save();
  c.beginPath();c.moveTo(x+w*.5,ridge+3);c.lineTo(x+w-12,y+14);c.lineTo(x+12,y+14);c.closePath();c.clip();
  brickwork(c,{x:x+8,y:ridge+3,w:w-16,h:y+14-ridge,seed:seed+350,
    colors:[masonry,masonry,masonry,'#985b5b'],brickW:13,brickH:6});
  poly(c,'#6e3d504b',[[x+w*.5+1,ridge],[x+w-9,y+15],[x+w*.5+24,y+15]]);
  c.restore();
  line(c,'#71384b',x+11,y+19,x+w-11,y+19,4);
  line(c,'#ffd08b',x+12,y+16,x+w-12,y+16,1);
  line(c, P.stone, x+7,y+14,x+w*.5,ridge-3,5);
  line(c, P.edge, x+7,y+12,x+w*.5,ridge-5,2);
  line(c, '#b27b60', x+w*.5,ridge-3,x+w-6,y+14,4);
  line(c, '#59394e', x+w*.5+2,ridge+2,x+w-6,y+17,2);
  const r = 6 + (seed % 2);
  ellipse(c, P.ink, x+w*.5, ridge+27, r+3, r+3);
  ellipse(c, P.stone, x+w*.5, ridge+27, r+1, r+1);
  ellipse(c, seed % 3 === 0 ? '#e5bd80' : '#4c4b62', x+w*.5, ridge+27, r-1, r-1);
  if (seed % 3 === 0) {
    line(c, P.deep,x+w*.5,ridge+21,x+w*.5,ridge+33,1);
    line(c, P.deep,x+w*.5-5,ridge+27,x+w*.5+5,ridge+27,1);
  } else {
    for (let yy=ridge+24;yy<=ridge+30;yy+=3)line(c,'#a78679',x+w*.5-4,yy,x+w*.5+4,yy,1);
  }
}

// Five-pixel capitals keep the small painted signs crisp at the scene's native grid.
const SIGN_GLYPHS = Object.freeze({
  A:['010','101','111','101','101'],B:['110','101','110','101','110'],
  C:['111','100','100','100','111'],D:['110','101','101','101','110'],
  E:['111','100','110','100','111'],F:['111','100','110','100','100'],
  H:['101','101','111','101','101'],K:['101','101','110','101','101'],
  I:['111','010','010','010','111'],V:['101','101','101','101','010'],
  L:['100','100','100','100','111'],M:['101','111','111','101','101'],
  N:['101','111','111','111','101'],O:['010','101','101','101','010'],
  Q:['010','101','101','111','011'],R:['110','101','110','101','101'],
  S:['111','100','111','001','111'],T:['111','010','010','010','010'],
  U:['101','101','101','101','111'],W:['101','101','111','111','101'],
  Y:['101','101','010','010','010'],4:['101','101','111','001','001']
});
function paintedSign(c, label, x, y, w, color = '#c9b192') {
  const left=Math.round(x+(w-label.length*4+1)/2);
  [...label].forEach((letter,i)=>(SIGN_GLYPHS[letter]||[]).forEach((row,yy)=>{
    [...row].forEach((pixel,xx)=>{if(pixel==='1')rect(c,color,left+i*4+xx,y+yy,1,1);});
  }));
}

function shopfront(c,x,base,w,seed,kind) {
  const florist=kind==='tea' && seed===71;
  const y=base-49, frame=florist?'#4b6258':kind==='tea'?'#365958':'#514353';
  const doorX=x+w-39, glassX=x+14, glassW=w-66;
  rect(c,'#3b3045',x+7,y+1,w-26,48);
  rect(c,frame,x+8,y+3,w-28,44);
  // A deep fascia, inset display and a panelled door share one continuous storefront.
  rect(c,'#302d40',x+9,y+1,w-30,11);
  rect(c,'#c4a17f',x+9,y+1,w-30,1);
  paintedSign(c,florist?'FLOWERS':kind==='tea'?'QUAY TEA':'BOOKS',x+10,y+4,w-32);
  rect(c,'#252f43',glassX-2,y+13,glassW+4,32);
  const glass=c.createLinearGradient(0,y+14,0,y+42);
  glass.addColorStop(0,'#354a63');glass.addColorStop(.52,'#63777c');glass.addColorStop(1,'#464955');
  rect(c,glass,glassX,y+14,glassW,28);
  const panes=florist?2:3,paneW=glassW/panes;
  c.save();c.beginPath();c.rect(glassX,y+14,glassW,28);c.clip();
  for(let pane=0;pane<panes;pane++) {
    const px=glassX+pane*paneW,pw=paneW-3;
    // Only the display and one occupied table are lit, leaving visible cool glass around them.
    if (kind==='books' || (!florist && pane===1)) {
      const glow=c.createRadialGradient(px+pw*.5,y+28,2,px+pw*.5,y+28,pw*.72);
      glow.addColorStop(0,'#e0ba7cbb');glow.addColorStop(1,'#d5a06a00');
      rect(c,glow,px+1,y+15,pw-1,26);
    }
    if (kind==='books') {
      for(const yy of [y+26,y+38]) {
        rect(c,'#b09679',px+3,yy,pw-5,2);
        for(let i=0;i<3;i++) {
          const hh=6+(pane+i+seed)%3,bx=px+4+i*7;
          rect(c,['#b68671','#6f8588','#c5ae7a'][(i+pane)%3],bx,yy-hh,5,hh);
          rect(c,'#d8b99a',bx,yy-hh+1,4,1);
        }
      }
    } else if (florist) {
      // Two grouped arrangements: tall leafy stems and low bouquets on a deep timber shelf.
      rect(c,'#806351',px+2,y+37,pw-3,4);
      for(let i=0;i<2;i++) {
        const bx=px+7+i*(pw-15),top=y+19+i*4;
        rect(c,i?'#b38c6e':'#9a6b58',bx-3,y+32,8,6);
        line(c,'#9caa75',bx+1,y+32,bx+1,top,2);
        poly(c,'#3d6757',[[bx,top+2],[bx-7,top],[bx-4,top+9],[bx,top+12],[bx+6,top+4],[bx+9,top+1]]);
        rect(c,pane?'#b98488':'#d0b288',bx-4,top-2,10,5);
        rect(c,pane?'#d2aaa2':'#e2c99b',bx-1,top-3,5,4);
      }
      rect(c,'#b8ae8f',px+3,y+15,pw-4,2);
    } else if (pane===0) {
      // A side curtain and a small dark bench frame the room rather than filling the pane.
      poly(c,'#a09a93',[[px+2,y+15],[px+9,y+15],[px+9,y+25],[px+6,y+31],[px+6,y+40],[px+2,y+40]]);
      line(c,'#777a80',px+5,y+16,px+5,y+28,1);
      rect(c,'#526371',px+12,y+32,pw-14,5);rect(c,'#354751',px+12,y+37,pw-14,4);
    } else if (pane===1) {
      const mx=px+pw*.5;
      line(c,'#b49b7a',mx,y+14,mx,y+18,1);
      poly(c,'#f1d4a0',[[mx-4,y+18],[mx+4,y+18],[mx+6,y+22],[mx-6,y+22]]);
      rect(c,'#8c6757',mx-11,y+33,22,3);line(c,'#4b414a',mx,y+36,mx,y+42,2);
      rect(c,'#dfc6a1',mx-7,y+30,4,3);rect(c,'#b7c7be',mx+3,y+30,4,3);
      for(const sx of [mx-13,mx+10])rect(c,'#3c4c58',sx,y+31,3,11);
    } else {
      rect(c,'#b49a78',px+3,y+31,pw-5,3);rect(c,'#584c51',px+4,y+34,pw-7,8);
      rect(c,'#bca98a',px+7,y+26,7,5);rect(c,'#496370',px+16,y+23,7,8);
      rect(c,'#cbb68b',px+17,y+23,5,2);
    }
    // A restrained diagonal sky reflection makes each opening read as glazing.
    poly(c,'#bec0c32e',[[px+2,y+15],[px+11,y+15],[px+5,y+40],[px+2,y+40]]);
    line(c,'#a7a2b355',px+2,y+19,px+pw,y+19,1);
  }
  c.restore();
  // Structural mullions separate complete panes; they are deliberately darker than the contents.
  for(let pane=1;pane<panes;pane++) {
    const mx=glassX+pane*paneW-1;
    rect(c,'#253d49',mx,y+14,3,29);rect(c,'#83928d',mx,y+15,1,26);
  }
  rect(c,'#252d40',doorX-2,y+12,23,34);
  rect(c,frame,doorX,y+14,19,30);rect(c,'#5e7780',doorX+3,y+16,13,12);
  rect(c,'#baa783',doorX+5,y+23,7,4);line(c,'#b2b9b4',doorX+3,y+17,doorX+3,y+26,1);
  rect(c,'#34464e',doorX+3,y+31,13,10);rect(c,'#233b43',doorX+5,y+33,9,6);
  rect(c,'#cdb17c',doorX+14,y+30,2,3);
  rect(c,'#bea080',x+9,base-4,w-30,3);rect(c,'#6c4a51',x+10,base-1,w-31,1);
}

function loadingDoor(c,x,y,w,h,seed) {
  rect(c,'#392b3e',x-3,y-4,w+6,h+4);
  rect(c,'#b79880',x-4,y-6,w+8,4);
  rect(c,seed%2?'#526666':'#685355',x,y,w,h);
  for(let xx=x+3;xx<x+w;xx+=6)line(c,'#39454f',xx,y+1,xx,y+h-2,1);
  for(const yy of [y+8,y+h-10]) {
    line(c,'#293b47',x+2,yy,x+w-2,yy,3);
    rect(c,'#a69780',x+3,yy-1,2,2);rect(c,'#a69780',x+w-5,yy-1,2,2);
  }
  line(c,'#2c3846',x+w*.5,y+1,x+w*.5,y+h-1,2);
  rect(c,'#bf9c68',x+w*.5-4,y+h*.6,2,3);rect(c,'#bf9c68',x+w*.5+3,y+h*.6,2,3);
  rect(c,'#c4ab90',x-3,y+h,w+6,2);
}

function warehouse(c, spec) {
  const {x, w, h, seed, bays = 4, gable = true, passage = false} = spec;
  const base = 662, y = base - h;
  const masonry = [
    ['#aa5c54','#b86a59','#a45953','#b36558'],
    ['#b37b65','#bd886c','#a97162','#b67f69'],
    ['#9f6664','#ad7470','#995d61','#a76e69'],
    ['#a75450','#b56555','#a25450','#af5d53'],
    ['#a19483','#afa28b','#988877','#a69a86']
  ][seed % 5];
  // Narrow cool return makes each volume read independently of its neighbours.
  rect(c, P.ink, x-2, y+12, w+5, h-10);
  rect(c, masonry[0], x, y+14, w-11, h-14);
  rect(c, '#7d414c', x+w-11, y+14, 11, h-14);
  brickwork(c, {x:x+2,y:y+17,w:w-16,h:h-18,seed,
    colors:masonry,brickW:14,brickH:7});
  // Light falls from upper left: the return and the cornice cast real shadows.
  const wallShade=c.createLinearGradient(x,0,x+w,0);
  wallShade.addColorStop(0,'#fabb6218');wallShade.addColorStop(.65,'#612e4b08');wallShade.addColorStop(1,'#50244188');
  c.fillStyle=wallShade;c.fillRect(x+1,y+20,w-14,h-20);
  poly(c,'#39274188',[[x+8,y+20],[x+w-10,y+20],[x+w-10,y+34],[x+18,y+26]]);
  for(let yy=y+42;yy<base-8;yy+=42) {
    line(c,'#efb076',x+13,yy,x+w-20,yy,1);
    line(c,'#733847',x+13,yy+2,x+w-20,yy+2,1);
  }
  // Horizontal floors and masonry pilasters organise the material.
  for (const yy of [base-15, base-61, y+66]) {
    rect(c, P.deep, x, yy+3, w, 4);
    rect(c, '#5c304955', x+7, yy+7, w-17, 3);
    rect(c, P.stone, x-3, yy, w+6, 3);
    rect(c, '#ffd68f',x-3,yy,w-4,1);
  }
  for (const px of [x+3,x+w-17]) {
    rect(c, '#d27d58', px, y+17, 8, h-17);
    line(c, P.edge, px, y+20, px, base-4, 1);
    for(let yy=y+23;yy<base;yy+=14)rect(c,'#9d4f4d',px+1,yy,6,1);
  }
  const gap=(w-34)/bays;
  for (let i=0;i<bays;i++) {
    const wx=x+20+i*gap, ww=Math.min(19,gap-9);
    // Shallow pilasters between bays turn the facade into an articulated volume.
    if(i>0) {
      rect(c,'#8f404a',wx-10,y+25,4,h-30);
      line(c,'#e69667',wx-9,y+25,wx-9,base-7,1);
    }
    glowWindow(c,wx,y+32,ww,Math.min(38,h*.24),{seed:seed+i,lit:(seed+i)%7<4,inhabited:true});
    if(h>142)glowWindow(c,wx,y+82,ww,31,{seed:seed+i+4,lit:(seed+i+2)%7<4,inhabited:true});
    // Timber shutters belong to a few converted houses, not every industrial bay.
    if ([57,87].includes(seed) && i % 2 === 0) {
      for(const sx of [wx-6,wx+ww+3]) {
        rect(c,'#49646a',sx,y+34,4,Math.min(35,h*.24-3));
        line(c,'#91a0a1',sx,y+35,sx,y+Math.min(35,h*.24),1);
        for(let sy=y+38;sy<y+Math.min(65,32+h*.24);sy+=5)line(c,'#314852',sx+1,sy,sx+3,sy,1);
      }
    }
    if (passage && (i===0 || i===bays-1)) {
      glowWindow(c,wx-2,base-43,ww+4,40,{seed:seed+i+8,inhabited:true});
    } else if (!passage && ![53,57,71].includes(seed) && i !== Math.floor(bays/2)) {
      glowWindow(c,wx,base-43,ww,38,{round:false,seed:seed+i+8,lit:(seed+i)%4===0,inhabited:true});
    }
  }
  if ([53,57,71].includes(seed)) shopfront(c,x,base,w,seed,seed===57?'books':'tea');
  else if (!passage) {
    const dw=Math.min(32,gap+1),dx=x+20+Math.floor(bays/2)*gap+(Math.min(19,gap-9)-dw)/2;
    loadingDoor(c,dx,base-42,dw,40,seed);
    if (seed===79) {
      rect(c,'#754a50',x+w*.5-25,base-58,50,9);
      paintedSign(c,'QUAY',x+w*.5-25,base-56,50);
    }
  }
  if ([60,67].includes(seed) && h>142) {
    // A supported service balcony gives the reused warehouse a readable iron silhouette.
    const bx=x+19,bw=w-45,by=y+117;
    poly(c,'#3a3045aa',[[bx+2,by+2],[bx+bw,by+2],[bx+bw+7,by+9],[bx+9,by+9]]);
    rect(c,'#b39782',bx-2,by,bw+4,3);rect(c,'#353c4c',bx-1,by-10,bw+2,2);
    for(let rx=bx+2;rx<bx+bw;rx+=8)line(c,'#39454f',rx,by-9,rx,by,1);
    line(c,'#a0a29b',bx,by-10,bx+bw,by-10,1);
    for(const sx of [bx+7,bx+bw-9])line(c,'#4d3e4d',sx,by+3,sx+7,by+11,2);
  }
  if (passage) {
    const pw=w*.43, px=x+w*.285;
    arch(c,px-5,base-61,pw+10,63,{fill:P.ink,stroke:P.stone,lineWidth:4});
    arch(c,px,base-56,pw,59,{fill:'#3e354c',stroke:'#96535a',lineWidth:2});
    // Receding passage: repeated ribs, a lit far opening and a festoon.
    for(let k=0;k<5;k++) {
      const inset=7+k*5;
      arch(c,px+inset,base-47+k*3,pw-2*inset,53-k*3,
        {fill:'#453446',stroke:'#b67e59',lineWidth:1});
    }
    rect(c,'#ffc15c',px+pw*.44,base-25,9,25);
    for(let i=0;i<7;i++)ellipse(c,'#ffe49c',px+8+i*(pw-16)/6,base-36+Math.sin(i/6*Math.PI)*10,2,2);
  }
  if(gable)roof(c,x,y+7,w,y-23-(seed%3)*4,seed,masonry[0]);
  else {
    poly(c,P.roof,[[x-5,y+13],[x+16,y-12],[x+w-16,y-12],[x+w+5,y+13]],P.ink,2);
    for(let yy=y-7;yy<y+12;yy+=5)line(c,P.roofLight,x+11,yy,x+w-13,yy,1);
    for(let i=0;i<3;i++){
      const dx=x+26+i*(w-49)/3;
      poly(c,P.brickDark,[[dx-2,y+10],[dx+2,y-1],[dx+13,y-1],[dx+17,y+10]],P.ink,1);
      glowWindow(c,dx+3,y+1,8,9,{round:false,seed:i});
      poly(c,P.roofLight,[[dx-2,y],[dx+7,y-8],[dx+17,y]],P.ink,1);
    }
  }
  // Chimneys, copper flashing and cornice shadows.
  rect(c,P.deep,x+18,y-24,13,27);rect(c,P.brickLight,x+19,y-25,8,25);
  rect(c,P.stone,x+16,y-27,17,4);
  for (const px of (seed%3===0?[x+19,x+25]:[x+21])) {
    rect(c,'#603a4b',px-1,y-34,5,9);rect(c,'#bc7a5f',px,y-34,3,7);
    rect(c,'#d3a184',px-1,y-35,5,2);
  }
  line(c,'#403a50',x-3,y+21,x+w-8,y+21,3);
  line(c,'#b5a090',x-3,y+20,x+w-8,y+20,1);
  line(c,P.edge,x,y+18,x+w-11,y+18,2);
  // A cast-iron downpipe with brackets belongs to the shaded return.
  line(c,'#542f48',x+w-7,y+17,x+w-7,base-3,3);
  line(c,'#ba7761',x+w-8,y+19,x+w-8,base-5,1);
  for(let yy=y+32;yy<base-8;yy+=32)rect(c,'#d28d67',x+w-10,yy,7,2);
  rect(c,'#d28d67',x-2,base-4,w+4,4);
}

function gasLamp(c,x,y=662) {
  rect(c,P.ink,x-3,y-43,6,43);rect(c,P.steelLight,x-1,y-38,1,35);
  rect(c,P.ink,x-6,y-5,12,5);
  poly(c,P.ink,[[x-7,y-57],[x+7,y-57],[x+5,y-44],[x-5,y-44]],P.ink,1);
  rect(c,'#ffbd43',x-4,y-55,8,10);rect(c,'#ffe8a2',x-2,y-54,3,8);
  poly(c,P.deep,[[x-8,y-58],[x,y-66],[x+8,y-58]],P.ink,1);
  line(c,P.edge,x-7,y-58,x,y-64,1);
}

function crane(c) {
  const x=3260;
  // A single structure; the cabin, mast and jib share world coordinates.
  rect(c,P.ink,x-74,652,150,10);rect(c,'#7f8c93',x-68,649,136,9);
  rect(c,P.steelDark,x-64,638,27,15);rect(c,P.steelDark,x+37,638,27,15);
  for(const s of [-1,1]) {
    const b=x+s*56,t=x+s*16;
    line(c,P.ink,b,647,t,522,13);
    line(c,P.steel,b,646,t,522,8);
    line(c,P.steelLight,b-2,645,t-2,523,2);
  }
  for(let i=0;i<4;i++) {
    const yy=543+i*27,spread=23+i*9;
    line(c,P.ink,x-spread,yy,x+spread,yy,8);
    line(c,P.steelLight,x-spread,yy,x+spread,yy,3);
    if(i<3) {
      line(c,P.ink,x-spread,yy,x+spread+9,yy+27,6);
      line(c,P.steel,x-spread,yy,x+spread+9,yy+27,3);
      line(c,P.steelLight,x+spread,yy,x-spread-9,yy+27,2);
    }
  }
  rect(c,P.ink,x-34,519,70,12);rect(c,P.steel,x-30,520,63,6);
  rect(c,P.ink,x-56,476,94,45);rect(c,P.steel,x-52,480,86,36);
  rect(c,'#408898',x-51,479,82,4);rect(c,P.steelLight,x-51,479,2,35);
  for(let i=0;i<4;i++)glowWindow(c,x-42+i*18,485,13,22,{round:false,seed:i});
  rect(c,P.steelDark,x-53,510,86,5);rect(c,P.steelLight,x+29,481,3,28);
  rect(c,P.ink,x-42,470,67,6);rect(c,'#81b4b8',x-40,470,60,2);
  // High tie mast and A-frame load path.
  line(c,P.ink,x-31,474,x+16,414,8);line(c,P.steelLight,x-31,474,x+16,414,3);
  line(c,P.ink,x+18,475,x+16,414,9);line(c,P.steel,x+18,475,x+16,414,4);
  const ax=x+16,ay=414,bx=3610,by=394;
  // Two truss chords and deliberately alternating diagonals.
  for(const off of [0,25]) {
    line(c,P.ink,ax,ay+off,bx,by+(off?7:0),7);
    line(c,off?P.steel:P.steelLight,ax,ay+off,bx,by+(off?7:0),3);
  }
  const n=12;
  for(let i=0;i<n;i++) {
    const t=i/n,u=(i+1)/n;
    const xx=ax+(bx-ax)*t,yy=ay+(by-ay)*t;
    const xxx=ax+(bx-ax)*u,yyy=ay+(by-ay)*u;
    line(c,P.ink,xx,yy+(i%2?25-18*t:0),xxx,yyy+(i%2?0:25-18*u),5);
    line(c,P.steelLight,xx,yy+(i%2?25-18*t:0),xxx,yyy+(i%2?0:25-18*u),2);
  }
  line(c,P.ink,x+16,414,x+34,476,7);line(c,P.steelLight,x+16,414,x+34,476,2);
  for(const [xx,yy] of [[ax,ay],[bx,by+3]]){
    ellipse(c,P.ink,xx,yy,7,7);ellipse(c,P.steelLight,xx,yy,5,5);ellipse(c,P.steelDark,xx,yy,2,2);
  }
  // Service ladder and operator platform.
  line(c,P.ink,x+38,525,x+62,644,3);line(c,P.ink,x+45,525,x+69,644,3);
  for(let i=0;i<12;i++)line(c,P.steelLight,x+39+i*2,529+i*10,x+45+i*2,529+i*10,1);
  line(c,P.steelLight,x-62,470,x+44,470,2);
  for(let xx=x-62;xx<x+45;xx+=14)line(c,P.steelLight,xx,462,xx,471,1);
  line(c,P.steelLight,x-62,462,x+44,462,1);
}

function indoorPalm(c,x,y,size=1) {
  line(c,'#8b664e',x,y,x+3*size,y-37*size,3*size);
  const shades=['#9a783a','#6b6142','#8c783b'];
  for(let k=-3;k<=3;k++){
    const xx=x+k*9*size, yy=y-(35-Math.abs(k)*3)*size;
    line(c,shades[Math.abs(k)%3],x+3*size,y-36*size,xx,yy,3*size);
    line(c,'#b3a04c',x+3*size,y-36*size,xx,yy-3*size,size);
  }
  poly(c,'#825944',[[x-6*size,y],[x+7*size,y],[x+5*size,y+9*size],[x-4*size,y+9*size]]);
}

function aircraftHullPath(c,x,y) {
  c.beginPath();c.moveTo(x+29,y+2);c.bezierCurveTo(x+69,y-5,x+227,y-8,x+256,y-2);
  c.bezierCurveTo(x+269,y+1,x+281,y+9,x+286,y+15);
  c.bezierCurveTo(x+265,y+25,x+96,y+29,x+35,y+13);
  c.lineTo(x+3,y+5);c.closePath();
}

function plane(c, gear = 1, doorOpen = 1) {
  const { x, y, door } = AIRPORT.plane;
  // The main gear is also the physical pitch pivot during rotation. Retraction
  // shortens the strut into its bay; the wheel never slides independently.
  for(const px of [x+87,x+255]) {
    if(gear>.015){
      const extension=21*gear,wy=y+24+extension;
      rect(c,'#696d88',px,y+24,4,extension);
      line(c,'#c0b8c2',px+1,y+25,px+1,wy-3,1);
      ellipse(c,P.ink,px+2,wy,6*gear,6*gear);
      ellipse(c,'#b8b3bf',px+2,wy,2*gear,2*gear);
    }
  }
  poly(c,'#1d4b80',[[x+29,y+4],[x+3,y-56],[x+38,y-51],[x+76,y+4]],P.ink,2);
  poly(c,'#5597c5',[[x+8,y-52],[x+17,y-52],[x+58,y+3],[x+49,y+3]],P.ink,1);
  line(c,'#f9dbb3',x+3,y-57,x+38,y-52,2);
  poly(c,'#bfc0d1',[[x+55,y+4],[x+166,y-15],[x+197,y-12],[x+136,y+12]],P.ink,1);
  // Three restrained value planes keep the small aircraft legible in the climb.
  const hull=c.createLinearGradient(0,y-5,0,y+26);
  hull.addColorStop(0,'#fff0d8');hull.addColorStop(.38,'#f1d6ca');
  hull.addColorStop(.72,'#c8b3c0');hull.addColorStop(1,'#8d859f');
  c.fillStyle=hull;c.strokeStyle=P.ink;c.lineWidth=2;
  aircraftHullPath(c,x,y);c.fill();c.stroke();
  line(c,'#fff0d9',x+43,y+2,x+243,y-2,2);
  line(c,'#a498b1',x+50,y+19,x+263,y+19,3);
  line(c,'#655f80',x+56,y+24,x+261,y+21,2);
  poly(c,'#284968',[[x+249,y+1],[x+261,y+4],[x+272,y+12],[x+249,y+9]],P.ink,1);
  for(let i=0;i<20;i++){
    const wx=x+66+i*8;
    rect(c,P.ink,wx,y+3,4,7);rect(c,'#e2bfa8',wx+1,y+4,1,4);
  }
  // The boarding opening keeps its exact anchors and foreground occlusion.
  // Its deep frame fades as the closed panel becomes flush with the hull.
  if(doorOpen>0){
    c.save();c.globalAlpha*=doorOpen;
    rect(c,'#b0a0b6',door.x-2,door.y-2,door.width+4,door.height+4);
    rect(c,'#303044',door.x,door.y,door.width,door.height);
    rect(c,'#51425a',door.x+3,door.y+3,door.width-6,door.height-4);
    rect(c,'#dbbb8a',door.x+3,door.y+2,door.width-6,2);
    rect(c,'#fae3b7',door.x+door.width-2,door.y+1,2,door.height-1);
    rect(c,'#d8bc9a',door.x-2,door.thresholdY,door.width+5,3);
    c.restore();
  }
  if(doorOpen<1){
    const closedWidth=door.width*(1-doorOpen),left=door.x+door.width-closedWidth;
    // Clip to the fuselage silhouette: the closed door cannot protrude as a tab.
    c.save();aircraftHullPath(c,x,y);c.clip();
    rect(c,hull,left,door.y,closedWidth,door.height);
    line(c,'#a393a5',left,door.y+3,left,door.y+door.height-3,1);
    if(closedWidth>7){
      rect(c,'#858397',door.x+door.width-6,door.y+5,3,7);
      rect(c,'#d6c1ba',door.x+door.width-5,door.y+6,1,4);
      rect(c,'#9b899e',door.x+door.width-6,door.y+door.height*.62,3,1);
    }
    line(c,'#b09eae',door.x,door.y+door.height-3,door.x+door.width,door.y+door.height-3,1);
    c.restore();
  }
  poly(c,'#e4c6c1',[[x+121,y+13],[x+210,y+16],[x+178,y+34],[x+139,y+30]],P.ink,2);
  poly(c,'#c1b1c2',[[x+141,y+29],[x+180,y+32],[x+173,y+36],[x+149,y+36]],P.ink,1);
  ellipse(c,P.ink,x+190,y+27,17,10);ellipse(c,'#cec8ce',x+189,y+26,15,8);
  ellipse(c,'#50617e',x+198,y+26,7,7);ellipse(c,'#242e48',x+200,y+26,4,5);
  line(c,'#fff1dc',x+176,y+22,x+192,y+20,2);
}

function boardingStairs(c, foreground = false) {
  const { bottom, top, width, steps, path } = AIRPORT.stairs;
  const dx=top.x-bottom.x,dy=top.y-bottom.y,len=Math.hypot(dx,dy);
  // Width recedes into the apron, independently of the climb's side elevation.
  // A perpendicular in screen space made each tread look like a tall panel.
  const normal={x:.8,y:-.45};
  const edge=(point,side)=>[point.x+normal.x*width*.5*side,point.y+normal.y*width*.5*side];
  const nearBottom=edge(bottom,-1),nearTop=edge(top,-1),farBottom=edge(bottom,1),farTop=edge(top,1);
  const rail=(a,b,near)=>{
    const height=near?17:15;
    for(let i=0;i<=5;i++){
      const t=i/5,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      line(c,near?'#45465b':'#697083',x,y,x,y-height,2);
      line(c,'#d6c9bd',x-1,y-1,x-1,y-height,1);
    }
    line(c,near?'#30364f':'#65748b',a[0],a[1]-height,b[0],b[1]-height,3);
    line(c,'#e0c7ab',a[0],a[1]-height-1,b[0],b[1]-height-1,1);
  };
  if(foreground){rail(nearBottom,nearTop,true);return;}
  // Open supporting frame. There is no large ramp panel in front of the steps.
  ellipse(c,'#3c3a4f55',(bottom.x+top.x)/2,675,len*.48,3);
  for(const t of [.18,.79]){
    const x=bottom.x+dx*t;
    line(c,'#4a465d',x,650+26*(1-t),x,671,3);
    ellipse(c,'#2b3249',x,674,4,3);
  }
  for(let i=0;i<steps;i++){
    const a=path[i*2],low=path[i*2+1],high=path[i*2+2];
    const nearA=edge(a,-1),farA=edge(a,1),nearLow=edge(low,-1),farLow=edge(low,1);
    const nearHigh=edge(high,-1),farHigh=edge(high,1);
    // Each horizontal tread has its own top face; each vertical riser has a dark face.
    poly(c,i%2?'#ccbcaa':'#d9c7af',[nearA,farA,farLow,nearLow],'#8c7d83',.7);
    poly(c,'#6b627a',[nearLow,farLow,farHigh,nearHigh],'#514c65',.7);
    line(c,'#f2dcc0',nearLow[0],nearLow[1],farLow[0],farLow[1],1);
    // The exposed near profile is stepped, rather than hidden under a sloping fascia.
    line(c,'#615469',nearA[0],nearA[1]+2,nearLow[0],nearLow[1]+2,2);
    line(c,'#594b62',nearLow[0],nearLow[1]+2,nearHigh[0],nearHigh[1]+2,2);
  }
  rail(farBottom,farTop,false);
}

function airportEquipment(c) {
  // Tower beacon: the radar head remains static in this version.
  const x=4050;
  rect(c,P.ink,x-5,491,10,171);rect(c,'#858296',x-2,494,4,167);
  rect(c,P.ink,x-19,482,38,11);rect(c,P.stone,x-16,484,32,4);
  for(let xx=x-17;xx<=x+18;xx+=7)line(c,P.ink,xx,470,xx,482,2);
  line(c,P.ink,x-20,470,x+21,470,2);
  poly(c,'#ede2d5',[[x-17,456],[x+23,451],[x+25,458],[x-16,464]],P.ink,2);
  rect(c,P.steelDark,x-3,463,8,7);ellipse(c,'#f5b95f',x-18,479,2,2);
  // The mobile stair is drawn in the dynamic ground pass, on its original anchors.
  // A permanent service bay behind the parked aircraft's tail keeps the
  // rightward departure lane clear before, during and after the take-off.
  const tx=4260;
  rect(c,P.ink,tx-2,644,48,15);rect(c,'#d6a853',tx,643,43,13);
  poly(c,'#efc662',[[tx+3,644],[tx+10,631],[tx+32,631],[tx+40,645]],P.ink,2);
  rect(c,'#3c617d',tx+12,634,17,10);
  for(const xx of [tx+8,tx+34]){ellipse(c,P.ink,xx,658,6,6);ellipse(c,'#9298ac',xx,658,2,2);}
  for(let i=0;i<2;i++){
    const xx=4380+i*66;
    rect(c,P.ink,xx,642,50,17);rect(c,'#b6a7b8',xx+2,644,46,11);
    rect(c,'#e6d1bd',xx+5,629,37,15);
    for(let yy=631;yy<644;yy+=3)line(c,'#95869e',xx+6,yy,xx+41,yy,1);
    for(const dx of [8,41])ellipse(c,P.ink,xx+dx,660,4,4);
    line(c,P.ink,xx+50,655,xx+63,655,2);
  }
}

function terminal(c) {
  const x=4120,w=1550;
  const roofLine=[[x-12,540],[x+145,517],[x+570,497],[x+1120,482],[x+1415,491],[x+w+5,514]];
  const outline=[[x,554],[x+145,531],[x+570,511],[x+1120,496],[x+1415,505],[x+w,528],[x+w,662],[x,662]];
  const topAt=xx=>{
    for(let i=1;i<roofLine.length;i++)if(xx<=roofLine[i][0]){
      const a=roofLine[i-1],b=roofLine[i],t=(xx-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t+16;
    }
    return 530;
  };
  // The interior sits behind the curtain wall. Dark bays leave room for pools of light.
  poly(c,'#263a56',outline,P.ink,2);
  c.save();c.beginPath();outline.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.closePath();c.clip();
  const distantWall=c.createLinearGradient(0,506,0,662);
  distantWall.addColorStop(0,'#2d3c60');distantWall.addColorStop(.3,'#58617c');
  distantWall.addColorStop(.55,'#9b7484');distantWall.addColorStop(1,'#635361');
  c.fillStyle=distantWall;c.fillRect(x,488,w,180);
  for(let i=0;i<15;i++){
    const xx=x+8+i*104,ty=topAt(xx),hot=[2,3,7,11,12].includes(i);
    const room=c.createLinearGradient(0,ty,0,662);
    room.addColorStop(0,hot?'#4a425d':'#303d5a');
    room.addColorStop(.44,hot?'#a8796d':'#665a73');
    room.addColorStop(.7,hot?'#edb95b':'#a38a7a');
    room.addColorStop(1,hot?'#c48748':'#68565f');
    c.fillStyle=room;c.fillRect(xx+3,ty+6,96,662-ty);
    // Receding ceiling ribs and their shadows belong to the building volume.
    poly(c,'#232d48aa',[[xx,ty],[xx+102,ty-4],[xx+89,ty+17],[xx+8,ty+23]]);
    line(c,'#aaa4a26b',xx+8,ty+17,xx+89,ty+13,1);
    line(c,'#323750',xx+12,ty+13,xx+39,602,4);
    line(c,'#aa9b94',xx+10,ty+15,xx+37,600,1);
    if(hot){
      // Warm ceiling strips do not brighten the full facade to the same value.
      rect(c,'#5c4c53',xx+20,ty+33,48,5);
      rect(c,'#f1c469',xx+23,ty+33,41,2);
      rect(c,'#fff0ad',xx+28,ty+33,30,1);
      poly(c,'#ffca5f12',[[xx+25,ty+37],[xx+64,ty+37],[xx+92,658],[xx+1,658]]);
    }
    // A lower gallery, recesses and a handful of readable counters.
    rect(c,'#313850',xx+4,609,92,8);
    rect(c,hot?'#bc9865':'#736777',xx+5,609,90,2);
    for(let rail=xx+9;rail<xx+94;rail+=14)line(c,'#26354c',rail,610,rail,618,1);
    if(i%3===0){
      rect(c,'#3c394d',xx+18,626,56,31);
      rect(c,hot?'#d1a354':'#8b7b70',xx+23,631,46,24);
      rect(c,'#34334a',xx+25,626,43,8);
      rect(c,'#cab68d',xx+29,628,21,1);
      rect(c,'#7a604e',xx+26,648,41,6);
    } else if(i%3===1){
      for(let seat=0;seat<4;seat++){
        const sx=xx+13+seat*17;
        rect(c,'#334254',sx,644,12,5);rect(c,'#4e535c',sx+1,639,10,6);
        line(c,'#c5aa83',sx+2,648,sx+2,655,1);line(c,'#34384e',sx+10,648,sx+10,655,1);
      }
      indoorPalm(c,xx+82,645,.7);
    } else {
      rect(c,'#2b3e58',xx+54,631,13,12);rect(c,'#74acb5',xx+56,633,9,5);
      line(c,'#333549',xx+60,643,xx+60,658,2);
      indoorPalm(c,xx+22,645,.83);
    }
    if(hot&&i%2===0){
      ellipse(c,'#bd8f72',xx+72,638,2,3);rect(c,'#37445e',xx+69,641,6,10);
      line(c,'#303449',xx+70,651,xx+69,659,2);line(c,'#303449',xx+73,651,xx+75,659,2);
    }
    // The interior floor has depth, but is not another foreground grid.
    poly(c,hot?'#edb65c55':'#8b798844',[[xx,651],[xx+100,651],[xx+94,662],[xx+2,662]]);
    if(i%2===0)line(c,'#b8957355',xx+19,652,xx+12,662,1);
  }
  // Exterior sunset reflections are broad, broken planes over the interior.
  for(const [offset,width,shade] of [[43,155,'#af8cbb35'],[317,221,'#f4b58d25'],[692,146,'#6e78a35a'],[981,184,'#ffad7f25'],[1272,150,'#9f92ba50']]){
    const xx=x+offset,ty=topAt(xx);
    poly(c,shade,[[xx,ty+3],[xx+width,ty-5],[xx+width-29,611],[xx-30,622]]);
  }
  // Structural piers are strong; the smaller mullions remain quiet and thin.
  for(let i=0;i<=60;i++){
    const xx=x+9+i*26,ty=topAt(xx);
    if(i%4===0){
      line(c,'#25334c',xx+3,ty,xx+3,664,7);
      line(c,'#8b8e9c',xx,ty+1,xx,660,2);
      line(c,'#d9c6ab',xx-1,ty+5,xx-1,660,1);
    }else line(c,i%2?'#657089':'#535b79',xx,ty+2,xx,660,1);
  }
  for(const yy of [566,618]){
    line(c,'#36465e',x,yy,x+w,yy,3);
    line(c,'#bdaba155',x,yy+2,x+w,yy+2,1);
  }
  // An inward shadow under the roof makes the glass recede behind its edge.
  const shadow=roofLine.map(([xx,yy])=>[xx,yy+16]).concat([...roofLine].reverse().map(([xx,yy])=>[xx,yy+27]));
  poly(c,'#1b2844b5',shadow);
  c.restore();
  // Roof thickness: upper metal plane, shaded front fascia and a thin sunlit seam.
  const roofTop=roofLine.concat([...roofLine].reverse().map(([xx,yy])=>[xx,yy+10]));
  const roofFace=roofLine.map(([xx,yy])=>[xx,yy+10]).concat([...roofLine].reverse().map(([xx,yy])=>[xx,yy+20]));
  poly(c,'#b8a8b4',roofTop,'#30334c',2);poly(c,'#65637e',roofFace,'#30334c',1);
  for(let i=1;i<roofLine.length;i++){
    const a=roofLine[i-1],b=roofLine[i];
    line(c,i<3?'#ffe0b4':'#dcc7bd',a[0],a[1]+1,b[0],b[1]+1,2);
    line(c,'#88849a',a[0],a[1]+11,b[0],b[1]+11,1);
    line(c,'#292f4c',a[0],a[1]+20,b[0],b[1]+20,2);
  }
  // A deep base ties the curtain wall to the apron, with supports under the piers.
  rect(c,'#3c3e54',x-2,658,w+5,9);rect(c,'#c09378',x,658,w,2);
  for(let xx=x+8;xx<x+w;xx+=104){rect(c,'#4b455c',xx,662,13,15);rect(c,'#b18a73',xx,663,3,12);}
  // The arrival vestibule is one bright focal point, recessed behind a thick canopy.
  const ex=5338;
  rect(c,'#2a3047',ex-3,602,137,64);rect(c,'#65525b',ex+3,608,125,54);
  for(let i=0;i<4;i++){
    const dx=ex+10+i*28;
    rect(c,'#3c4056',dx,612,25,49);rect(c,i===1||i===2?'#efc371':'#b09b7e',dx+3,614,18,44);
    line(c,'#f4deb0',dx+3,614,dx+3,658,1);rect(c,'#5c5a65',dx+16,638,2,5);
  }
  poly(c,'#6b627b',[[ex-13,598],[ex+128,594],[ex+146,601],[ex+146,610],[ex-13,614]],P.ink,2);
  poly(c,'#c4adb0',[[ex-13,598],[ex+128,594],[ex+146,601],[ex-13,605]],P.ink,1);
  line(c,'#ffe0ac',ex-13,598,ex+128,594,2);
  paintedSign(c,'RIVER AIR',ex-6,605,144,'#e1c8a5');
  // Lower annex: a shaded stone return and grouped pools of light.
  const ax=5635;
  rect(c,'#3d3a53',ax,578,366,85);rect(c,'#916760',ax+2,583,360,77);
  for(let i=0;i<12;i++)glowWindow(c,ax+13+i*29,594,20,62,{round:false,seed:i+31,lit:i%7<4,inhabited:true});
  poly(c,'#786a83',[[ax-12,572],[ax+350,562],[ax+368,570],[ax+366,586],[ax-10,589]],P.ink,2);
  line(c,'#dfc1af',ax-10,573,ax+349,563,2);
  const apron=AIRPORT.apron;
  rect(c,'#a48b91',apron.x,apron.y,apron.width,apron.depth);
  rect(c,'#d7ae92',apron.x,apron.y,apron.width,3);
  rect(c,'#62536c',apron.x,apron.y+apron.depth-3,apron.width,3);
  // Sparse paving seams stay behind the walking route, not across its surface every pixel.
  for(let xx=apron.x+12;xx<apron.x+apron.width;xx+=82)line(c,'#776b7a',xx,apron.y+5,xx-5,apron.y+apron.depth-4,1);
  line(c,'#ddbb8b',AIRPORT.route.bridgeEnd.x-42,676,AIRPORT.route.stairBottom.x+24,676,1);
  airportEquipment(c);
  for(const lx of [4455,5110,5880]){
    rect(c,P.ink,lx-3,488,6,174);rect(c,'#a39ba9',lx-1,491,2,169);
    rect(c,'#323549',lx-19,478,40,14);rect(c,'#e4ad53',lx-16,481,14,8);rect(c,'#fff0ac',lx-13,482,9,5);
    rect(c,'#d8a45a',lx+4,481,14,8);rect(c,'#fff0ac',lx+7,482,9,5);
  }
}

/** Stable world architecture. The engine caches and clips this drawing. */
export function drawDocks(c, range = {left:-Infinity, right:Infinity}) {
  const intersects = (left,right) => right >= range.left && left <= range.right;
  const buildings = [
    {x:1650,w:145,h:133,seed:51,bays:4},
    {x:1798,w:173,h:171,seed:53,bays:5},
    {x:1973,w:155,h:153,seed:57,bays:4},
    {x:2130,w:187,h:173,seed:60,bays:5},
    {x:2318,w:164,h:135,seed:61,bays:4,gable:false},
    {x:2484,w:203,h:149,seed:63,bays:5,passage:true,gable:false},
    {x:2689,w:172,h:160,seed:67,bays:4},
    {x:2863,w:164,h:144,seed:71,bays:4},
    {x:3029,w:164,h:137,seed:73,bays:4,gable:false},
    {x:3335,w:156,h:117,seed:79,bays:4},
    {x:3493,w:143,h:129,seed:83,bays:3},
    {x:3638,w:147,h:119,seed:87,bays:3},
    {x:3790,w:175,h:104,seed:89,bays:5,gable:false}
  ];
  buildings.filter(spec=>intersects(spec.x-12,spec.x+spec.w+12)).forEach(spec=>warehouse(c,spec));
  for(const xx of [1720,2040,2380,2750,3090,3420,3720,3980])
    if(intersects(xx-12,xx+12))gasLamp(c,xx);
  if(intersects(3180,3620))crane(c);
  if(intersects(4025,6010))terminal(c);
}

/** Only the suspended hook moves; all structural members remain rigid. */
export function drawDockMotion(c,time,range = {left:-Infinity, right:Infinity}) {
  if(range.right < 3595 || range.left > 3625)return;
  const topX=3610,topY=399;
  const angle=Math.sin(time*.62)*.035;
  const xx=topX+Math.sin(angle)*67,yy=topY+Math.cos(angle)*67;
  c.beginPath();c.moveTo(topX-2,topY);c.lineTo(xx-2,yy);
  c.strokeStyle=P.ink;c.lineWidth=3;c.stroke();
  c.beginPath();c.moveTo(topX,topY);c.lineTo(xx,yy);
  c.strokeStyle=P.steelLight;c.lineWidth=1;c.stroke();
  c.save();c.translate(xx,yy);
  rect(c,P.ink,-4,-2,8,10);rect(c,'#71b0b5',-2,0,3,5);
  c.strokeStyle=P.ink;c.lineWidth=4;c.beginPath();
  c.moveTo(0,7);c.lineTo(0,11);c.arc(-3,11,3,0,Math.PI);c.stroke();
  c.strokeStyle=P.steelLight;c.lineWidth=1;c.beginPath();
  c.moveTo(0,7);c.lineTo(0,11);c.arc(-3,11,3,0,Math.PI);c.stroke();c.restore();
}

function bridgeVisible(range) { return range.right >= 4480 && range.left <= 5425; }

/** Shared anchor geometry defines both the surface and the passenger's feet. */
export function drawFootbridgeDeck(c,range={left:-Infinity,right:Infinity}) {
  if(!bridgeVisible(range))return;
  const b=AIRPORT.bridge,pt=p=>[p.x,p.y];
  for(const t of b.pierFractions){
    const p=bridgePoint(t),pw=22*(1-t)+10,h=31+20*(1-t);
    rect(c,'#584158',p.x-pw/2,p.y+8,pw,h);
    rect(c,'#ac775e',p.x-pw/2,p.y+8,pw*.53,h);
    rect(c,'#dbab7a',p.x-pw/2,p.y+8,2,h);
    for(let yy=p.y+16;yy<p.y+8+h;yy+=8)line(c,'#694357',p.x-pw/2,yy,p.x+pw/2,yy,1);
    rect(c,'#efba79',p.x-pw/2-3,p.y+h+6,pw+6,3);
    // Independent pier reflections stop at the water, separate from the far-city cache.
    for(let j=0;j<5;j++){
      c.globalAlpha=.2-j*.025;
      rect(c,j%2?'#b79b97':'#b48676',p.x-pw/2+(j%2)*3,p.y+h+14+j*5,pw-3+j,2);
    }
    c.globalAlpha=1;
  }
  const quad=[pt(b.nearLeft),pt(b.nearRight),pt(b.farRight),pt(b.farLeft)];
  const fascia=[pt(b.nearRight),[b.nearRight.x,b.nearRight.y+9],[b.farRight.x,b.farRight.y+7],pt(b.farRight)];
  poly(c,'#aa7d75',quad,'#4c3f58',2);
  poly(c,'#d3a17d',[pt(b.nearLeft),[b.nearLeft.x+45,b.nearLeft.y],pt(b.farLeft)],undefined);
  // A broad illuminated plane and a quieter cool return replace equal-weight outlines.
  const light=c.createLinearGradient(b.nearLeft.x,b.nearLeft.y,b.nearRight.x,b.nearRight.y);
  light.addColorStop(0,'#eac09a');light.addColorStop(.45,'#c9977d');light.addColorStop(1,'#ab7d7a');
  c.save();c.beginPath();quad.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  c.fillStyle=light;c.fillRect(4480,670,950,280);
  for(let i=1;i<19;i++){
    const t=i/19,a=bridgePoint(t,0),d=bridgePoint(t,1);
    line(c,i%3?'#957076':'#e4b58d',a.x,a.y,d.x,d.y,1);
    for(let k=1;k<4;k++){
      const across=(k+(i%2)*.5)/4;if(across>=1)continue;
      const p=bridgePoint(t,across),q=bridgePoint(Math.min(1,t+1/19),across);
      line(c,'#a87c78',p.x,p.y,q.x,q.y,1);
    }
  }
  // Shade from the near handrail remains attached to the same deck.
  poly(c,'#403c622a',[pt(b.nearRight),[b.nearRight.x-30,b.nearRight.y],pt(b.farRight)]);
  c.restore();
  poly(c,'#6d4f63',fascia,'#3a3550',1);
  line(c,'#f4c48f',b.nearLeft.x,b.nearLeft.y,b.farLeft.x,b.farLeft.y,2);
  line(c,'#d0a28b',b.nearRight.x,b.nearRight.y,b.farRight.x,b.farRight.y,2);
  // This short inclined landing joins promenade y958 to bridge y937 continuously.
  poly(c,'#b89288',[[b.nearLeft.x-7,958],[b.nearRight.x+7,958],pt(b.nearRight),pt(b.nearLeft)],'#796276',1);
  line(c,'#e4b892',b.nearLeft.x-7,958,b.nearRight.x+7,958,1);
  const end=AIRPORT.route.bridgeEnd;
  rect(c,'#c5a28f',end.x-42,end.y-2,84,6);
}

function bridgeRail(c,nearEdge,farEdge,near){
  const h0=near?49:43,h1=near?16:14;
  for(let i=0;i<=17;i++){
    const t=i/17,x=nearEdge.x+(farEdge.x-nearEdge.x)*t,y=nearEdge.y+(farEdge.y-nearEdge.y)*t,h=h0+(h1-h0)*t;
    line(c,near?'#34384f':'#4a526c',x,y,x,y-h,near?4*(1-t)+1.5:3*(1-t)+1);
    line(c,near?'#b6b7be':'#a4b1b8',x+1,y-2,x+1,y-h+2,1);
    if(near)rect(c,'#c9aaa0',x-3*(1-t)-1,y-1,6*(1-t)+2,2);
  }
  line(c,near?'#2b334b':'#4c6078',nearEdge.x,nearEdge.y-h0,farEdge.x,farEdge.y-h1,near?6:4);
  line(c,near?'#f3c58d':'#b8c2c2',nearEdge.x,nearEdge.y-h0-1,farEdge.x,farEdge.y-h1-1,near?2:1);
  line(c,near?'#526780':'#79869a',nearEdge.x,nearEdge.y-h0*.52,farEdge.x,farEdge.y-h1*.52,near?2:1);
}
export function drawFootbridgeFarRail(c,range={left:-Infinity,right:Infinity}){
  if(bridgeVisible(range))bridgeRail(c,AIRPORT.bridge.nearLeft,AIRPORT.bridge.farLeft,false);
}
export function drawFootbridgeNearRail(c,range={left:-Infinity,right:Infinity}){
  if(bridgeVisible(range))bridgeRail(c,AIRPORT.bridge.nearRight,AIRPORT.bridge.farRight,true);
}
/** Compatibility composition for the art-only pass. The runtime can now insert an actor between rails. */
export function drawFootbridge(c,range={left:-Infinity,right:Infinity}){
  drawFootbridgeDeck(c,range);drawFootbridgeFarRail(c,range);drawFootbridgeNearRail(c,range);
}
/** Default values also make the draw API useful before a departure is started. */
function aircraftState(departure) {
  const d=departure||{};
  const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
  return {
    active:!!d.active, finished:!!d.finished,
    offsetX:finite(d.offsetX,0),offsetY:finite(d.offsetY,0),
    angleRadians:finite(d.angleRadians,0),scale:Math.max(.01,finite(d.scale,1)),
    gear:Math.max(0,Math.min(1,finite(d.gear,1))),
    doorOpen:Math.max(0,Math.min(1,finite(d.doorOpen,1))),
    // During boarding the stair is mechanically attached to its fixed anchors.
    stairsOffset:d.active?finite(d.stairsOffset,0):0,
  };
}

function aircraftTransform(c,d) {
  const pivot={x:AIRPORT.plane.x+89,y:AIRPORT.plane.y+45};
  c.translate(pivot.x+d.offsetX,pivot.y+d.offsetY);
  c.rotate(d.angleRadians);c.scale(d.scale,d.scale);
  c.translate(-pivot.x,-pivot.y);
}

function aircraftVisible(d,range) {
  const {x,y}=AIRPORT.plane,pivot={x:x+89,y:y+45};
  const cs=Math.cos(d.angleRadians),sn=Math.sin(d.angleRadians);
  const xs=[[-12,-64],[302,-64],[302,58],[-12,58]].map(([xx,yy])=>
    pivot.x+d.offsetX+((x+xx-pivot.x)*cs-(y+yy-pivot.y)*sn)*d.scale);
  return Math.max(...xs)>=range.left&&Math.min(...xs)<=range.right;
}

/**
 * Ground projection and the withdrawing mobile stair, before aircraft and actor.
 * The shadow stays on apron y675 when the aircraft rises. Its contrast decreases
 * with altitude instead of following the aircraft into the sky.
 */
export function drawAircraftGround(c,departure,range={left:-Infinity,right:Infinity}) {
  const d=aircraftState(departure),{x}=AIRPORT.plane;
  const altitude=Math.max(0,-d.offsetY),fade=Math.exp(-altitude/240);
  const projectedX=x+150+d.offsetX;
  if(!d.finished&&fade>.015&&projectedX+170>=range.left&&projectedX-170<=range.right){
    c.save();
    const spread=(.76+.24*fade)*d.scale;
    for(let i=3;i>=0;i--){
      c.globalAlpha=(.025+fade*.022)*(1-i*.12);
      ellipse(c,'#272738',projectedX,675,137*spread+i*5,3.5+i*1.8);
    }
    c.restore();
  }
  if(range.right>=4845+d.stairsOffset&&range.left<=5025+d.stairsOffset){
    c.save();c.translate(d.stairsOffset,0);boardingStairs(c,false);c.restore();
  }
}

/**
 * One articulated aircraft in world coordinates. The caller applies the camera
 * translation once; offsets, pitch and scale then share the main-wheel pivot.
 */
export function drawAircraft(c,departure,range={left:-Infinity,right:Infinity}) {
  const d=aircraftState(departure);
  if(d.finished||!aircraftVisible(d,range))return;
  c.save();aircraftTransform(c,d);plane(c,d.gear,d.doorOpen);c.restore();
}

/** Draw after the passenger: near stair rail and the boarding doorway's frame. */
export function drawAirportForeground(c,range={left:-Infinity,right:Infinity},departure){
  const d=aircraftState(departure);
  if(range.right>=4845+d.stairsOffset&&range.left<=5025+d.stairsOffset){
    c.save();c.translate(d.stairsOffset,0);boardingStairs(c,true);c.restore();
  }
  // Once the cabin is occupied the complete frame travels with the aircraft.
  // While boarding it remains a foreground occluder at the original threshold.
  if(!d.finished&&d.doorOpen>0&&aircraftVisible(d,range)){
    c.save();aircraftTransform(c,d);c.globalAlpha*=d.doorOpen;
    const door=AIRPORT.plane.door;
    rect(c,'#c7b7b6',door.x-2,door.y,2,door.height+2);
    rect(c,'#f5dec0',door.x+door.width,door.y,2,door.height+2);
    line(c,'#edd2ac',door.x,door.thresholdY,door.x+door.width,door.thresholdY,1);
    c.restore();
  }
}
