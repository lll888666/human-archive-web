// Static Pages preview: no account data or credentials are sent to a server.
const originalFetch = window.fetch.bind(window);
window.fetch = function(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    return Promise.resolve(new Response(JSON.stringify({detail:{code:url.pathname==='/api/auth/me'?'auth_required':'website_preview_unavailable',message:'公开网页版仅提供示例体验；云端登录与保存请使用 Android 体验版。'}}), {status:url.pathname==='/api/auth/me'?401:503, headers:{'Content-Type':'application/json'}}));
  }
  return originalFetch(input, options);
};
document.addEventListener('DOMContentLoaded', () => {
  const note = document.createElement('aside');
  note.textContent = '示例体验 · 云端登录与保存请使用 Android 版';
  note.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10000;width:max-content;max-width:calc(100% - 24px);padding:7px 12px;border:1px solid #cbb694;border-radius:18px;background:#fffaf0ed;color:#62432b;font:12px/1.5 sans-serif;box-shadow:0 2px 12px #40250d12;text-align:center;pointer-events:none';
  document.body.append(note);
});
