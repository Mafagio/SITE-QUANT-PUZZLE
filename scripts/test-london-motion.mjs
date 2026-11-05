#!/usr/bin/env node
// Real-time evidence for motion review; starts no server and installs nothing.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output=path.resolve(process.argv[2] || 'artifacts/london-motion/after');
const playwright=process.env.PLAYWRIGHT_MODULE;
if(!playwright) throw new Error('PLAYWRIGHT_MODULE doit désigner une installation existante.');
const {chromium}=await import(pathToFileURL(playwright).href);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1,recordVideo:{dir:path.join(output,'video'),size:{width:1440,height:1100}}});
const page=await context.newPage(),errors=[],markers=[];
page.on('pageerror',e=>errors.push(e.message));
const start=Date.now();
const state=()=>page.evaluate(()=>window.worldlab.getState());
const set=patch=>page.evaluate(p=>window.worldlab.setState(p),patch);
const reviewRoute=(distance,speed,time)=>page.evaluate(async({distance,speed,time})=>{
  const {sampleJourney}=await import('./src/london/journey.js');
  const journey={active:true,startX:4645,distance};
  return window.worldlab.setState({time,camera:4260,speed,paused:false,auto:false,motionBlend:1,zoom:sampleJourney(journey).zoomTarget,journey});
},{distance,speed,time});
const mark=async name=>{markers.push({name,seconds:(Date.now()-start)/1000,state:await state()});console.log(name);};
async function capture(name){
  const png=await page.locator('#london').evaluate(c=>c.toDataURL().split(',')[1]);
  await writeFile(path.join(output,`${name}.png`),Buffer.from(png,'base64'));
}
let report,drawnSoleContacts=[];
try {
  await page.goto(process.env.LONDON_URL || 'http://127.0.0.1:8877/london-code-demo.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.worldlab.ready);
  await set({time:5,camera:0,playerX:490,distance:0,gaitDistance:0,speed:.25,auto:false,paused:false,moving:false,journey:{active:false}});
  await mark('ambiance');await page.waitForTimeout(3000);await capture('monuments');
  await page.locator('#auto').click();await mark('marche-025');
  await page.waitForTimeout(500);
  const samples=await page.evaluate(()=>new Promise(resolve=>{
    const rows=[];function sample(){const s=window.worldlab.getState();rows.push({time:s.time,camera:s.camera,x:s.playerX});if(rows.length<90)requestAnimationFrame(sample);else resolve(rows);}requestAnimationFrame(sample);
  }));
  assert.ok(samples.filter(s=>Math.abs(s.camera-Math.round(s.camera))>.0001).length>80,'La caméra lente conserve les positions fractionnaires.');
  assert.ok(samples.every((s,i)=>!i||s.camera>=samples[i-1].camera),'Défilement lent monotone.');
  await page.waitForTimeout(4500);await capture('slow-walk');
  await page.locator('#auto').click();await mark('arret');
  const stopped=await state();await page.waitForTimeout(650);const settled=await state();
  assert.equal(settled.playerX,stopped.playerX,'Arrêt de la translation.');
  assert.equal(settled.gaitDistance,stopped.gaitDistance,'La phase ne continue pas à marcher sur place.');
  assert.ok(settled.motionBlend<.001,'Pose revenue au repos.');
  await capture('rest');await page.waitForTimeout(500);
  await set({speed:1});await page.locator('#auto').click();await mark('marche-1');await page.waitForTimeout(4000);
  await page.locator('#auto').click();
  await page.locator('#london').focus();await page.keyboard.down('ArrowLeft');await mark('demi-tour');
  await page.waitForTimeout(90);const turn=await state();
  assert.ok(turn.poseAngle<0&&turn.poseAngle>-Math.PI,'Orientation intermédiaire pendant le demi-tour.');
  await page.waitForTimeout(2100);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(500);
  await set({speed:3});await page.keyboard.down('ArrowRight');await mark('marche-3');await page.waitForTimeout(3500);await page.keyboard.up('ArrowRight');
  await set({time:15,camera:2700,playerX:3030,paused:false,auto:false,moving:false,speed:1,journey:{active:false}});
  await mark('grue');await capture('docks');await page.waitForTimeout(3000);
  const route=await page.evaluate(()=>window.worldlab.route());
  const bridge=route.segments.find(s=>s.stage==='TRAVERSEE');
  const stairs=route.segments.find(s=>s.stage==='MONTEE_ESCALIER');
  await reviewRoute(bridge.startDistance+bridge.length*.32,1.5,20);
  await mark('passerelle');await capture('bridge');await page.waitForTimeout(5000);
  await reviewRoute(stairs.startDistance+stairs.length*.03,.5,25);
  await mark('escalier');await capture('stairs');await page.waitForTimeout(8500);await capture('door');
  await set({paused:true});const hash=await page.evaluate(()=>window.worldlab.pixelHash());
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.worldlab.pixelHash()),hash,'Pause strictement stable.');
  drawnSoleContacts=await page.evaluate(async()=>{
    const {drawWalker}=await import('./src/london/walker.js');
    const {beginJourney,advanceJourney,sampleJourney,journeyRoute}=await import('./src/london/journey.js');
    const c=document.createElement('canvas').getContext('2d'),soles=[];
    let points=[];
    const begin=c.beginPath.bind(c),move=c.moveTo.bind(c),line=c.lineTo.bind(c),stroke=c.stroke.bind(c);
    c.beginPath=()=>{points=[];begin();};
    c.moveTo=(x,y)=>{points.push({x,y});move(x,y);};
    c.lineTo=(x,y)=>{points.push({x,y});line(x,y);};
    c.stroke=()=>{
      if(c.strokeStyle==='#9ca8ac'){
        const matrix=c.getTransform(),world=points.map(p=>new DOMPoint(p.x,p.y).matrixTransform(matrix));
        soles.push({x:world.reduce((n,p)=>n+p.x,0)/world.length,y:world.reduce((n,p)=>n+p.y,0)/world.length});
      }
      stroke();
    };
    const route=journeyRoute(beginJourney(4645));
    const sample=(distance,gaitDistance)=>{
      soles.length=0;
      const journey=beginJourney(4645);advanceJourney(journey,distance);
      const actor=sampleJourney(journey);
      drawWalker(c,{journey,playerX:actor.x,playerY:actor.y,scale:actor.scale,camera:0,gaitDistance,motionBlend:1,time:5,speed:1,facing:actor.facing,orientation:actor.orientation,climbing:actor.stage==='MONTEE_ESCALIER'});
      return soles[1]; // Front foot, p=.1 then p=.267: both within the same stance.
    };
    return ['TRAVERSEE','MONTEE_ESCALIER'].map(stage=>{
      const segment=route.segments.find(s=>s.stage===stage),d=segment.startDistance+segment.length*.4;
      const a=sample(d,4.8),b=sample(d+8,12.8);
      return {stage,a,b,slip:Math.hypot(a.x-b.x,a.y-b.y)};
    });
  });
  // Canvas reports its transform with float32 precision. At world x≈5000,
  // 0.001px covers that conversion while remaining far below a visible pixel.
  assert.ok(drawnSoleContacts.every(c=>c.slip<.001),'Les semelles dessinées gardent le même contact pendant l’appui sur passerelle et escalier (tolérance Canvas 0,001px).');
  assert.deepEqual(errors,[]);
  report={success:true,markers,slowCameraSamples:samples,drawnSoleContacts,soleTolerancePixels:.001,stats:await page.evaluate(()=>window.worldlab.stats()),errors};
} catch(error){report={success:false,error:error.stack,markers,drawnSoleContacts,errors};throw error;}
finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const video=page.video();await context.close();await video.saveAs(path.join(output,'movement.webm'));await browser.close();
}
