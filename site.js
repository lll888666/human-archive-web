const menu=document.querySelector('.menu-toggle'), sheet=document.querySelector('#nav-sheet');
function closeMenu(){sheet.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','展开导航')}
menu.addEventListener('click',()=>{const open=sheet.hidden;sheet.hidden=!open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'关闭导航':'展开导航')});
sheet.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',closeMenu));
document.addEventListener('click',e=>{if(!e.target.closest('nav'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden){closeMenu();menu.focus()}});
const dialog=document.querySelector('#download-dialog');
document.querySelectorAll('[data-download]').forEach(b=>b.addEventListener('click',()=>dialog.showModal()));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
fetch('release.json').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(r=>document.querySelector('#apk-checksum').textContent=r.sha256).catch(()=>document.querySelector('#apk-checksum').textContent='发布信息暂不可用，请联系项目负责人核对。');
document.querySelector('#year').textContent=String(new Date().getFullYear());
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target)}},{threshold:.1});document.querySelectorAll('.chapter').forEach(el=>observer.observe(el))}
