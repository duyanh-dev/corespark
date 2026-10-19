/* =========================================================
   DEBUG.JS - "Hộp đen" ghi log để tìm nguyên nhân crash trên iPhone
   Bật:  thêm ?debug=1 vào link (nhớ lâu dài).  Tắt: ?debug=0
   Cách hoạt động: heartbeat ghi trạng thái vào localStorage mỗi 700ms.
   Nếu tab bị iOS giết (không có pagehide) thì lần tải sau hiện bảng báo cáo.
   Tắt debug thì mọi hàm là no-op, không tốn tài nguyên.
   ========================================================= */
const KEY = 'sc:dbg', ALIVE = 'sc:dbg:alive', FLAG = 'sc:debug', MAX = 90;
const NOOP = { log() {}, attach() {}, detach() {}, setCtx() {} };

export function initDebug() {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem(FLAG, '1');
    if (q === '0') { localStorage.removeItem(FLAG); localStorage.removeItem(KEY); localStorage.removeItem(ALIVE); }
    on = localStorage.getItem(FLAG) === '1';
  } catch {}
  if (!on) return NOOP;

  /* ----- Đọc log của lần trước, kiểm tra có crash không ----- */
  let prev = [], crashed = false;
  try {
    prev = JSON.parse(localStorage.getItem(KEY) || '[]');
    crashed = localStorage.getItem(ALIVE) === '1' && prev.length > 0;
  } catch {}

  let buf = [], ctxFn = null, timer = 0, frame = null, t0 = Date.now();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(buf)); } catch {} };
  const log = (type, data) => {
    buf.push({ t: ((Date.now() - t0) / 1000).toFixed(1), type, ...data });
    if (buf.length > MAX) buf.shift();
    save();
  };
  try { localStorage.setItem(ALIVE, '1'); } catch {}
  save();

  /* ----- Phiên mới ----- */
  log('start', {
    ua: navigator.userAgent, dpr: devicePixelRatio, screen: `${innerWidth}x${innerHeight}`,
    mem: navigator.deviceMemory || 'n/a', url: location.href,
  });

  /* ----- Lỗi của trang cha ----- */
  addEventListener('error', (e) => log('ERR', { msg: e.message, src: (e.filename || '').split('/').pop(), line: e.lineno }));
  addEventListener('unhandledrejection', (e) => log('REJECT', { msg: String(e.reason && e.reason.message || e.reason) }));
  document.addEventListener('visibilitychange', () => log('visibility', { state: document.visibilityState }));
  addEventListener('pagehide', (e) => {
    log('pagehide', { persisted: e.persisted });
    try { localStorage.setItem(ALIVE, '0'); } catch {}      // thoát bình thường = không phải crash
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { try { localStorage.setItem(ALIVE, '1'); } catch {} } });

  /* ----- Số liệu bên trong iframe demo (chạy mỗi 700ms, nhẹ) ----- */
  function snapshot() {
    const out = {};
    try { Object.assign(out, ctxFn ? ctxFn() : {}); } catch {}
    if (performance.memory) out.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
    try {
      const w = frame.contentWindow, d = frame.contentDocument;
      const se = d.scrollingElement || d.documentElement;
      out.scrollY = Math.round(se.scrollTop);
      out.docH = se.scrollHeight;
      out.pct = Math.round((se.scrollTop / Math.max(1, se.scrollHeight - w.innerHeight)) * 100);
      out.nodes = d.getElementsByTagName('*').length;
      const imgs = [...d.images];
      out.imgs = imgs.length;
      out.imgMB = Math.round(imgs.reduce((a, i) => a + (i.complete ? i.naturalWidth * i.naturalHeight * 4 : 0), 0) / 1048576);
      const cv = [...d.querySelectorAll('canvas')];
      out.canvas = cv.length;
      out.canvasMB = Math.round(cv.reduce((a, c) => a + c.width * c.height * 4, 0) / 1048576);
      out.video = d.querySelectorAll('video').length;
      out.win = `${w.innerWidth}x${w.innerHeight}`;
    } catch (e) { out.snapErr = String(e.message || e); }
    return out;
  }

  /* ----- Đếm các thứ "ngốn GPU/lớp composite" trong demo (chạy MỘT lần mỗi lần nạp, vì getComputedStyle khá nặng) ----- */
  function layers() {
    const out = {};
    try {
      const w = frame.contentWindow, d = frame.contentDocument;
      let bf = 0, fl = 0, wc = 0, anim = 0, blend = 0, big = 0, fixed = 0;
      d.querySelectorAll('*').forEach((el) => {
        const cs = w.getComputedStyle(el);
        if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) bf++;
        if (cs.filter !== 'none') fl++;
        if (cs.willChange !== 'auto') wc++;
        if (cs.animationName !== 'none') anim++;
        if (cs.mixBlendMode !== 'normal') blend++;
        if (cs.position === 'fixed') fixed++;
        const r = el.getBoundingClientRect();
        if (r.width * r.height > w.innerWidth * w.innerHeight * 1.5) big++;
      });
      Object.assign(out, { backdropFilter: bf, filter: fl, willChange: wc, animated: anim, blend, fixed, bigEls: big });
      const res = w.performance.getEntriesByType('resource');
      const kb = (t) => Math.round(res.filter((r) => r.initiatorType === t || (t === 'css' && r.name.endsWith('.css'))).reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024);
      out.jsKB = kb('script'); out.cssKB = kb('css');
      out.cssRules = [...d.styleSheets].reduce((a, s) => { try { return a + s.cssRules.length; } catch { return a; } }, 0);
      out.win = `${w.innerWidth}x${w.innerHeight}`;
    } catch (e) { out.layersErr = String(e.message || e); }
    return out;
  }

  function attach(iframe) {
    frame = iframe;
    clearInterval(timer);
    try {
      const w = iframe.contentWindow, d = iframe.contentDocument;
      w.addEventListener('error', (e) => log('DEMO-ERR', { msg: e.message, src: (e.filename || '').split('/').pop(), line: e.lineno }));
      w.addEventListener('unhandledrejection', (e) => log('DEMO-REJECT', { msg: String(e.reason && e.reason.message || e.reason) }));
      d.addEventListener('webglcontextlost', () => log('WEBGL-CONTEXT-LOST', snapshot()), true);
      const ce = w.console.error.bind(w.console);
      w.console.error = (...a) => { log('DEMO-console.error', { msg: a.map(String).join(' ').slice(0, 160) }); ce(...a); };
    } catch (e) { log('attach-fail', { msg: String(e.message || e) }); }
    log('iframe-loaded', snapshot());
    /* Đợi 1.2s cho trang ổn định rồi mới đếm lớp, để việc đếm không tự gây thêm tải lúc nạp */
    const mine = iframe;
    setTimeout(() => { if (frame === mine) log('LAYERS', layers()); }, 1200);
    timer = setInterval(() => log('beat', snapshot()), 700);
  }
  function detach() { clearInterval(timer); timer = 0; frame = null; log('iframe-removed', {}); }

  /* ----- Giao diện: nút LOG nổi + bảng báo cáo ----- */
  function panel(entries, title) {
    document.getElementById('sc-dbg')?.remove();
    const el = document.createElement('div');
    el.id = 'sc-dbg';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;color:#d7ffd7;font:11px/1.4 ui-monospace,Menlo,monospace;display:flex;flex-direction:column;padding:10px;padding-top:max(10px,env(safe-area-inset-top))';
    const text = entries.map((e) => JSON.stringify(e)).join('\n');
    el.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><b style="flex:1;color:#fff;font-size:13px">${title}</b><button id="dbg-copy" style="padding:8px 12px;border-radius:8px">Copy</button><button id="dbg-x" style="padding:8px 12px;border-radius:8px">Đóng</button></div><textarea readonly style="flex:1;background:#000;color:inherit;border:1px solid #333;border-radius:8px;padding:8px;font:inherit;white-space:pre;overflow:auto"></textarea>`;
    const ta = el.querySelector('textarea');
    ta.value = text;
    document.body.appendChild(el);
    ta.scrollTop = ta.scrollHeight;
    el.querySelector('#dbg-x').onclick = () => el.remove();
    el.querySelector('#dbg-copy').onclick = async (ev) => {
      try { await navigator.clipboard.writeText(text); ev.target.textContent = 'Đã copy'; }
      catch { ta.select(); ta.setSelectionRange(0, text.length); ev.target.textContent = 'Bấm giữ → Copy'; }
    };
  }
  function mount() {
    const b = document.createElement('button');
    b.textContent = 'LOG';
    b.style.cssText = 'position:fixed;right:8px;top:50%;z-index:99998;padding:6px 10px;border-radius:8px;background:#000;color:#0f0;font:700 11px ui-monospace,monospace;opacity:.75';
    b.onclick = () => panel(buf, 'Log phiên hiện tại');
    document.body.appendChild(b);
    if (crashed) panel(prev, `⚠ Lần trước bị CRASH (${prev.length} dòng log, cuối cùng ở dưới)`);
  }
  document.body ? mount() : addEventListener('DOMContentLoaded', mount);

  return { log, attach, detach, setCtx: (fn) => { ctxFn = fn; } };
}