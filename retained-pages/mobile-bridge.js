// Same-origin compatibility adapter. The frozen source remains in life-archive/web.
function announce(){parent.postMessage({type:'mobile-route',page:location.hash.slice(1)||'home'},location.origin)}
window.addEventListener('hashchange',announce);
document.addEventListener('click',event=>{const el=event.target.closest('[data-go],a[href="#home"]');if(el&&(el.dataset.go==='home'||el.getAttribute('href')==='#home')){event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'mobile-route',page:'home'},location.origin)}},true);
announce();
