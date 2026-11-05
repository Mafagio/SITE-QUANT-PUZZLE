#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

if(!process.env.PLAYWRIGHT_MODULE)throw new Error('PLAYWRIGHT_MODULE doit désigner une installation existante.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output=path.resolve(process.argv[2]||'artifacts/london-departure/after');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],checks=[],captures=[];let videoContext,report;
page.on('pageerror',e=>errors.push(e.message));
const set=p=>page.evaluate(p=>window.worldlab.setState(p),p);
const state=()=>page.evaluate(()=>window.worldlab.getState());
const simulate=seconds=>page.evaluate(seconds=>window.worldlab.simulate(seconds),seconds);
async function capture(file){
  const c=await page.evaluate(()=>({png:document.querySelector('#london').toDataURL().split(',')[1],state:window.worldlab.getState()}));
  await writeFile(path.join(output,file),Buffer.from(c.png,'base64'));delete c.png;captures.push({file,...c});
}
async function prepare(speed=1){
  const route=await page.evaluate(()=>window.worldlab.route());
  return set({time:5,camera:4260,zoom:1.75,paused:true,auto:false,moving:false,speed,
    journey:{active:true,startX:4645,distance:route.totalDistance},
    departure:{active:true,elapsed:0,startCamera:4260,startZoom:1.75}});
}
try{
  await page.goto(process.env.LONDON_URL||'http://127.0.0.1:8877/london-code-demo.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.worldlab.ready);
  assert.deepEqual(await page.locator('#london').evaluate(c=>[c.width,c.height]),[1536,1024]);
  await page.evaluate(()=>window.worldlab.renderAt(5,0));await capture('monuments.png');

  const waterTranslation=await page.evaluate(async()=>{
    const {makeWater,drawWater}=await import('./src/london/water.js');
    const water=makeWater(),city=document.createElement('canvas');city.width=1536;city.height=704;
    const g=city.getContext('2d');g.fillStyle='#687b94';g.fillRect(0,0,1536,704);
    const render=camera=>{const c=document.createElement('canvas');c.width=1536;c.height=1024;drawWater(c.getContext('2d'),city,water,camera,5,[]);return c.getContext('2d').getImageData(0,704,1536,208).data;};
    return [0,1500].map(camera=>{
      const delta=96,a=render(camera),b=render(camera+delta);let max=0,total=0,changed=0,count=0;
      for(let y=4;y<204;y++)for(let x=64;x<1536-delta-64;x++)for(let k=0;k<4;k++){
        const error=Math.abs(a[(y*1536+x+delta)*4+k]-b[(y*1536+x)*4+k]);
        max=Math.max(max,error);total+=error;changed+=error>0;count++;
      }
      return {camera,delta,max,mean:total/count,changed,count};
    });
  });
  assert.ok(waterTranslation.every(r=>r.max<=1&&r.mean<.001),'Les motifs d’eau restent fixés au monde à temps gelé.');
  checks.push({name:'Ancrage des motifs d’eau dans le monde',waterTranslation});
  console.log('OK eau : translation caméra cohérente');

  await set({time:5,camera:4300,playerX:4645,speed:3,paused:true,auto:false,journey:{active:false}});
  assert.equal((await state()).departure.active,false);
  await page.evaluate(()=>window.worldlab.startBoarding({resume:false}));
  const route=await page.evaluate(()=>window.worldlab.route());
  await simulate((route.totalDistance-1)/276);
  assert.equal((await state()).departure.active,false,'Pas de départ avant entrée complète.');
  await simulate(1/276+.02);
  assert.equal((await state()).routeState,'EMBARQUE');assert.equal((await state()).departure.active,true);
  checks.push({name:'Départ déclenché uniquement après entrée complète'});

  const speeds=[];
  for(const speed of [.25,3]){await prepare(speed);await simulate(12);speeds.push((await state()).aircraft);}
  assert.deepEqual(speeds[0],speeds[1],'Vitesse du passager indépendante du décollage.');
  checks.push({name:'Trajectoire indépendante de la vitesse du personnage'});
  console.log('OK activation et vitesse du départ');

  await prepare();let previousTime=0,previousX=0;
  for(const [time,file] of [[0,'departure-00.png'],[.8,'door-closing.png'],[2.7,'stairs-away.png'],[6,'taxi.png'],[10.2,'rotation.png'],[11.7,'lift.png'],[13.7,'climb.png'],[15,'flight.png'],[24,'departure-complete.png']]){
    await simulate(time-previousTime);const s=await state();
    assert.ok(s.aircraft.offsetX>=previousX);previousX=s.aircraft.offsetX;previousTime=time;
    if(time<=10.2)assert.ok(Math.abs(s.aircraft.altitude)<1e-9,'Pas de montée avant le décollage (tolérance 10⁻⁹ px).');
    if(time===13.7)assert.ok(s.aircraft.altitude>0&&s.aircraft.gear<.01);
    await capture(file);
  }
  assert.equal((await state()).aircraft.finished,true);
  assert.deepEqual((await state()).departure.history,['STATIONNE','PREPARATION','ROULAGE','DECOLLAGE','EN_VOL']);
  checks.push({name:'Phases ordonnées, roulage, montée et rentrée du train'});

  await prepare();await simulate(6);await set({paused:true});
  const paused=await state(),hash=await page.evaluate(()=>window.worldlab.pixelHash());
  await page.waitForTimeout(350);
  assert.deepEqual(await state(),paused);assert.equal(await page.evaluate(()=>window.worldlab.pixelHash()),hash);
  await page.locator('#replay').click();
  // Replaying prepares the initial cached scenery asynchronously. The click
  // completes before that preparation; assert the resulting UI state once ready.
  await page.waitForFunction(()=>{
    const s=window.worldlab.getState();
    return !s.journey.active&&!s.departure.active&&s.camera===0&&s.playerX===330;
  });
  const reset=await state();
  assert.equal(reset.departure.active,false);assert.equal(reset.departure.elapsed,0);assert.equal(reset.journey.active,false);
  checks.push({name:'Pause exacte en roulage et remise au départ complète'});
  console.log('OK phases, pause et replay');

  videoContext=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1,recordVideo:{dir:path.join(output,'video'),size:{width:1440,height:1100}}});
  const v=await videoContext.newPage();v.on('pageerror',e=>errors.push(e.message));
  await v.goto(process.env.LONDON_URL||'http://127.0.0.1:8877/london-code-demo.html',{waitUntil:'networkidle'});
  await v.evaluate(()=>window.worldlab.ready);
  await v.evaluate(()=>window.worldlab.setState({time:5,camera:0,playerX:330,distance:0,gaitDistance:0,speed:3,auto:false,paused:true,moving:false,journey:{active:false}}));
  await v.locator('#auto').click();await v.locator('#london').scrollIntoViewIfNeeded();
  console.log('Enregistrement réel : promenade complète à 3×, embarquement puis décollage…');
  const samples=await v.evaluate(()=>new Promise(resolve=>{
    const samples=[],start=performance.now();
    function observe(){
      const s=window.worldlab.getState();samples.push({wall:(performance.now()-start)/1000,state:s});
      if(s.aircraft.finished||performance.now()-start>65000)resolve(samples);else requestAnimationFrame(observe);
    }observe();
  }));
  assert.equal(samples.at(-1).state.aircraft.finished,true);
  const maxCameraStep=Math.max(...samples.slice(1).map((s,i)=>Math.abs(s.state.camera-samples[i].state.camera)));
  const maxZoomStep=Math.max(...samples.slice(1).map((s,i)=>Math.abs(s.state.zoom-samples[i].state.zoom)));
  assert.ok(maxCameraStep<25&&maxZoomStep<.05,'Pas de saut de cadrage pendant le parcours réel.');
  assert.ok(samples.every(s=>!s.state.aircraft.active||s.state.routeState==='EMBARQUE'));
  checks.push({name:'Parcours réel depuis le départ, cadrage continu',maxCameraStep,maxZoomStep});
  const video=v.video();await videoContext.close();videoContext=null;await video.saveAs(path.join(output,'boarding-takeoff.webm'));
  await writeFile(path.join(output,'boarding-takeoff-states.json'),JSON.stringify(samples,null,2));
  assert.deepEqual(errors,[]);
  report={success:true,checks,captures,errors,positionTolerancePixels:1e-9,videoSeconds:samples.at(-1).wall,stats:await page.evaluate(()=>window.worldlab.stats())};
  console.log('OK enregistrement complet, sans erreur JavaScript');
}catch(error){report={success:false,error:error.stack,checks,captures,errors};throw error;}
finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  if(videoContext)await videoContext.close();await context.close();await browser.close();
}
