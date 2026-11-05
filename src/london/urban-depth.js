import { canvas, rng, rect, line, poly } from './drawing.js';

const WIDTH = 3840, GROUND = 672;

function cornice(c,x,y,w,light,shadow,size=3) {
  rect(c,shadow,x-2,y+size,w+4,3);
  rect(c,light,x-2,y,w+4,size);
}

function window(c,x,y,w,h,colors,lit,style=0) {
  // Every light lives inside a recessed opening, with a sill and a shaded jamb.
  rect(c,colors.reveal,x-1,y-1,w+2,h+3);
  rect(c,lit?colors.glow:colors.glass,x,y,w,h);
  rect(c,lit?colors.warmShade:colors.darkGlass,x+w-2,y,2,h);
  if(w>7)line(c,colors.mullion,x+w*.5,y,x+w*.5,y+h,1);
  if(style>0&&h>9)line(c,colors.mullion,x,y+h*.4,x+w,y+h*.4,1);
  rect(c,colors.sill,x-2,y+h,w+4,1);
  if(lit&&h>10){
    rect(c,colors.hot,x,y,1,h-1);rect(c,colors.sill,x+w-2,y,1,h-1);
    if((Math.round(x+y)%5)===0){rect(c,colors.warmShade,x+2,y+h-3,3,2);rect(c,colors.hot,x+3,y+h-5,1,2);}
  }
  if(style===2){
    for(const sx of [x-4,x+w+1]){
      rect(c,colors.shutter||colors.side,sx,y,2,h);
      for(let yy=y+2;yy<y+h;yy+=3)rect(c,colors.reveal,sx,yy,2,1);
    }
  }
}

function distantBlock(c,x,w,h,seed) {
  const r=rng(seed),y=GROUND-h;
  const colors=[['#96789e','#846c94','#b799b1'],['#8d779c','#796a91','#b19bb0'],['#a080a3','#8d739b','#bd9cb3']][seed%3];
  rect(c,colors[1],x+w*.7,y+5,w*.3,h-5);
  rect(c,colors[0],x,y,w*.81,h);
  rect(c,colors[2],x+1,y,w*.77,2);
  const rooftop=Math.floor(r()*5);
  if(rooftop<2){
    const rw=w*(.32+r()*.2),rh=6+r()*12;
    rect(c,colors[1],x+w*.25,y-rh,rw,rh);
    rect(c,colors[2],x+w*.25,y-rh,rw,1);
    if(rooftop===0)line(c,colors[1],x+w*.42,y-rh,x+w*.42,y-rh-13,1);
  }
  const spacing=9+seed%3,rowHeight=13+seed%4;
  for(let yy=y+11,row=0;yy<GROUND-8;yy+=rowHeight,row++){
    if(row%4===0)rect(c,colors[1],x+1,yy-4,w-2,1);
    // Floors share a quiet illuminated bank, rather than isolated random dots.
    const occupied=(Math.floor(row/3)+seed)%6<2;
    for(let xx=x+5,col=0;xx<x+w-6;xx+=spacing,col++){
      const lit=occupied&&(col+seed)%4!==0;
      rect(c,lit?'#d7b0a5':colors[2],xx,yy,3,4);
    }
  }
}

const MID = [
  {wall:'#626584',side:'#4e5777',edge:'#a19aa3',band:'#73718d',glass:'#7a849d',darkGlass:'#586580',reveal:'#464f6b',glow:'#dcaf81',warmShade:'#b28b75',hot:'#efd1a2',sill:'#9691a0',mullion:'#756f86'},
  {wall:'#786579',side:'#5d536e',edge:'#b1999c',band:'#8e7386',glass:'#8a8196',darkGlass:'#655d79',reveal:'#4d4c69',glow:'#e4b481',warmShade:'#b68a72',hot:'#f0cfa3',sill:'#ac9296',mullion:'#866e7b'},
  {wall:'#5e6c89',side:'#465573',edge:'#9fa8af',band:'#778397',glass:'#8296ab',darkGlass:'#586e8d',reveal:'#3e506f',glow:'#e4bc8c',warmShade:'#b49d8c',hot:'#edd1a5',sill:'#9a9eac',mullion:'#65768b'},
  {wall:'#877080',side:'#65596f',edge:'#b49ba3',band:'#9b7c8c',glass:'#9b8c9e',darkGlass:'#70677e',reveal:'#544d68',glow:'#dfb090',warmShade:'#b78b81',hot:'#edcba4',sill:'#b3959e',mullion:'#8f7586'},
];

function urbanBlock(c,x,w,h,seed) {
  const r=rng(seed),p=MID[seed%MID.length],y=GROUND-h;
  const returnWidth=Math.max(7,Math.round(w*.18));
  rect(c,p.wall,x,y,w,h);
  rect(c,p.side,x+w-returnWidth,y+4,returnWidth,h-4);
  cornice(c,x,y,w,p.edge,p.side,2);
  // Building types vary by structure, not only by their number of windows.
  const type=seed%5;
  if(type===0){
    rect(c,p.side,x+8,y-13,w-18,13);
    rect(c,p.edge,x+8,y-14,w-18,2);
    rect(c,p.band,x+13,y-20,w-29,6);
  }else if(type===1){
    poly(c,p.side,[[x-3,y],[x+w*.48,y-22],[x+w+2,y]]);
    line(c,p.edge,x-2,y,x+w*.48,y-22,1);
    rect(c,p.band,x+w*.4,y-10,w*.17,7);
  }else if(type===2){
    rect(c,p.side,x+w*.15,y-8,w*.64,8);
    rect(c,p.edge,x+w*.15,y-8,w*.64,1);
    line(c,p.side,x+w*.25,y-8,x+w*.25,y-22,2);
    line(c,p.side,x+w*.68,y-8,x+w*.68,y-15,2);
  }else if(type===3){
    rect(c,p.band,x+w*.2,y-10,w*.62,10);
    rect(c,p.side,x+w*.64,y-10,w*.18,10);
    rect(c,p.edge,x+w*.2,y-11,w*.62,1);
  }
  // Continuous piers and floor bands make the façade read as a load-bearing mass.
  const usable=w-returnWidth-10,bays=Math.max(2,Math.round(usable/15)),bay=usable/bays;
  const floorHeight=15+seed%4;
  for(let yy=y+13,floor=0;yy<GROUND-10;yy+=floorHeight,floor++){
    const bank=(Math.floor(floor/2)+seed)%5;
    rect(c,p.band,x+2,yy-5,w-returnWidth-2,1);
    for(let col=0;col<bays;col++){
      const wx=x+5+col*bay,ww=Math.max(4,Math.min(8,bay-5));
      const lit=bank<2&&col!==(seed+floor)%bays;
      window(c,wx,yy,ww,8+(type===0?2:0),p,lit,type%2);
    }
  }
  if(type===0||type===4)for(let xx=x+3;xx<x+w-returnWidth-3;xx+=bay){
    rect(c,p.edge,xx,y+4,1,h-7);rect(c,p.side,xx+2,y+5,2,h-8);
  }
  // The street-level dark plinth always reaches below the distant bank.
  rect(c,p.side,x,GROUND-12,w,16);
}

const TERRACE = [
  {wall:'#b3a496',side:'#817882',edge:'#d6c6b0',band:'#bdb09e',glass:'#858b9d',darkGlass:'#5b637d',reveal:'#55546b',glow:'#e8c598',warmShade:'#ae8e7d',hot:'#f3dbb4',sill:'#d5c3ac',mullion:'#a39894',shutter:'#707b78'},
  {wall:'#ae8b86',side:'#786775',edge:'#d5b8a7',band:'#bb9a90',glass:'#8c8b9d',darkGlass:'#62647c',reveal:'#554f68',glow:'#e6c29a',warmShade:'#b9957d',hot:'#efdab3',sill:'#d5b9a6',mullion:'#a18b84',shutter:'#65777a'},
  {wall:'#919d96',side:'#68747d',edge:'#c0c5b5',band:'#a5afa2',glass:'#8593a6',darkGlass:'#55657d',reveal:'#4d566e',glow:'#dfbf99',warmShade:'#a58d7f',hot:'#efdab4',sill:'#c1c3ae',mullion:'#899991',shutter:'#5c6e70'},
  {wall:'#9795aa',side:'#6d6c83',edge:'#c5bdca',band:'#aba5b8',glass:'#8b94a7',darkGlass:'#59627d',reveal:'#50526d',glow:'#e2bc9a',warmShade:'#af8f80',hot:'#efdab6',sill:'#c6bdc4',mullion:'#9691a4',shutter:'#6c7186'},
];

function terrace(c,x,w,floors,seed) {
  const p=TERRACE[seed%TERRACE.length],floorHeight=25+(seed%2)*2,h=floors*floorHeight+18,y=GROUND-h;
  rect(c,p.wall,x,y,w,h+3);rect(c,p.side,x+w-7,y,7,h+3);
  // Low slate mansards and chimneys belong to the body of each terrace.
  if(seed%4===0){
    poly(c,'#414e70',[[x-1,y],[x+7,y-15],[x+w-8,y-15],[x+w+1,y]]);
    line(c,'#9b96a6',x+7,y-15,x+w-8,y-15,1);
    rect(c,p.side,x+8,y-24,5,13);rect(c,p.edge,x+7,y-25,7,2);
    const dx=Math.round(x+w*.56)-4;
    rect(c,p.edge,dx,y-10,8,10);rect(c,p.reveal,dx+1,y-9,6,7);
    rect(c,p.glass,dx+2,y-8,4,5);line(c,p.edge,dx+4,y-8,dx+4,y-2,1);
    poly(c,p.edge,[[dx-1,y-10],[dx+4,y-15],[dx+9,y-10]],p.side,1);
  }else{
    rect(c,p.side,x+4,y-11,5,11);rect(c,p.edge,x+3,y-12,7,2);
    if(seed%2===0){rect(c,p.side,x+w-13,y-8,5,8);rect(c,p.edge,x+w-14,y-9,7,2);}
  }
  // Clay chimney pots touch their caps; small roof details still have support.
  const chimneyX=seed%4===0?x+8:x+4,chimneyY=seed%4===0?y-25:y-12;
  rect(c,'#a48079',chimneyX,chimneyY-4,2,4);rect(c,'#a48079',chimneyX+3,chimneyY-4,2,4);
  rect(c,'#595469',chimneyX,chimneyY-4,2,1);rect(c,'#595469',chimneyX+3,chimneyY-4,2,1);
  cornice(c,x,y,w,p.edge,p.side,3);
  for(let row=0;row<floors;row++){
    const wy=y+12+row*floorHeight;
    rect(c,p.band,x+1,wy+17,w-9,2);
    for(let col=0;col<2;col++){
      const wx=x+7+col*(w-16)/2;
      window(c,wx,wy,7,12,p,(row+seed)%4<2&&(row+col+seed)%5!==0,seed%5===2?2:1);
      if(row===floors-2&&col===0&&seed%7===0){
        rect(c,'#776568',wx,wy+14,7,2);rect(c,'#627c69',wx,wy+12,7,2);rect(c,'#8e9c78',wx+2,wy+11,3,1);
      }
    }
    // Sparse mortar courses stay subordinate to windows and floor structure.
    if(row%2===0)for(let xx=x+3;xx<x+w-9;xx+=11)line(c,p.side,xx,wy+20,xx+6,wy+20,1);
  }
  rect(c,p.side,x,GROUND-13,w,17);
  rect(c,p.edge,x+2,GROUND-15,w-11,2);
  rect(c,p.reveal,x+w*.42,GROUND-14,7,15);
  if(seed%3===0){
    rect(c,p.shutter,x+3,GROUND-17,w-13,3);
    rect(c,p.glow,x+4,GROUND-13,w-15,10);
    line(c,p.reveal,x+4,GROUND-8,x+w-11,GROUND-8,1);
    for(let xx=x+10;xx<x+w-12;xx+=7)line(c,p.reveal,xx,GROUND-13,xx,GROUND-3,1);
  }
}

/** Three continuous urban fronts, all founded below the far-bank coping. */
export function makeDistantCity() {
  const result=canvas(WIDTH,704),c=result.getContext('2d'),r=rng(0x4c4f4e44);
  // A quiet continuous base prevents pale sky slits below overlapping roofs.
  rect(c,'#77728f',0,565,WIDTH,139);
  let count=0;
  for(let x=-32;x<WIDTH;){
    const w=32+Math.floor(r()*46);
    const h=144+Math.floor(r()*158)+(count%13===5?58:0);
    distantBlock(c,x,w,h,920+count++);x+=w-4;
  }
  count=0;
  for(let x=-18;x<WIDTH;){
    const w=40+Math.floor(r()*42),h=100+Math.floor(r()*160)+(count%11===4?34:0);
    urbanBlock(c,x,w,h,1430+count++);x+=w-3;
  }
  count=0;
  for(let x=-14;x<WIDTH;){
    const w=33+Math.floor(r()*15),floors=2+(count%6===2?2:count%3===1?1:0);
    terrace(c,x,w,floors,2043+count++);x+=w-1;
  }
  // All layers share this firm foundation, hidden by the foreground quay.
  rect(c,'#514d68',0,GROUND,WIDTH,704-GROUND);
  return result;
}
