import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.TEST_OUTPUT||'test-results/physics');await fs.mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+'/'))throw Error();const type={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.jpg':'image/jpeg','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(await fs.readFile(file))}catch{res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome'}),report={instrumentation:'Matter Engine.create/update and Body.applyForce wrapped without changing arguments/results; additional collision observer. Real Playwright mouse events; no direct forces injected.',reference:'UNKNOWN: not requested',local:null};
function observe(){
 window.__audit={engines:[],forces:0,collisions:0,updates:0,costs:[],squashMax:0,samples:[],constraints:[]};
 Object.defineProperty(window,'Matter',{configurable:true,get(){return this.__observedMatter},set(M){this.__observedMatter=M;const create=M.Engine.create,update=M.Engine.update,force=M.Body.applyForce,mc=M.MouseConstraint.create;M.MouseConstraint.create=function(...args){const c=mc.apply(this,args);window.__audit.constraints.push(c);return c};
 M.Engine.create=function(...args){const e=create.apply(this,args);window.__audit.engines.push(e);M.Events.on(e,'collisionStart',event=>{window.__audit.collisions+=event.pairs.length});return e};
 M.Engine.update=function(...args){const t=performance.now(),result=update.apply(this,args);window.__audit.costs.push(performance.now()-t);window.__audit.updates++;const a=window.__audit,bs=M.Composite.allBodies(args[0].world).filter(b=>!b.isStatic),grab=M.Composite.allConstraints(args[0].world).find(c=>c.bodyB);if(a.samples.length<5000)a.samples.push({t:performance.now(),maxSpeed:Math.max(0,...bs.map(b=>Math.hypot(b.velocity.x,b.velocity.y))),grabbed:grab?.bodyB?{id:grab.bodyB.id,x:grab.bodyB.position.x,y:grab.bodyB.position.y}:null});return result};
 M.Body.applyForce=function(...args){window.__audit.forces++;return force.apply(this,args)};
 }});
}
async function metrics(page){return page.evaluate(()=>{const a=window.__audit,M=window.Matter;return {forces:a.forces,collisions:a.collisions,updates:a.updates,bodies:a.engines.flatMap(e=>M.Composite.allBodies(e.world)).filter(b=>!b.isStatic).map(b=>({id:b.id,x:b.position.x,y:b.position.y,speed:b.speed,vx:b.velocity.x,vy:b.velocity.y,angle:b.angle,sleeping:b.isSleeping})),costs:a.costs.slice(-600)}})}
async function run(name,url){
 const dir=path.join(out,name);await fs.mkdir(dir,{recursive:true});const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(observe);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={url,errors,actions:[],frames:[],parameters:{},status:'RUNNING'};
 try{
 await page.goto(url,{waitUntil:'networkidle'});if(name==='reference')await page.getByRole('button',{name:'Only necessary',exact:true}).click().catch(()=>{});
 const arena=name==='reference'?'[data-playground]':'.physics-layer',bodies=name==='reference'?'[data-playground] .body':'.physics-body';await page.locator(bodies).first().waitFor({state:'visible'});
 await page.evaluate(selector=>{const e=document.querySelector(selector);scrollTo({top:Math.max(0,e.getBoundingClientRect().bottom+scrollY-innerHeight+30),behavior:'instant'})},arena);await page.waitForTimeout(6500);
 await page.evaluate(selector=>{new MutationObserver(records=>{for(const r of records){const m=r.target.style?.transform?.match(/scale\(([0-9.]+)/);if(m)window.__audit.squashMax=Math.max(window.__audit.squashMax,Math.abs(Number(m[1])-1))}}).observe(document.querySelector(selector),{subtree:true,attributes:true,attributeFilter:['style']})},arena);result.initial=await metrics(page);result.arena=await page.locator(arena).boundingBox();
 let seq=0;
 async function frame(label){const file=`${String(seq++).padStart(3,'0')}-${label}.png`;await page.screenshot({path:path.join(dir,file)});result.frames.push(file)}
 async function sequence(label,action){const before=await metrics(page);await frame(label+'-before');await action();for(let n=0;n<9;n++){await page.waitForTimeout(65);await frame(label+'-'+n)}const after=await metrics(page);const speeds=after.bodies.map(b=>b.speed);result.actions.push({label,forceCalls:after.forces-before.forces,collisions:after.collisions-before.collisions,maxSpeed:Math.max(0,...speeds),before,after});}
 const pick=async()=>page.locator(bodies).evaluateAll(es=>{const phone=document.querySelector('.hero-phone').getBoundingClientRect();return es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}}).filter(r=>r.x>100&&r.x<innerWidth-100&&r.y>130&&r.y<innerHeight-100&&(r.x<phone.left-80||r.x>phone.right+80)).sort((a,b)=>a.y-b.y)[0]});
 let target=await pick();assert.ok(target,'Visible decoration outside phone required');
 await page.mouse.move(target.x-60,target.y);await page.waitForTimeout(800);
 await sequence('slow',async()=>{for(let n=0;n<=60;n++){await page.mouse.move(target.x-60+n*2,target.y);await page.waitForTimeout(20);if(n%20===0)await frame('slow-moving-'+n)}});
 target=await pick();assert.ok(target);await page.mouse.move(Math.max(20,target.x-200),target.y);await page.waitForTimeout(300);
 await sequence('fast-sweep-collision',async()=>{for(let n=0;n<=9;n++){await page.mouse.move(Math.max(20,target.x-180)+n*40,target.y);await page.waitForTimeout(18);if(n%3===0)await frame('fast-moving-'+n)}});
 await page.waitForTimeout(1800);target=await pick();assert.ok(target);await page.mouse.move(target.x,target.y,{steps:100});
 await sequence('drag',async()=>{await page.mouse.down();await page.waitForTimeout(150);result.dragHit=await page.evaluate(({x,y})=>({hit:document.elementFromPoint(x,y)?.className,mouse:window.__audit.constraints.map(c=>({button:c.mouse.button,position:{...c.mouse.position},body:c.constraint.bodyB?.id,isStatic:c.constraint.bodyB?.isStatic}))}),target);result.constraintAttached=await page.evaluate(()=>window.Matter.Composite.allConstraints(window.__audit.engines[0].world).some(c=>c.bodyB&&!c.bodyB.isStatic));for(let n=1;n<=22;n++){await page.mouse.move(target.x+n*4,target.y-n*4);await page.waitForTimeout(20);if(n%6===0)await frame('drag-moving-'+n)}});
 result.dragHeld=await metrics(page);
 await sequence('release',async()=>{await page.mouse.up();await page.waitForTimeout(30)});
 result.constraintReleased=await page.evaluate(()=>window.__audit.engines.every(e=>window.Matter.Composite.allConstraints(e.world).every(c=>!c.bodyB)));
 // Frame loop records actual visual squash between screenshot samples as well.
 result.peakSquash=await page.evaluate(()=>window.__audit.squashMax);assert.ok(result.peakSquash>.001,'Rendered collision squash must be observed');result.squash=await page.locator(bodies).evaluateAll(es=>Math.max(0,...es.map(e=>{const m=getComputedStyle(e).transform;if(m==='none')return 0;const d=new DOMMatrix(m);return Math.abs(Math.hypot(d.a,d.b)-1)})));
 const raf=await page.evaluate(()=>new Promise(resolve=>{const times=[];let prev=performance.now();const start=prev;function step(now){times.push(now-prev);prev=now;if(now-start<2000)requestAnimationFrame(step);else resolve(times)}requestAnimationFrame(step)}));raf.sort((a,b)=>a-b);result.timeline=await page.evaluate(()=>window.__audit.samples);result.frameTiming={samples:raf.length,p50:raf[Math.floor(raf.length*.5)],p95:raf[Math.floor(raf.length*.95)]};
 const final=await metrics(page),costs=final.costs.sort((a,b)=>a-b);result.engineTiming={updates:final.updates,p95:costs[Math.floor(costs.length*.95)],max:costs.at(-1)};
 const grabbed=result.timeline.filter(s=>s.grabbed).map(s=>s.grabbed);result.dragDisplacement=grabbed.length?Math.max(...grabbed.filter(b=>b.id===grabbed[0].id).map(b=>Math.hypot(b.x-grabbed[0].x,b.y-grabbed[0].y))):0;
 result.forceResponse= result.actions.find(a=>a.label==='fast-sweep-collision').forceCalls>0;
 assert.equal(result.forceResponse,true,'Fast mouse movement must apply real physical force');if(name==='local')assert.ok(result.dragDisplacement>30,'Real grabbed body must follow mouse by more than 30px');assert.equal(result.constraintReleased,true,'Pointer release must detach the body');assert.ok(result.actions.some(a=>a.collisions>0),'Collisions must occur');assert.deepEqual(errors,[]);
 if(name==='local'){
  const savedRects=await page.locator('h1,.hero .cta,.hero-phone,#journey').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top+scrollY,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  await page.evaluate(()=>ArchiveDecorations.setEnabled(false));await page.waitForTimeout(100);assert.equal(await page.locator('.physics-layer').count(),0);assert.equal(await page.locator('.memory-doodles').evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.deepEqual(await page.locator('h1,.hero .cta,.hero-phone,#journey').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top+scrollY,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))),savedRects,'Physics must not alter page geometry');
  await page.evaluate(()=>ArchiveDecorations.setEnabled(true));await page.waitForTimeout(1100);
  // Real CTA clicks are intercepted at navigation, never sent to the product server.
  await page.route('https://134.175.114.73/**',route=>route.abort());await page.locator('.hero .cta a').first().scrollIntoViewIfNeeded();assert.equal(await page.locator('.hero .cta a').first().evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e||e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true);
  await page.locator('.hero .cta a[href="#films"]').click();await page.waitForTimeout(250);assert.equal(new URL(page.url()).hash,'#films');
  for(const [width,height]of [[1280,800],[768,1024],[390,844],[360,800],[1440,900]]){await page.setViewportSize({width,height});await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await page.locator('.physics-layer').count(),width<=760?0:1);await frame('resize-'+width)}
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);assert.equal(await page.locator('.physics-layer').count(),0);await frame('reduced');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1000);
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))});const stopped=await metrics(page);await page.waitForTimeout(250);assert.equal((await metrics(page)).updates,stopped.updates);assert.equal(stopped.bodies.length,0);assert.equal(await page.locator('.physics-layer').count(),0);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForTimeout(1100);assert.equal(await page.locator('.physics-layer').count(),1);
  await page.evaluate(()=>ArchiveDecorations.destroy());const ended=await metrics(page);await page.mouse.move(100,500);await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(300);assert.equal((await metrics(page)).updates,ended.updates);assert.equal(ended.bodies.length,0);assert.equal(await page.evaluate(()=>typeof ArchiveDecorations),'undefined');result.lifecycle='PASS: toggle, geometry, CTA, 5 widths, reduced motion, pagehide/pageshow, full destroy';
 }
 if(name==='local'){
  const checks=[];
  for(const variant of [
   {name:'coarse pointer',options:{isMobile:true,hasTouch:true},query:''},
   {name:'initial reduced motion',options:{reducedMotion:'reduce'},query:''},
   {name:'query opt-out',options:{},query:'?decorations=off'},
   {name:'artwork fetch failure',options:{},query:'',fail:true}
  ]){
   const c=await browser.newContext({viewport:{width:1440,height:900},...variant.options}),p=await c.newPage();
   if(variant.fail)await p.route('**/assets/memory-doodles.svg',r=>r.abort());
   await p.goto(base+variant.query,{waitUntil:'networkidle'});await p.waitForTimeout(1000);
   assert.equal(await p.locator('.physics-layer').count(),0,variant.name);
   assert.equal(await p.locator('.memory-doodles').evaluate(e=>getComputedStyle(e).visibility),'visible');
   checks.push(variant.name);await c.close();
  }
  const c=await browser.newContext({viewport:{width:1440,height:900}});await c.addInitScript(observe);const p=await c.newPage();
  await p.goto(base,{waitUntil:'networkidle'});await p.waitForTimeout(1200);
  await p.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));await p.waitForTimeout(300);
  const paused=(await metrics(p)).updates;await p.waitForTimeout(300);assert.equal((await metrics(p)).updates,paused);checks.push('offscreen runner paused');
  await p.evaluate(()=>addEventListener('pagehide',()=>localStorage.setItem('physics-exit-audit',JSON.stringify({bodies:window.__audit.engines.reduce((n,e)=>n+Matter.Composite.allBodies(e.world).length,0),layers:document.querySelectorAll('.physics-layer').length})),{once:true}));
  await p.goto(base+'?decorations=off');await p.waitForTimeout(300);result.actualPageExit=await p.evaluate(()=>{const value=localStorage.getItem('physics-exit-audit');localStorage.removeItem('physics-exit-audit');return JSON.parse(value)});assert.deepEqual(result.actualPageExit,{bodies:0,layers:0});checks.push('real navigation pagehide clears world and DOM');
  await p.goBack({waitUntil:'load'});await p.waitForTimeout(1100);assert.equal(await p.locator('.physics-layer').count(),1);checks.push('history return remounts');await c.close();result.additionalChecks=checks;
 }
 result.status='PASS';
 }catch(e){result.status='FAIL';result.failure=e.stack;await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e}finally{await fs.writeFile(path.join(dir,'results.json'),JSON.stringify(result,null,2));await context.close()}
 return result;
}
try{if(process.env.PHYSICS_REFERENCE==='1')report.reference=await run('reference','https://gaiababy.app/?ref=seesaw');if(process.env.REFERENCE_ONLY!=='1')report.local=await run('local',base);report.status='PASS'}catch(e){report.status='FAIL';report.failure=e.stack;throw e}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r))}
console.log(JSON.stringify({status:report.status,reference:report.reference?.status,local:report.local?.status}));
