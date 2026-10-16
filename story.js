(() => {
 const sequence=document.querySelector('.story-sequence');if(!sequence)return;
 const panels=[...sequence.querySelectorAll('[data-story-panel]')],buttons=[...sequence.querySelectorAll('[data-story-step]')];
 const image=sequence.querySelector('.story-device img'),caption=sequence.querySelector('figcaption');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');let queued=false,current=-1;
 function show(index){if(index===current)return;current=index;panels.forEach((p,i)=>{p.classList.toggle('is-active',i===index);p.inert=i!==index});buttons.forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});const panel=panels[index];image.src=panel.dataset.image;image.alt=panel.dataset.alt;caption.textContent=panel.dataset.caption;sequence.dataset.scene=String(index)}
 function update(){queued=false;if(reduce.matches)return;const rect=sequence.getBoundingClientRect(),length=Math.max(1,rect.height-innerHeight),progress=Math.max(0,Math.min(1,-rect.top/length));sequence.style.setProperty('--story-progress',String(progress));show(Math.min(panels.length-1,Math.floor(progress*panels.length)))}
 function sync(){sequence.classList.toggle('story-ready',!reduce.matches);if(reduce.matches){panels.forEach(p=>{p.inert=false;p.classList.remove('is-active')});current=-1}else update()}
 buttons.forEach((button,index)=>button.addEventListener('click',()=>{const top=sequence.getBoundingClientRect().top+scrollY;scrollTo({top:top+(sequence.offsetHeight-innerHeight)*(index+.12)/panels.length,behavior:reduce.matches?'instant':'smooth'})}));
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});addEventListener('resize',update);reduce.addEventListener('change',sync);sync();
})();
