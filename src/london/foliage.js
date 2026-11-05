import { canvas, rng, line, ellipse, clamp } from './drawing.js';

const WIDTH = 1536;
const TREE_LAYOUT = [252,301,619,702,745,931,1164,1196,1247,1340,1391,1510,
  1748,1847,2074,2275,2440,2702,2860,3025,3430,3690,3880,4025,5640,5788,5980];
const COLORS = ['#1e3d48','#294d47','#3a6146','#52763f','#758d42','#a7a84b','#c9b85d'];

function hash(x,y,seed) {
  let n=Math.imul(x+seed*17,374761393)^Math.imul(y-seed*3,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,y,size,seed) {
  const xx=x/size,yy=y/size,ix=Math.floor(xx),iy=Math.floor(yy);
  const fx=xx-ix,fy=yy-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),d=hash(ix,iy+1,seed),e=hash(ix+1,iy+1,seed);
  return a+(b-a)*u+(d-a)*v+(a-b-d+e)*u*v;
}

// Each crown is authored as a union of uneven, overlapping leaf-bearing boughs.
// Connected patches of leaves break up the light; there are no contour bands.
function crown(seed,part) {
  const sprite=canvas(150,142),g=sprite.getContext('2d'),r=rng(seed);
  const arrangements = [
    [[40,62,27,24],[61,41,29,25],[84,38,25,28],[106,60,26,27],[76,69,35,28],[47,87,25,21],[100,86,26,20]],
    [[36,61,25,23],[55,35,26,24],[76,47,23,26]],
    [[94,40,23,23],[113,60,24,25],[99,78,24,20]],
  ];
  const masses=arrangements[part].map(([x,y,rx,ry])=>({x:x+(r()-.5)*10,y:y+(r()-.5)*8,rx:rx*(.87+r()*.23),ry:ry*(.86+r()*.25)}));
  for(let y=6;y<119;y+=2)for(let x=6;x<146;x+=2){
    let inside=false,best=-10,normal=null;
    const rough=(noise(x,y,9,seed)-.5)*.18+(noise(x,y,4,seed+33)-.5)*.1;
    for(const m of masses){
      const nx=(x-m.x)/m.rx,ny=(y-m.y)/m.ry,q=nx*nx+ny*ny;
      if(q>1+rough)continue;
      inside=true;
      const z=Math.sqrt(Math.max(0,1-q));
      if(z>best){best=z;normal={nx,ny,z};}
    }
    if(!inside)continue;
    const patch=noise(x,y,11,seed+19),fine=noise(x,y,4.5,seed+81);
    const top=clamp((84-y)/66,0,1),left=clamp((107-x)/115,0,1);
    // The core remains dark. Light belongs to small upper-facing leaf clusters,
    // not a continuous stripe around every spherical volume.
    const facing=Math.max(0,-normal.nx*.35-normal.ny*.65+normal.z*.1);
    let light=.8+top*2.4+left*.6+patch*1.7+facing*.7;
    if(patch>.56&&fine>.51)light+=.9;
    if(y>80)light-=.5;
    if(fine<.23)light-=.6;
    const shade=clamp(Math.floor(light),0,6);
    g.fillStyle=COLORS[shade];g.fillRect(x,y,2,2);
    if(shade>=4&&fine>.66&&patch>.55){
      g.fillStyle=COLORS[Math.min(6,shade+1)];g.fillRect(x,y,2,1);
    }
  }
  return sprite;
}

export function makeTrees() {
  const sprites=Array.from({length:15},(_,i)=>crown(716+Math.floor(i/3)*103,i%3));
  return {sprites,layout:TREE_LAYOUT.map((x,i)=>({x,seed:i%5,scale:.62+(i%4)*.11}))};
}

export function drawTrees(c,trees,camera,time) {
  for(const tree of trees.layout){
    const x=tree.x-camera,s=tree.scale;if(x< -145||x>WIDTH+145)continue;
    c.save();c.translate(x,662);c.scale(s,s);
    ellipse(c,'#344543',0,0,19,2);
    // Forks remain continuous with a rigid trunk. The little light along the
    // left edge comes from the same sunset as the upper leaves.
    line(c,'#463d46',0,0,-2,-70,7);
    line(c,'#967254',-2,-1,-4,-68,2);
    line(c,'#685044',-2,-30,-24,-72,4);
    line(c,'#8c6d51',-3,-32,-24,-72,1);
    line(c,'#58483f',-1,-36,25,-78,4);
    line(c,'#af8459',0,-37,24,-78,1);
    c.drawImage(trees.sprites[tree.seed*3],-75,-139);
    // Small boughs turn around the point where they meet the stable crown.
    // Wind changes phase across the quay; the whole canopy never hops sideways.
    const breeze=Math.sin(time*.43+tree.x*.004)*.003+Math.sin(time*.83+tree.x*.009)*.0015;
    for(let tip=1;tip<3;tip++){
      const pivotX=tip===1?-14:18,pivotY=tip===1?-66:-63;
      const bend=breeze+Math.sin(time*(.69+tip*.08)+tree.seed*1.7+tip)*.0035;
      c.save();c.translate(pivotX,pivotY);c.rotate(bend);
      c.drawImage(trees.sprites[tree.seed*3+tip],-75-pivotX,-139-pivotY);c.restore();
    }
    // A few branch tips read through gaps at the bottom of the canopy.
    line(c,'#685147',-2,-42,-13,-58,2);
    line(c,'#aa8058',-1,-40,9,-55,1);
    c.restore();
  }
}
