import { canvas, clamp, rng } from './drawing.js';

const WIDTH=1536, TOP=704, HEIGHT=208, WORLD=6144, BANK=662;
const TAU=Math.PI*2;
const BLUE=['#577daf','#7390bd','#8f94bd','#4b72a5','#9b9ac3'];
const GOLD=['#ffd07b','#f4ad62','#ffe79b','#dc8d65','#f9c480'];

export function makeWater(){
  const bed=canvas(WIDTH,HEIGHT),c=bed.getContext('2d');
  const gradient=c.createLinearGradient(0,0,0,HEIGHT);
  gradient.addColorStop(0,'#273c69');gradient.addColorStop(.3,'#365580');
  gradient.addColorStop(.62,'#3a507e');gradient.addColorStop(.82,'#465383');gradient.addColorStop(1,'#4b4f7d');
  c.fillStyle=gradient;c.fillRect(0,0,WIDTH,HEIGHT);
  const random=rng(711303),currents=[],bands=[];
  for(let i=0;i<360;i++){
    const depth=random(),marks=[];
    for(let j=0;j<3+Math.floor(random()*4);j++)marks.push({
      x:(random()-.5)*(40+depth*130),y:(random()-.5)*(4+depth*9),
      width:8+random()*(19+depth*49),height:.6+random()*(.8+depth),
      alpha:.2+random()*.34,tone:Math.floor(random()*BLUE.length),phase:random()*TAU,
    });
    currents.push({x:random()*WORLD,y:3+depth*202,depth,phase:random()*TAU,marks});
  }
  // These are cuts in a reflected surface, rather than independently generated
  // light columns. Their geometry is static; shared waves move the cuts smoothly.
  for(let y=1;y<HEIGHT;){
    const depth=y/HEIGHT,height=1.1+depth*1.6+random()*.9,segments=[];
    for(let x=-120;x<WORLD+120;){
      const width=38+random()*83+depth*35;
      segments.push({x,width,phase:random()*TAU,alpha:.55+random()*.45,
        dy:(random()-.5)*(.35+depth*2.1),heightScale:.8+random()*.4});
      x+=width+2+random()*(5+depth*8);
    }
    const firstByCell=[];let cursor=0;
    for(let cell=0;cell<=WORLD/256;cell++){
      const left=cell*256-45;
      while(cursor<segments.length&&segments[cursor].x+segments[cursor].width<left)cursor++;
      firstByCell.push(cursor);
    }
    bands.push({y,depth,height,phase:random()*TAU,segments,firstByCell});
    y+=height+.85+random()*(1.45+depth*2.7);
  }
  return {canvas:bed,currents,bands,skyPackets:makeSkyPackets(),reflectionCache:new Map()};
}

function lightPattern(water,source){
  const key=Math.round(source.x*8);
  if(water.reflectionCache.has(key))return water.reflectionCache.get(key);
  const random=rng(key^0x4c444e57),ridges=[];
  const reach=132+random()*112,phaseA=random()*TAU,phaseB=random()*TAU;
  for(let y=3+random()*3;y<Math.min(HEIGHT-3,reach);){
    const depth=y/HEIGHT;
    const profile=.27+.7*Math.pow(.5+.5*Math.sin(y*.055+phaseA),1.5)
      +.38*(.5+.5*Math.cos(y*.023+phaseB));
    const width=((source.width||24)*(1.1+random()*.65)+depth**1.1*(48+random()*51))*profile;
    const fade=clamp((reach-y)/32,0,1);
    ridges.push({y,depth,width,offset:Math.sin(y*.028+phaseA)*(6+depth*27)+(random()-.5)*(8+depth*26),
      height:1.2+random()*.9+depth*1.65,phase:random()*TAU,
      tone:Math.floor(random()*GOLD.length),alpha:(.68+random()*.32)*fade,
      split:.22+random()*.35,gap:.05+random()*.16,side:random()<.5?-1:1});
    y+=2.4+random()*3.4+depth*(1.2+random()*2.8);
  }
  if(water.reflectionCache.size>=128)water.reflectionCache.delete(water.reflectionCache.keys().next().value);
  water.reflectionCache.set(key,ridges);return ridges;
}

function reflectedArchitecture(c,city,water,camera,time){
  // Surface cuts live in the world. city is already projected by the caller,
  // so only the sampling coordinate is converted back to its screen domain.
  for(let pass=0;pass<2;pass++){
    c.globalCompositeOperation=pass?'screen':'source-over';
    for(const band of water.bands){
      const d=band.depth;
      const wave=band.y*.074-time*.72;
      const common=Math.sin(wave)*(1.2+d*10)+Math.sin(band.y*.031-time*.31)*(1+d*8);
      const cell=clamp(Math.floor(camera/256),0,band.firstByCell.length-1);
      for(let index=band.firstByCell[cell];index<band.segments.length;index++){
        const segment=band.segments[index];
        if(segment.x>camera+WIDTH+45)break;
        if(segment.x+segment.width<camera-45)continue;
        const screenX=segment.x-camera;
        const span=pass?segment.width*(.46+.12*Math.sin(segment.phase)):segment.width;
        const sourceX=Math.max(0,screenX),sourceRight=Math.min(WIDTH,screenX+span);
        const sourceWidth=sourceRight-sourceX;
        if(sourceWidth<=0)continue;
        const local=Math.sin(time*.53+segment.x*.006+band.phase)*(1+d*4);
        const y=band.y+segment.dy,height=band.height*segment.heightScale;
        const sourceY=clamp(BANK-y*2.12,1,BANK-1);
        const sourceH=Math.min(height*2.12,BANK-sourceY);
        if(pass){
          c.globalAlpha=(.11+d*.075)*segment.alpha;
          c.drawImage(city,sourceX,sourceY,sourceWidth,sourceH,sourceX+common+local,TOP+y,sourceWidth,.7+d*.45);
        }else{
          const opening=.75+Math.sin(time*.37+band.phase+segment.phase*.25)*.15;
          const pool=.52+.48*Math.sin(segment.x*.006+band.y*.036)**2;
          c.globalAlpha=(.22+d*.11)*segment.alpha*opening*pool;
          c.drawImage(city,sourceX,sourceY,sourceWidth,sourceH,sourceX+common+local,TOP+y,sourceWidth,height);
        }
      }
    }
  }
  c.globalCompositeOperation='source-over';
}

function drawCurrent(c,water,camera,time,foreground){
  for(const patch of water.currents){
    if(patch.x<camera-160||patch.x>camera+WIDTH+160)continue;
    const d=patch.depth,phase=time*.43-patch.y*.029+patch.x*.002;
    const x=patch.x-camera+Math.sin(phase)*(3+d*15),y=TOP+patch.y+Math.sin(phase*.8)*(.3+d);
    for(let i=0;i<patch.marks.length;i++){
      const mark=patch.marks[i];
      if(foreground&&i>1)continue;
      c.globalAlpha=mark.alpha*(foreground?.65:.55)*(.78+.15*Math.sin(time*.41+mark.phase));
      c.fillStyle=BLUE[mark.tone];
      c.fillRect(x+mark.x,y+mark.y,mark.width*(.9+.14*Math.sin(phase+mark.phase)),mark.height);
    }
  }
}

function makeSkyPackets(){
  const random=rng(0x534b594c),packets=[];
  const palettes=[
    {x:330,phase:.8,colors:['#ca92b5','#eda99f','#d6a5cb']},
    {x:910,phase:2.7,colors:['#bb82ba','#df90c3','#edadd0']},
    {x:1330,phase:4.6,colors:['#e58fc0','#efadba','#b995ca']},
  ];
  // These are patches of reflected sky on the river surface, not a second sky
  // moving behind it. Their positions cover the entire finite world.
  const fields=[];
  for(let section=0;section<WORLD/WIDTH;section++)for(const field of palettes){
    fields.push({...field,x:field.x+section*WIDTH,phase:field.phase+section*.61});
  }
  for(const field of fields){
    let y=4+random()*7,centre=field.x+(random()-.5)*38;
    while(y<HEIGHT-3){
      const depth=y/HEIGHT;
      centre=field.x+(centre-field.x)*.45+(random()-.5)*(52+depth*82);
      const left=65+random()*73+depth*38,right=45+random()*108+depth*32;
      const rowCount=3+Math.floor(random()*3),spacing=1.4+depth*1.6;
      const runCount=2+Math.floor(random()*2),runs=[];
      let minX=Infinity,maxX=-Infinity;
      for(let run=0;run<runCount;run++){
        const start=centre-left+(left+right)*(run+.12+random()*.25)/runCount;
        const width=22+random()*39+depth*(13+random()*24),rows=[];
        for(let row=0;row<rowCount;row++){
          if(row>0&&random()<.14)continue;
          const mark={
            x:start+(random()-.5)*(13+depth*12),y:y+row*spacing+random()*.7,
            width:width*(.55+random()*.65),height:.85+depth*1.65+random()*.65,
            alpha:.25+random()*.25,tone:Math.floor(random()*3),core:random()>.58,phase:random()*TAU,
          };
          minX=Math.min(minX,mark.x-44);maxX=Math.max(maxX,mark.x+mark.width+44);rows.push(mark);
        }
        runs.push({rows,phase:random()*TAU});
      }
      packets.push({y,depth,runs,phase:field.phase,anchor:centre,colors:field.colors,minX,maxX});
      y+=rowCount*spacing+3+random()*(5+depth*7);
    }
  }
  return packets;
}

function reflectedSky(c,water,camera,time){
  for(const packet of water.skyPackets){
    if(packet.maxX<camera||packet.minX>camera+WIDTH)continue;
    const d=packet.depth,worldPhase=packet.anchor*.0018;
    const swell=Math.sin(packet.y*.063-time*.57+packet.phase+worldPhase);
    const drift=swell*(4+d*17)+Math.sin(time*.26+packet.phase+worldPhase)*(2+d*4);
    for(const run of packet.runs){
      const bend=Math.sin(time*.36+run.phase)*(1+d*1.7);
      for(const row of run.rows){
        const x=row.x-camera+drift+bend;
        const y=TOP+row.y+Math.sin(time*.39+packet.phase+worldPhase)*(.2+d*.45);
        c.globalAlpha=row.alpha*.37;c.fillStyle=packet.colors[0];
        c.fillRect(x-3,y-.5,row.width+7,row.height+1.2+d*.5);
        c.globalAlpha=row.alpha;c.fillStyle=packet.colors[row.tone];c.fillRect(x,y,row.width,row.height);
        if(row.core){
          c.globalAlpha=.43+row.alpha*.32;c.fillStyle=row.tone===1?'#f2bdce':'#dfbedb';
          c.fillRect(x+row.width*(.12+.13*Math.sin(row.phase)),y,row.width*(.29+.12*Math.sin(row.phase+1)),Math.max(.8,row.height*.44));
        }
      }
    }
  }
}

export function drawWater(c,city,water,camera,time,lights=[]){
  c.save();c.beginPath();c.rect(0,TOP,WIDTH,HEIGHT);c.clip();
  c.globalAlpha=1;c.drawImage(water.canvas,0,TOP);
  reflectedSky(c,water,camera,time);
  reflectedArchitecture(c,city,water,camera,time);
  drawCurrent(c,water,camera,time,false);
  for(const source of lights){
    if(source.x<camera-150||source.x>camera+WIDTH+150)continue;
    const strength=clamp(source.energy||.7,.25,1);
    for(const ridge of lightPattern(water,source)){
      const d=ridge.depth,phase=ridge.y*.073-time*.72+source.x*.001;
      const wave=Math.sin(phase)*(1.5+d*10)+Math.sin(ridge.y*.031-time*.31)*(1+d*8);
      const x=source.x-camera+ridge.offset+wave;
      const breadth=ridge.width*(.88+.13*Math.sin(time*.31+ridge.phase));
      const alpha=clamp((.75+strength*.25)*ridge.alpha*(.84+Math.sin(phase*.6+ridge.phase*.14)*.14)*(1.12-d*.13),0,.96);
      const left=x-breadth/2;
      c.globalAlpha=alpha*.24;c.fillStyle='#ce8f8e';
      c.fillRect(left-breadth*.18,TOP+ridge.y-1,breadth*1.36,ridge.height+1.6);
      c.globalAlpha=alpha;c.fillStyle=GOLD[ridge.tone];
      c.fillRect(left,TOP+ridge.y,breadth*ridge.split,ridge.height);
      c.fillRect(left+breadth*(ridge.split+ridge.gap),TOP+ridge.y,breadth*(1-ridge.gap-ridge.split),ridge.height);
      if(ridge.tone===2){
        c.globalAlpha=Math.min(.95,alpha*1.16);c.fillStyle='#fff1a1';
        c.fillRect(x+ridge.side*breadth*.12,TOP+ridge.y,breadth*.25,Math.min(1.2,ridge.height));
      }
    }
  }
  drawCurrent(c,water,camera,time,true);
  // The shore's thin dark waterline connects the reflected mass to the quay.
  c.globalAlpha=1;c.fillStyle='#22365d';c.fillRect(0,TOP,WIDTH,2);
  c.globalAlpha=.28;c.fillStyle='#8e93b7';c.fillRect(0,TOP+HEIGHT-1,WIDTH,1);
  c.restore();
}
