import {canvas,rect,line,poly,ellipse,mod} from './drawing.js';

const WORLD=6144,WIDTH=1536;

function riverBoat(){
  const c=canvas(164,72),g=c.getContext('2d');
  // A small Thames passenger launch: roof, recessed cabin and one timber deck.
  poly(g,'#30374e',[[9,46],[154,46],[143,61],[34,64],[17,56]]);
  poly(g,'#ded1bd',[[12,46],[151,46],[143,55],[28,57],[19,53]]);
  poly(g,'#496f82',[[19,53],[145,52],[140,58],[33,61]]);
  line(g,'#e8c994',25,57,138,55,1);
  poly(g,'#a67958',[[19,43],[145,41],[151,46],[12,48]]);
  rect(g,'#e5d4be',37,23,91,22);rect(g,'#bab8b7',118,25,10,20);
  for(let i=0;i<7;i++){
    const x=42+i*11;rect(g,'#344b64',x,27,8,13);
    rect(g,i===2||i===5?'#bca58a':'#88a1af',x+1,28,5,5);
    if(i===1||i===4)rect(g,'#c7b99f',x+1,28,1,10);
    line(g,'#d0b99b',x+2,39,x+6,39,1);
  }
  poly(g,'#e9d7bc',[[36,23],[40,19],[121,19],[131,24]]);
  rect(g,'#38485b',35,23,97,3);line(g,'#f5e1b6',40,19,121,19,1);
  poly(g,'#e2ccad',[[128,30],[139,34],[143,43],[128,43]]);
  poly(g,'#557485',[[130,32],[137,35],[140,39],[130,39]]);
  // Deliberately sparse passengers and mooring hardware, all at this scale.
  for(const x of [25,146]){
    line(g,'#465464',x,40,x,46,1);line(g,'#c6b49b',x-2,40,x+2,40,1);
  }
  ellipse(g,'#b87258',28,43,4.5,4.5);ellipse(g,'#e4d7bf',28,43,3.2,3.2);
  ellipse(g,'#7f6b63',28,43,1.8,1.8);line(g,'#e5c79e',25,40,27,42,1);
  line(g,'#526474',18,40,32,40,1);
  ellipse(g,'#d3a681',67,35,2,2);rect(g,'#8b5a57',65,37,4,6);
  ellipse(g,'#cda487',99,35,2,2);rect(g,'#516774',97,37,4,6);
  line(g,'#34394e',55,17,55,8,1);rect(g,'#727c87',53,9,5,7);
  line(g,'#c9bda8',54,8,58,8,1);
  return c;
}

function swan(){
  const c=canvas(32,28),g=c.getContext('2d');
  poly(g,'#b5b6c7',[[2,21],[6,14],[17,14],[23,18],[20,23],[8,24]]);
  poly(g,'#f1e7d7',[[3,20],[8,15],[16,15],[23,19],[20,22],[8,22]]);
  poly(g,'#d1cbd0',[[7,18],[11,15],[17,18],[13,20]]);
  // Folded wing and a neck with a small dark eye keep the silhouette legible.
  poly(g,'#fff0d9',[[8,18],[11,14],[15,16],[17,19],[12,19]]);
  line(g,'#bcbcc9',22,19,20,11,4);line(g,'#f0e8dd',22,18,21,10,2);
  poly(g,'#f3e9dd',[[19,11],[20,6],[24,4],[27,6],[27,9],[24,10],[22,12]]);
  rect(g,'#3e3d4a',25,6,2,2);poly(g,'#d89c5c',[[27,7],[31,8],[27,10]]);
  return c;
}

export function makeRiverLife(){
  return {
    sprites:[riverBoat(),swan()],
    boats:[{x:740,y:789,speed:14,scale:.82,phase:.4},{x:3160,y:808,speed:11,scale:.71,phase:2.2}],
    birds:[{x:497,y:858,speed:3.4,dir:1,scale:.75,phase:0},{x:532,y:850,speed:3.4,dir:1,scale:.64,phase:1.5},
      {x:2650,y:836,speed:3,dir:-1,scale:.64,phase:3},{x:3920,y:858,speed:2.6,dir:1,scale:.69,phase:4.1}]
  };
}

function ripple(c,x,y,span,time,phase,opacity){
  c.save();c.globalAlpha=opacity;c.fillStyle='#b3b5cc';
  for(let i=0;i<3;i++){
    const w=span*(1+i*.32),shift=Math.sin(time*.8+phase+i)*2;
    c.fillRect(x-w*.5+shift,y+i*3.2,w,.8+i*.16);
  }
  c.restore();
}

/** Ambient lives in the same world and simulation clock as the river. */
export function drawRiverLife(c,assets,camera,time){
  for(const boat of assets.boats){
    const worldX=mod(boat.x+time*boat.speed+240,WORLD+480)-240;
    const x=worldX-camera,s=boat.scale;if(x< -180||x>WIDTH+180)continue;
    const y=boat.y+Math.sin(time*1.1+boat.phase)*.55;
    // The wake remains attached to the stern and gradually opens behind it.
    for(let i=0;i<4;i++)ripple(c,x-12-i*13*s,y+3+i*.8,18+i*8,time,boat.phase+i,.13-i*.018);
    c.save();
    for(let row=0;row<4;row++){
      c.globalAlpha=.22-row*.035;c.fillStyle=row%2?'#b6c0c8':'#a8a0b3';
      const span=(106-row*17)*s;
      c.fillRect(x+83*s-span*.5+Math.sin(time*.8+row)*3,y+5+row*3.5,span,1.4);
    }
    c.globalAlpha=1;c.translate(x,y-62*s);c.drawImage(assets.sprites[0],0,0,164*s,72*s);c.restore();
  }
  for(const bird of assets.birds){
    const worldX=mod(bird.x+time*bird.speed*bird.dir+80,WORLD+160)-80;
    const x=worldX-camera;if(x< -40||x>WIDTH+40)continue;
    const y=bird.y+Math.sin(time*1.3+bird.phase)*.35,s=bird.scale;
    ripple(c,x,y+2,18*s,time,bird.phase,.22);
    c.save();c.translate(x,y-23*s);c.scale(bird.dir*s,s);c.drawImage(assets.sprites[1],bird.dir<0?-32:0,0);c.restore();
  }
}
