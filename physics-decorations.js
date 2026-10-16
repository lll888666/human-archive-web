(() => {
 'use strict';
 const host=document.querySelector('.hero-art'),phone=host?.querySelector('.hero-phone');
 if(!host||!phone||!window.Matter)return;
 const M=window.Matter,{Engine,Runner,Bodies,Body,Composite,Mouse,MouseConstraint,Events,Sleeping}=M;
 const narrow=matchMedia('(max-width:760px)'),coarse=matchMedia('(pointer:coarse)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
 const lifetime=new AbortController();
 let enabled=new URLSearchParams(location.search).get('decorations')!=='off',destroyed=false,suspended=false,instance=null,generation=0,resizeFrame=0;
 const assetURL=new URL('assets/memory-doodles.svg',document.baseURI);
 // Existing first-party artwork; individual instances keep the same paths and colours.
 const specs=[['book',68],['photo',58],['letter',64],['mic',58],['tape',64],['key',58],['flower',62],['star',38]]
  .flatMap(([kind,size])=>Array.from({length:3},(_,variant)=>[`${kind}-${variant}`,size,[-6,-6,112,112]]));
 let artwork;
 function eligible(){return enabled&&!destroyed&&!suspended&&!narrow.matches&&!coarse.matches&&!reduce.matches}
 function mount(svg){
  if(!eligible()||instance)return;
  const abort=new AbortController(),signal=abort.signal,layer=document.createElement('div');
  layer.className='physics-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;host.append(layer);
  const engine=Engine.create({enableSleeping:true});engine.gravity.y=1.1;engine.positionIterations=10;engine.velocityIterations=8;
  const runner=Runner.create();let running=false,visible=false,ready=false,spawned=0,spawnFrame=0;
  const width=host.clientWidth,height=host.clientHeight,rect=host.getBoundingClientRect(),pr=phone.getBoundingClientRect();
  const bounds={left:pr.left-rect.left,right:pr.right-rect.left,top:pr.top-rect.top,bottom:pr.bottom-rect.top};
  const wall=240,top=Math.max(bounds.top,-400),bottom=Math.min(bounds.bottom,height+400);
  Composite.add(engine.world,[Bodies.rectangle(width/2,height+wall/2,width*3,wall,{isStatic:true}),Bodies.rectangle(-wall/2,height/2,wall,height*3,{isStatic:true}),Bodies.rectangle(width+wall/2,height/2,wall,height*3,{isStatic:true}),Bodies.rectangle(width/2,-wall*1.5,width*3,wall,{isStatic:true})]);
  const obstacle=Bodies.rectangle((bounds.left+bounds.right)/2,(top+bottom)/2,bounds.right-bounds.left,Math.max(bottom-top,8),{isStatic:true,chamfer:{radius:34},friction:.2});
  Composite.add(engine.world,obstacle);
  if(bounds.top>=top){const center=(bounds.left+bounds.right)/2,ridge=(bounds.right-bounds.left)/2*.2;Composite.add(engine.world,Bodies.fromVertices(center,bounds.top-ridge/3,[[{x:bounds.left,y:bounds.top},{x:center,y:bounds.top-ridge},{x:bounds.right,y:bounds.top}]],{isStatic:true,friction:0,frictionStatic:0}))}
  const mean=specs.reduce((sum,s)=>sum+s[1]**2,0)/specs.length;
  const count=Math.max(24,Math.min(238,Math.round(width*height*.53*.74/mean)));
  const objects=Array.from({length:count},(_,index)=>{
   const [kind,size,box]=specs[index%specs.length],radius=size/2,el=document.createElement('div');el.className='physics-body';el.style.width=el.style.height=size+'px';
   const art=document.createElementNS('http://www.w3.org/2000/svg','svg');
   for(const name of ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin'])art.setAttribute(name,svg.getAttribute(name));
   art.setAttribute('viewBox',box.join(' '));art.setAttribute('focusable','false');const shape=svg.querySelector('#'+kind).cloneNode(true);shape.removeAttribute('id');art.append(shape);el.append(art);layer.append(el);
   const body=Bodies.circle(width/2,height*.42,radius*.86,{restitution:.5,friction:.06,frictionStatic:.12,frictionAir:.009,density:.0009});el.style.visibility='hidden';
   return {el,body,radius,squash:0,active:false,parked:false};
  });
  const byId=new Map(objects.map(o=>[o.body.id,o]));
  const mouse=Mouse.create(layer);
  // Mouse.create installs non-passive touch handlers; detach them, then feed only
  // eligible global pointers. Nothing in this decorative layer receives hits.
  for(const [name,handler] of [['mousemove',mouse.mousemove],['mousedown',mouse.mousedown],['mouseup',mouse.mouseup],['wheel',mouse.mousewheel],['mousewheel',mouse.mousewheel],['DOMMouseScroll',mouse.mousewheel],['touchmove',mouse.mousemove],['touchstart',mouse.mousedown],['touchend',mouse.mouseup]])layer.removeEventListener(name,handler);
  const constraint=MouseConstraint.create(engine,{mouse,constraint:{stiffness:.09,damping:.12,render:{visible:false}}});Composite.add(engine.world,constraint);
  let px=0,py=0,dx=0,dy=0,near=false,down=null;
  const forbidden=target=>target instanceof Element&&!!target.closest('a,button,input,select,textarea,summary,[role="button"],.phone,header');
  const point=event=>{const box=host.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top}};
  function spawn(){
   spawnFrame=0;if(!visible||document.hidden||!ready)return;
   const end=Math.min(objects.length,spawned+12),origin={x:(bounds.left+bounds.right)/2,y:bounds.top+(bounds.bottom-bounds.top)*.42};
   for(;spawned<end;spawned++){
    const o=objects[spawned],angle=spawned*2.399963229728653,c=Math.cos(angle),s=Math.sin(angle);
    const distance=Math.min((Math.max(0,c>0?bounds.right-origin.x:origin.x-bounds.left)+o.radius+5)/Math.max(Math.abs(c),.0001),(Math.max(0,s>0?bounds.bottom-origin.y:origin.y-bounds.top)+o.radius+5)/Math.max(Math.abs(s),.0001));
    Body.setPosition(o.body,{x:Math.max(o.radius,Math.min(width-o.radius,origin.x+c*distance)),y:Math.max(o.radius,Math.min(height-o.radius,origin.y+s*distance))});
    Body.setVelocity(o.body,{x:c*(6.5+spawned%3),y:s*(6.5+spawned%3)-5.5});Body.setAngularVelocity(o.body,Math.sin(spawned*7.3)*.2);o.active=true;o.el.style.visibility='visible';Composite.add(engine.world,o.body);
   }
   wake();
  }
  function wake(){
   const active=ready&&visible&&!document.hidden;
   if(active&&spawned<objects.length&&!spawnFrame)spawnFrame=requestAnimationFrame(spawn);
   if(active&&!running){Runner.run(runner,engine);running=true}else if(!active&&running){Runner.stop(runner);running=false}
  }
  const updatePointer=e=>{const p=point(e);mouse.position.x=mouse.absolute.x=p.x;mouse.position.y=mouse.absolute.y=p.y;return p};
  const release=()=>{mouse.button=-1;constraint.body=null;constraint.constraint.bodyB=null;down=null;near=false;dx=dy=0};
  window.addEventListener('pointermove',e=>{
   if(!visible||document.hidden||forbidden(e.target)){near=false;dx=dy=0;return}
   const p=updatePointer(e);dx=p.x-px;dy=p.y-py;px=p.x;py=p.y;near=p.x>-60&&p.x<width+60&&p.y>-60&&p.y<height+60;if(near)wake();
  },{passive:true,signal});
  window.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.isPrimary===false||forbidden(e.target)||!visible||!ready)return;const p=updatePointer(e);
   if(p.x<0||p.x>width||p.y<0||p.y>height)return;
   down={...p,id:e.pointerId};mouse.button=0;wake();
  },{passive:true,signal});
  window.addEventListener('pointerup',e=>{
   const start=down,p=point(e);release();
   if(!start||start.id!==e.pointerId||forbidden(e.target)||Math.hypot(p.x-start.x,p.y-start.y)>8)return;
   for(const o of objects){if(!o.active)continue;const x=o.body.position.x-p.x,y=o.body.position.y-p.y,d=Math.hypot(x,y);if(d>170)continue;const fall=(1-d/170)**2,power=(3+8*fall)*fall,nx=d>.001?x/d:.6,ny=d>.001?y/d:-1;Sleeping.set(o.body,false);Body.setVelocity(o.body,{x:Math.max(-20,Math.min(20,o.body.velocity.x+nx*power)),y:Math.max(-20,Math.min(20,o.body.velocity.y+(ny*.45-.8)*power))});Body.setAngularVelocity(o.body,nx*.12*fall)}wake();
  },{passive:true,signal});
  window.addEventListener('pointercancel',release,{signal});window.addEventListener('blur',release,{signal});
  Events.on(engine,'beforeUpdate',()=>{
   if(!near)return;const speed=Math.hypot(dx,dy);if(speed<15)return;const limited=Math.min(speed,90),normalized=(limited-15)/75;
   for(const o of objects){if(!o.active)continue;const x=o.body.position.x-px,y=o.body.position.y-py,d=Math.hypot(x,y);if(d>170||d<.001)continue;Sleeping.set(o.body,false);const force=.0027*normalized**2*limited*(1-d/170)**2*o.body.mass;Body.applyForce(o.body,o.body.position,{x:x/d*force,y:y/d*force})}dx*=.82;dy*=.82;
  });
  Events.on(engine,'collisionStart',({pairs})=>{for(const pair of pairs){const speed=Math.min(Math.hypot(pair.bodyA.velocity.x-pair.bodyB.velocity.x,pair.bodyA.velocity.y-pair.bodyB.velocity.y)/16,1);for(const body of [pair.bodyA,pair.bodyB]){const o=byId.get(body.id);if(o)o.squash=Math.max(o.squash,speed*.3)}}});
  Events.on(engine,'afterUpdate',()=>{
   for(const o of objects){if(!o.active)continue;const b=o.body;
    // Same anti-perch nudge as the reference: objects slide off the phone roof.
    if(b.position.x>bounds.left&&b.position.x<bounds.right&&b.position.y<bounds.top&&bounds.top-b.position.y<o.radius*8&&Math.abs(b.velocity.y)<=1.5&&Math.abs(b.velocity.x)<2.5){Sleeping.set(b,false);Body.setVelocity(b,{x:(b.position.x<(bounds.left+bounds.right)/2?-1:1)*2.5,y:b.velocity.y})}
    if(b.position.y>height+o.radius*6){Sleeping.set(b,false);Body.setPosition(b,{x:width/2,y:o.radius});Body.setVelocity(b,{x:0,y:0})}
    if(b.isSleeping&&o.parked&&o.squash===0)continue;o.parked=b.isSleeping&&o.squash===0;o.el.style.willChange=o.parked?'auto':'transform';
    o.el.style.transform=`translate(${b.position.x-o.radius}px,${b.position.y-o.radius}px) rotate(${b.angle}rad) scale(${(1+o.squash).toFixed(3)},${(1-o.squash).toFixed(3)})`;o.squash*=.86;if(o.squash<.002)o.squash=0;
   }
   if(spawned===objects.length&&!constraint.body&&objects.every(o=>o.body.isSleeping&&o.squash===0)){Runner.stop(runner);running=false;dx=dy=0}
  });
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)release();wake()},{threshold:.02});observer.observe(host);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();wake()},{signal});
  const burst=setTimeout(()=>{ready=true;layer.classList.add('is-ready');host.classList.add('physics-active');wake()},680);
  instance={destroy(){abort.abort();observer.disconnect();clearTimeout(burst);cancelAnimationFrame(spawnFrame);Runner.stop(runner);Events.off(engine);Composite.clear(engine.world,false);Engine.clear(engine);Mouse.clearSourceEvents(mouse);release();layer.remove();host.classList.remove('physics-active')}};
 }
 async function sync(){
  const ticket=++generation;instance?.destroy();instance=null;if(!eligible())return;
  try{artwork??=fetch(assetURL,{signal:lifetime.signal}).then(r=>{if(!r.ok)throw Error('Artwork unavailable');return r.text()}).then(text=>{const svg=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;if(specs.some(s=>!svg.querySelector('#'+s[0])))throw Error('Incomplete artwork');return svg});const svg=await artwork;if(ticket===generation&&eligible())mount(svg)}catch{artwork=null;/* Keep the unchanged static SVG if enhancement cannot load. */}
 }
 function destroy(){destroyed=true;++generation;cancelAnimationFrame(resizeFrame);instance?.destroy();instance=null;lifetime.abort();observer.disconnect();delete window.ArchiveDecorations}
 const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(sync)});observer.observe(host);observer.observe(phone);
 for(const query of [narrow,coarse,reduce])query.addEventListener('change',sync,{signal:lifetime.signal});
 window.addEventListener('pagehide',()=>{suspended=true;observer.disconnect();++generation;cancelAnimationFrame(resizeFrame);instance?.destroy();instance=null},{signal:lifetime.signal});
 window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;observer.observe(host);observer.observe(phone);void sync()}},{signal:lifetime.signal});
 window.ArchiveDecorations={setEnabled(value){enabled=Boolean(value);void sync()},destroy};void sync();
})();
