import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.env.TEST_OUTPUT||path.join(root,'test-results'));
await fs.mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local'),relative=decodeURIComponent(url.pathname).replace(/^\/human-archive-web\//,'/');const file=path.resolve(root,'.'+(relative.endsWith('/')?relative+'index.html':relative));if(!file.startsWith(root+path.sep)||relative.includes('/.'))throw Error('bad path');const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/human-archive-web/`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const report={scope:'local static server; no external accounts or downloads submitted',checks:[],viewports:[],errors:[]};
try{
 for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[360,800]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.getByRole('link',{name:/立即体验网页版/}).first().getAttribute('href'),'https://134.175.114.73/');
  const review=page.locator('#review-access');await review.locator('summary').click();assert.equal(await review.getAttribute('open'),'');await review.locator('summary').click();
  await page.screenshot({path:path.join(output,`web-${width}-hero.png`)});
  if(width<=760){const menu=page.locator('.menu-toggle');await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert.equal(await menu.evaluate(e=>document.activeElement===e),true);await menu.click();await page.locator('#nav-sheet a[href="#films"]').click();assert.equal(await menu.getAttribute('aria-expanded'),'false')}
  const sequence=page.locator('#journey');for(let index=0;index<3;index++){
   await sequence.evaluate((el,i)=>window.scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-innerHeight)*(i+.2)/3,behavior:'instant'}),index);
   await page.waitForFunction(i=>document.querySelector('#journey').dataset.scene===String(i),index);await page.waitForTimeout(950);
   await page.screenshot({path:path.join(output,`web-${width}-story-${index}.png`)});
  }
  for(const section of await page.locator('.chapter,#films,#questions,.closing').all()){await section.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await section.screenshot({path:path.join(output,`web-${width}-${await section.getAttribute('id')||'closing'}.png`)})}
  const faq=page.locator('.faq details').first();await faq.locator('summary').click();assert.equal(await faq.getAttribute('open'),'');await faq.locator('summary').press('Enter');assert.equal(await faq.getAttribute('open'),null);
  await page.locator('.closing [data-download]').click();const dialog=page.getByRole('dialog');assert.equal(await dialog.isVisible(),true);assert.equal(await dialog.locator('a[download]').count(),1);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(x=>x.complete&&!x.naturalWidth).map(x=>x.src),emptyLinks:[...document.querySelectorAll('a')].filter(a=>!a.textContent.trim()&&!a.getAttribute('aria-label')&&!a.querySelector('img[alt]')).length}));
  assert.equal(metrics.scrollWidth,width);assert.deepEqual(metrics.broken,[]);assert.equal(metrics.emptyLinks,0);
  const local=await page.locator('a[href^="#"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h.length>1));for(const hash of local)assert.equal(await page.locator(hash).count(),1,hash);
  for(const href of ['https://www.bilibili.com/video/BV1hcpq62E7r/','https://www.bilibili.com/video/BV1f1pi6oEuK/','https://weixin.qq.com/sph/AKDeiBSJG','https://weixin.qq.com/sph/AienOaxmN'])assert.equal(await page.locator(`a[href="${href}"]`).count(),1);
  const apk=await page.request.head(base+'downloads/human-archive-1.0.3-vps-test.apk');assert.equal(apk.status(),200);
  report.viewports.push({width,height,...metrics,status:'PASS'});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(output,`web-${width}-full.png`),fullPage:true});await context.close();
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await reduced.newPage();await page.goto(base);assert.equal(await page.locator('.story-ready').count(),0);for(const panel of await page.locator('[data-story-panel]').all())assert.notEqual(await panel.evaluate(e=>getComputedStyle(e).display),'none');await reduced.close();
 const nojs=await browser.newContext({javaScriptEnabled:false}),fallback=await nojs.newPage();await fallback.goto(base);assert.equal(await fallback.locator('h1').isVisible(),true);assert.equal(await fallback.locator('.faq details').count(),5);await nojs.close();
 assert.deepEqual(report.errors,[]);report.checks=['5 viewports without overflow/broken assets','primary and four video links','mobile menu/Escape/focus/anchor','review credentials disclosure','3 scroll states','FAQ keyboard toggle','download dialog/Escape/APK exists','subdirectory hosting','reduced motion and JS-disabled readable content'];report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;throw error}finally{await fs.writeFile(path.join(output,'web-results.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve))}
console.log(JSON.stringify(report));
