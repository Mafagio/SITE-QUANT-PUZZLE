#!/usr/bin/env node
// Checks the rendered architecture for detached pieces, then records the river.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

if(!process.env.PLAYWRIGHT_MODULE)throw new Error('PLAYWRIGHT_MODULE doit désigner une installation existante.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output=path.resolve(process.argv[2]||'artifacts/london-grounding/after');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1,recordVideo:{dir:path.join(output,'video'),size:{width:1440,height:1100}}});
const page=await context.newPage(),errors=[];let report;
page.on('pageerror',e=>errors.push(e.message));
const captures=[];
async function capture(file){
  const result=await page.evaluate(()=>({png:document.querySelector('#london').toDataURL().split(',')[1],state:window.worldlab.getState(),hash:window.worldlab.pixelHash()}));
  await writeFile(path.join(output,file),Buffer.from(result.png,'base64'));delete result.png;captures.push({file,...result});
}
try{
  await page.goto(process.env.LONDON_URL||'http://127.0.0.1:8877/london-code-demo.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.worldlab.ready);
  const architecture=await page.evaluate(async()=>{
    const {drawLandmarks}=await import('./src/london/landmarks.js');
    const c=document.createElement('canvas');c.width=1730;c.height=705;drawLandmarks(c.getContext('2d'));
    const w=c.width,h=c.height,data=c.getContext('2d').getImageData(0,0,w,h).data;
    const seen=new Uint8Array(w*h),components=[];
    for(let a=0;a<w*h;a++){
      if(seen[a]||data[a*4+3]<50)continue;
      const stack=[a];seen[a]=1;let pixels=0,minX=w,maxX=0,minY=h,maxY=0;
      while(stack.length){
        const q=stack.pop(),x=q%w,y=(q/w)|0;pixels++;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
          const n=yy*w+xx;if(!seen[n]&&data[n*4+3]>=50){seen[n]=1;stack.push(n);}
        }
      }
      if(pixels>2)components.push({pixels,minX,maxX,minY,maxY,grounded:maxY>=661});
    }
    return {components,png:c.toDataURL().split(',')[1],alphaThreshold:50,minimumComponentPixels:3};
  });
  await writeFile(path.join(output,'architecture-transparent.png'),Buffer.from(architecture.png,'base64'));delete architecture.png;
  assert.ok(architecture.components.length>0);
  assert.ok(architecture.components.every(c=>c.grounded),'Chaque pièce architecturale significative doit rejoindre le sol dans le rendu transparent.');
  for(const [file,camera] of [['monuments.png',0],['seam-768.png',768],['warehouses.png',1700],['docks.png',2700],['terminal.png',4100]]){
    await page.evaluate(camera=>window.worldlab.renderAt(5,camera),camera);await capture(file);
  }
  await page.evaluate(()=>window.worldlab.renderAt(5,0));
  const hash=await page.evaluate(()=>window.worldlab.pixelHash());
  await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.worldlab.pixelHash()),hash,'Pause exacte malgré les nouvelles réflexions.');
  await page.evaluate(()=>window.worldlab.renderAt(5,0));assert.equal(await page.evaluate(()=>window.worldlab.pixelHash()),hash,'Rendu reproductible.');
  const waterHash=()=>page.evaluate(()=>{
    const bytes=document.querySelector('#london').getContext('2d').getImageData(0,708,1536,198).data;
    let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619);return hash>>>0;
  });
  const before=await waterHash();
  await page.evaluate(()=>window.worldlab.renderAt(11,0));await capture('monuments-t11.png');
  assert.notEqual(await waterHash(),before,'La surface évolue avec le temps de simulation.');
  await page.evaluate(()=>window.worldlab.setState({time:5,camera:0,paused:false,auto:false,moving:false}));
  const animationStart=await page.evaluate(()=>window.worldlab.getState());
  await page.waitForTimeout(7000);
  const animationEnd=await page.evaluate(()=>window.worldlab.getState());
  await capture('monuments-animated-end.png');
  assert.equal(animationStart.camera,animationEnd.camera,'La ville reste immobile pendant l’ambiance.');
  assert.equal(animationStart.playerX,animationEnd.playerX);
  assert.deepEqual(errors,[]);
  report={success:true,architecture,captures,animationStart,animationEnd,stats:await page.evaluate(()=>window.worldlab.stats()),errors};
}catch(error){report={success:false,error:error.stack,captures,errors};throw error;}
finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const video=page.video();await context.close();await video.saveAs(path.join(output,'river-review.webm'));await browser.close();
}
