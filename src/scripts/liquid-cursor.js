/* =========================================================
   LIQUID-CURSOR.JS - Con trỏ GIỌT NƯỚC KÍNH LỎNG cho toàn bộ website   (v3)

   v3: MỀM - UỐN LƯỢN - CLICK LÀ MỘT CÚ NƯỚC BẮN
     - Hết "gợn nhăn": bỏ gợn tần số cao trên mặt giọt, pháp tuyến lấy mẫu rộng hơn cho mặt kính mịn.
       Chỉ còn gợn có bước sóng dài (cỡ vài lần giọt) nên mặt giọt trơn, chỉ phập phồng nhẹ.
     - Uốn lượn: thân giọt gồm 6 giọt nối nhau (thay vì 4) -> đuôi thon dần, cong mượt.
       Khi lướt, cả chuỗi lượn sóng như con lươn nước (biên độ tăng dần về phía đuôi), kéo giãn theo hướng chạy,
       lò xo mềm có nảy nhẹ khi dừng. Kích thước nghỉ giữ nguyên như bản trước.
     - Click: giọt BẮN 3 hạt nước nhỏ ra rồi hút ngược về hoà vào giọt (tách giọt rồi nhập lại),
       đồng thời mặt nước ở chỗ bấm gợn thành các sóng KÍNH LỎNG: có độ lõm lúc va chạm, các đỉnh sóng bẻ tia
       (khúc xạ), sáng-tối theo hướng đèn, viền cầu vồng, nhạt dần theo khoảng cách. Không còn vòng tròn phẳng.
       Thả chuột: giọt nảy nhẹ như thạch.

   Hành vi giữ nguyên: rê nút thì phình, ô nhập chữ trả con trỏ chữ I, vùng data-cursor="off" và .spark__pin
   ẩn giọt, cảm ứng / không WebGL thì giữ con trỏ mặc định, đứng yên thì tự dừng vẽ.

   Dùng:   import { initLiquidCursor } from '../scripts/liquid-cursor.js';  initLiquidCursor();
   ========================================================= */
import { getParams, onParams } from './liquid-params.js';

const SIZE = 320;            // cạnh canvas (css px)
const HALF = SIZE / 2;
const MAXLAG = 100;          // đuôi không tụt xa quá mức này (canvas chỉ rộng 320px)
const RIP_DUR = 1.0;         // thời gian sống của sóng kính lỏng (giây)
const SAT_DUR = 0.65;        // thời gian hạt nước bắn ra rồi hút về (giây)

const N = 6;                 // số giọt trong chuỗi
const NS = 3;                // số hạt nước bắn khi click
const NB = N + NS;           // tổng số giọt đưa vào shader
// Bán kính 6 giọt: mũi nhỏ, thân phình rồi thon dần. Nhân 0.82 để tổng cỡ khớp bản trước (đã đo: ~26x27 px)
const BASE = [6.5, 9, 9.6, 8.6, 7.2, 5.2].map((r) => r * 0.82);
const REST = [[1.7, 2.2], [1.6, 2.05], [1.4, 1.8], [1.2, 1.5], [1.0, 1.3]];   // vị trí nghỉ so với giọt trước
const W0 = [15, 13.5, 12, 10.5, 9.5];                                          // tần số lò xo
const HOVER_SCALE = 1.45;

const TEXT_SEL = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, [contenteditable="true"], [contenteditable=""]';
const HOVER_SEL = 'a[href], button, [role="button"], summary, label[for], select, input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], input[type="range"], [data-cursor="hover"], [tabindex]:not([tabindex="-1"])';
const OFF_SEL = '[data-cursor="off"], .spark__pin';

const VERT = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2  uRes;      // kích thước canvas (pixel thiết bị)
  uniform float uDpr;
  uniform float uTime;
  uniform vec3  uB[${NB}];   // xy = vị trí giọt (css px, y hướng lên, tính từ tâm canvas), z = bán kính (âm = tắt)
  uniform float uK;        // độ "dính" khi hoà các giọt
  uniform float uR;        // bán kính vòm (độ dày) của giọt
  uniform float uAlpha;
  uniform float uDark;     // 0 = nền sáng, 1 = nền tối
  uniform float uRefr;     // độ khúc xạ
  uniform float uWob;      // biên độ phập phồng bước sóng dài (css px)
  uniform vec3  uVel;      // xy = hướng chạy (y hướng lên), z = mức kéo giãn
  uniform vec3  uBg;       // màu nền trang ngay dưới con trỏ
  uniform vec2  uOrg;      // gốc canvas trong toạ độ trang (y hướng lên)
  uniform vec4  uRip[2];   // sóng click: xy = tâm, z = tuổi (giây), w = bật/tắt

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  // Kéo giãn theo hướng chạy, hơi thon lại theo bề ngang
  vec2 warp(vec2 p) {
    vec2 rel = p - uB[0].xy;
    float al = dot(rel, uVel.xy);
    vec2 perp = rel - uVel.xy * al;
    rel = uVel.xy * (al / (1.0 + uVel.z)) + perp * (1.0 + 0.28 * uVel.z);
    return uB[0].xy + rel;
  }
  // Phập phồng bước sóng RẤT dài (~60px) so với giọt (~26px): mặt giọt trơn, không nhăn
  float wob(vec2 p) {
    return sin(p.x * 0.11 + uTime * 2.0) * sin(p.y * 0.10 - uTime * 1.7);
  }
  float field(vec2 p0) {
    vec2 p = warp(p0);
    float d = length(p - uB[0].xy) - uB[0].z;
    for (int i = 1; i < ${NB}; i++) d = smin(d, length(p - uB[i].xy) - uB[i].z, uK);
    return d + uWob * wob(p0);
  }
  // Độ cao mặt giọt: vòm cầu theo độ sâu tính từ mép
  float H(vec2 p) {
    float s = clamp(-field(p), 0.0, uR);
    return sqrt(max(s * (2.0 * uR - s), 0.0));
  }

  // Cảnh phía sau giọt: màu nền trang + vài sọc mờ + dải sáng trời-đất
  vec3 scene(vec2 q, vec3 dir) {
    q += uOrg;
    float pat = 0.5 + 0.25 * sin(q.y * 0.39) + 0.25 * sin(q.x * 0.23 + 1.0);
    vec3 col = uBg * (0.90 + 0.16 * pat);
    col += uDark * vec3(0.03, 0.06, 0.13) * pat;
    float sky = clamp(dir.y * 2.0, -1.0, 1.0);
    col += sky * 0.09 * mix(vec3(1.0), vec3(0.6, 0.8, 1.0), uDark);
    return col;
  }

  // Tô bóng một mặt kính lỏng có pháp tuyến n: khúc xạ + tán sắc + điểm sáng + viền cầu vồng. Trả về màu đã nhân alpha
  vec4 shade(vec2 p, vec3 n, float depth) {
    float sc = uR * 0.1;
    vec3 V = vec3(0.0, 0.0, 1.0);
    float ndv = clamp(n.z, 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.2);

    vec3 I = vec3(0.0, 0.0, -1.0);
    float ior = 1.0 + 0.33 * uRefr;                          // 1.33 = nước khi uRefr = 1
    float disp = 0.025 * uRefr;
    float D = depth * sc;
    vec3 rR = refract(I, n, 1.0 / (ior - disp));
    vec3 rG = refract(I, n, 1.0 / ior);
    vec3 rB = refract(I, n, 1.0 / (ior + disp));
    vec3 refrCol = vec3(
      scene(p + rR.xy / max(-rR.z, 0.25) * D, rR).r,
      scene(p + rG.xy / max(-rG.z, 0.25) * D, rG).g,
      scene(p + rB.xy / max(-rB.z, 0.25) * D, rB).b);

    float spec  = pow(max(dot(n, normalize(normalize(vec3(-0.45, 0.65, 0.62)) + V)), 0.0), 90.0);
    float spec2 = pow(max(dot(n, normalize(normalize(vec3(0.50, -0.60, 0.45)) + V)), 0.0), 40.0) * 0.30;
    float caus  = pow(max(dot(n, normalize(vec3(0.55, -0.70, 0.35))), 0.0), 2.5) * smoothstep(0.1, 0.9, 1.0 - ndv);

    vec3 tint = mix(vec3(0.30, 0.55, 0.95), vec3(0.55, 0.78, 1.00), uDark);
    vec3 rimDark = vec3(0.04, 0.10, 0.24);
    refrCol *= 1.0 - 0.22 * fres * (1.0 - uDark);
    refrCol = mix(refrCol, tint, 0.10);
    vec3 cBody = mix(refrCol, rimDark, fres * 0.55 * (1.0 - uDark));
    float aBody = 0.34 + 0.40 * fres;
    float hi = spec * 0.95 + spec2 + caus * 0.28;

    float rim = pow(1.0 - ndv, 3.0);
    float ang = atan(n.y, n.x);
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + ang / 6.2831 + fres * 0.8));
    vec3 fr = irid * rim * 0.30 * clamp(uRefr, 0.0, 2.2) * (0.6 + 0.4 * uDark);

    vec3 rgb = cBody * aBody + vec3(0.95, 0.98, 1.0) * hi + fr;
    float a = aBody + hi + rim * 0.10 * clamp(uRefr, 0.0, 2.2);
    rgb += tint * fres * 0.30 * uDark;
    a += fres * 0.18 * uDark;
    return vec4(rgb, min(a, 1.0));
  }

  /* ---------- Sóng kính lỏng khi click: gói sóng lan ra, đỉnh sóng bẻ tia ---------- */
  float ripH(vec2 p, vec4 r) {
    if (r.w < 0.5) return 0.0;
    float rr = length(p - r.xy);
    float age = r.z;
    float front = age * 150.0;                                       // tốc độ lan (px/s)
    float env = exp(-pow((rr - front) / 30.0, 2.0));                // gói sóng ~2-3 đỉnh
    float fade = 1.0 - smoothstep(0.0, ${RIP_DUR.toFixed(2)}, age);
    float core = smoothstep(0.0, 14.0, rr);                          // không bị nhọn ở tâm
    float wave = sin((rr - front) * 0.26) * env * fade * core * exp(-rr * 0.008) * 2.6;
    float dent = -3.0 * exp(-pow(rr / 16.0, 2.0)) * exp(-age * 6.0); // vết lõm lúc va chạm
    return wave + dent;
  }
  float ripTotal(vec2 p) { return ripH(p, uRip[0]) + ripH(p, uRip[1]); }

  vec4 ripple(vec2 p) {
    vec2 e = vec2(1.0, 0.0);
    float gx = (ripTotal(p + e.xy) - ripTotal(p - e.xy)) * 0.5;
    float gy = (ripTotal(p + e.yx) - ripTotal(p - e.yx)) * 0.5;
    float slope = length(vec2(gx, gy));
    float mask = smoothstep(0.015, 0.30, slope);                     // chỗ mặt nước phẳng thì trong suốt hoàn toàn
    if (mask < 0.003) return vec4(0.0);
    vec3 n = normalize(vec3(-gx * 1.6, -gy * 1.6, 1.0));
    vec4 g = shade(p, n, 22.0) * mask;
    // Sáng-tối theo hướng đèn để sóng thấy rõ cả trên nền trắng lẫn nền đen
    float sl = dot(vec2(gx, gy), vec2(-0.6, 0.8));
    float dk = smoothstep(0.02, 0.40, sl) * 0.30 * (1.0 - uDark);
    float br = smoothstep(0.02, 0.40, -sl) * 0.28 * uDark;
    vec4 extra = vec4(vec3(0.04, 0.10, 0.24) * dk + vec3(0.90, 0.95, 1.0) * br, dk + br);
    vec4 res = g + extra * (1.0 - g.a);
    return clamp(res, 0.0, 1.0);
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uDpr;
    float sc = uR * 0.1;
    float d = field(p);
    float aa = 0.7 / uDpr;                                           // đúng ~1 pixel thiết bị
    float cov = 1.0 - smoothstep(-aa, aa, d);

    // Bóng đổ mềm phía dưới (chỉ cần trên nền sáng)
    float sd = field(p - vec2(1.5, -5.0) * sc);
    float sh = (1.0 - smoothstep(-2.0 * sc, 9.0 * sc, sd)) * 0.17 * (1.0 - uDark);

    vec4 body = vec4(0.0);
    if (cov > 0.002) {
      // Pháp tuyến lấy mẫu rộng (1.3px) -> mặt giọt mịn, không lấm tấm / nhăn
      vec2 e = vec2(1.3, 0.0);
      float gx = (H(p + e.xy) - H(p - e.xy)) / (2.0 * e.x);
      float gy = (H(p + e.yx) - H(p - e.yx)) / (2.0 * e.x);
      vec3 n = normalize(vec3(-gx, -gy, 1.0));
      body = shade(p, n, 30.0);
    }

    // Lớp dưới: bóng đổ + sóng kính lỏng; lớp trên: thân giọt
    vec4 baseL = vec4(vec3(0.04, 0.10, 0.24) * sh, sh);
    if (uRip[0].w > 0.5 || uRip[1].w > 0.5) {
      vec4 rp = ripple(p);
      baseL = rp + baseL * (1.0 - rp.a);
    }
    vec3 outRgb = body.rgb * cov + baseL.rgb * (1.0 - body.a * cov);
    float outA  = body.a * cov + baseL.a * (1.0 - body.a * cov);

    gl_FragColor = clamp(vec4(outRgb, outA) * uAlpha, 0.0, 1.0);     // premultiplied alpha
  }
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('[liquid-cursor]', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

// Màu nền thật của trang tại phần tử dưới con trỏ (đi ngược lên cha cho tới khi gặp màu đặc)
function pageBg(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const s = getComputedStyle(n).backgroundColor || '';
    const m = s.match(/[\d.]+/g);
    if (!m || m.length < 3) continue;
    const a = m.length > 3 ? parseFloat(m[3]) : 1;
    if (a < 0.6) continue;
    if (s.startsWith('rgb')) return [m[0] / 255, m[1] / 255, m[2] / 255];
    if (s.startsWith('color(srgb')) return [+m[0], +m[1], +m[2]];
  }
  return [1, 1, 1];
}

export function initLiquidCursor(opts = {}) {
  if (typeof window === 'undefined') return null;
  if (window.__liquidCursor) return window.__liquidCursor;

  // Chỉ bật cho chuột / bút. Cảm ứng: giữ nguyên.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const OFF = opts.off || OFF_SEL;
  const HOVER = opts.hover || HOVER_SEL;
  const TEXT = opts.text || TEXT_SEL;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Canvas + WebGL (không có thì thôi, không đụng tới con trỏ mặc định) ---------- */
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(SIZE * dpr);
  canvas.className = 'liquid-cursor';
  canvas.setAttribute('aria-hidden', 'true');

  let gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch (e) { gl = null; }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[liquid-cursor]', gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const U = {};
  ['uRes', 'uDpr', 'uTime', 'uB[0]', 'uK', 'uR', 'uAlpha', 'uDark', 'uRefr', 'uWob', 'uVel', 'uBg', 'uOrg', 'uRip[0]']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform1f(U.uDpr, dpr);

  /* ---------- CSS: ẩn con trỏ mặc định (chỉ sau khi WebGL đã chạy được) ---------- */
  const style = document.createElement('style');
  style.textContent = `
    html.liquid-cursor-on, html.liquid-cursor-on * { cursor: none !important; }
    html.liquid-cursor-on :is(${TEXT}) { cursor: text !important; }
    .liquid-cursor { position: fixed; left: 0; top: 0; width: ${SIZE}px; height: ${SIZE}px; pointer-events: none;
      z-index: 2147483646; will-change: transform; contain: strict; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(canvas);
  document.documentElement.classList.add('liquid-cursor-on');

  /* ---------- Thông số (độ khúc xạ, độ mềm mặc định) ---------- */
  let P = getParams().cursor;
  const offParams = onParams((s) => { P = s.cursor; wake(); });

  /* ---------- Trạng thái ---------- */
  const mouse = { x: -999, y: -999 };
  const c = Array.from({ length: N }, () => [0, 0]);   // chuỗi giọt (toạ độ trình duyệt)
  const v = Array.from({ length: N }, () => [0, 0]);   // vận tốc các giọt đuôi (lò xo)
  const tg = Array.from({ length: N }, () => [0, 0]);  // vị trí nghỉ mục tiêu
  const sv = [0, 0];                                   // vận tốc con trỏ đã làm mượt
  let dirx = 1, diry = 0;                              // hướng chạy cho shader (y hướng lên)
  let sdx = 1, sdy = 0;                                // hướng chạy trên màn hình (y hướng xuống)
  let shown = false;
  let alpha = 0, alphaT = 0;
  let scale = 1, scaleT = 1;
  let press = 0, pressT = 0;
  let dark = 0, darkT = 0;
  let stretch = 0, wobE = 0, und = 0;
  const bg = [1, 1, 1], bgT = [1, 1, 1];
  const rips = [{ x: 0, y: 0, t: 99 }, { x: 0, y: 0, t: 99 }];
  let ripI = 0;
  const sat = { t: 99, a: 0 };
  let lastTarget = null;
  let raf = 0, last = 0, settle = 0;
  const arr = new Float32Array(NB * 3);
  const ripArr = new Float32Array(8);

  function classify(el) {
    if (!(el instanceof Element)) return;
    const hide = !!(el.closest(OFF) || el.closest(TEXT));
    alphaT = hide ? 0 : 1;
    scaleT = !hide && el.closest(HOVER) ? HOVER_SCALE : 1;
    const b = pageBg(el);
    bgT[0] = b[0]; bgT[1] = b[1]; bgT[2] = b[2];
    const lum = 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2];
    darkT = (lum < 0.45 || el.closest('.dark, [data-theme="dark"]')) ? 1 : 0;
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    const sz = P.size, soft = P.soft;

    // Giọt đầu (mũi) bám gần như tức thì để nhắm trúng
    const px = c[0][0], py = c[0][1];
    const k0 = calm ? 1 : 1 - Math.exp(-dt * 50);
    c[0][0] += (mouse.x - c[0][0]) * k0;
    c[0][1] += (mouse.y - c[0][1]) * k0;

    // Vận tốc (làm mượt) -> hướng chạy, kéo giãn, độ lượn
    const ks = 1 - Math.exp(-dt * 8);
    sv[0] += ((c[0][0] - px) / dt - sv[0]) * ks;
    sv[1] += ((c[0][1] - py) / dt - sv[1]) * ks;
    const speed = Math.hypot(sv[0], sv[1]);
    if (speed > 40) { sdx = sv[0] / speed; sdy = sv[1] / speed; dirx = sdx; diry = -sdy; }

    const ease = (cur, t, rate) => { const d = t - cur; return Math.abs(d) < 0.004 ? t : cur + d * (1 - Math.exp(-dt * rate)); };
    const stretchT = calm ? 0 : Math.min(speed / 1400, 0.4) * soft;
    const undT = calm ? 0 : Math.min(speed / 800, 1);
    stretch = ease(stretch, stretchT, 8);
    und = ease(und, undT, undT > und ? 7 : 5);
    wobE = ease(wobE, 0, 4);                              // chỉ có xung nhẹ khi click, rồi lặng

    // Các giọt đuôi: lò xo mềm có nảy nhẹ, nghỉ ở vị trí lệch xuống-phải -> hình giọt lệ
    const ddt = Math.min(dt, 0.033);
    tg[0][0] = c[0][0]; tg[0][1] = c[0][1];
    for (let i = 1; i < N; i++) {
      const tx = c[i - 1][0] + REST[i - 1][0] * sz;
      const ty = c[i - 1][1] + REST[i - 1][1] * sz;
      tg[i][0] = tx; tg[i][1] = ty;
      if (calm) {
        c[i][0] = tx; c[i][1] = ty; v[i][0] = v[i][1] = 0;
      } else {
        const w = W0[i - 1] / soft, dmp = 2 * 0.62 * w;
        v[i][0] += ((tx - c[i][0]) * w * w - v[i][0] * dmp) * ddt;
        v[i][1] += ((ty - c[i][1]) * w * w - v[i][1] * dmp) * ddt;
        c[i][0] += v[i][0] * ddt;
        c[i][1] += v[i][1] * ddt;
      }
      const dx = c[i][0] - c[0][0], dy = c[i][1] - c[0][1], l = Math.hypot(dx, dy);
      if (l > MAXLAG) { c[i][0] = c[0][0] + (dx / l) * MAXLAG; c[i][1] = c[0][1] + (dy / l) * MAXLAG; v[i][0] *= 0.5; v[i][1] *= 0.5; }
    }

    // Làm mượt các trạng thái còn lại
    alpha = ease(alpha, alphaT, alphaT > alpha ? 18 : 12);
    scale = ease(scale, scaleT, 14);
    press = ease(press, pressT, 12);
    dark = ease(dark, darkT, 10);
    let bgDone = true;
    for (let i = 0; i < 3; i++) { bg[i] = ease(bg[i], bgT[i], 10); if (bg[i] !== bgT[i]) bgDone = false; }
    rips[0].t += dt; rips[1].t += dt;
    if (sat.t < SAT_DUR) sat.t += dt;

    // Gốc canvas, làm tròn theo pixel thiết bị để không bị nhoè
    const ox = Math.round(c[0][0] * dpr) / dpr;
    const oy = Math.round(c[0][1] * dpr) / dpr;
    canvas.style.transform = `translate3d(${ox - HALF}px, ${oy - HALF}px, 0)`;

    // Vị trí + bán kính từng giọt. Khi lướt, cả chuỗi lượn sóng ngang hướng chạy, biên độ tăng dần về đuôi
    const pf = scale * (1 + 0.32 * press);
    const phase = (now / 1000) * 8;
    const amp = 3.0 * sz * soft * und;
    const perpx = -sdy, perpy = sdx;
    for (let i = 0; i < N; i++) {
      const gap = i ? dist(c[i], c[i - 1]) : 0;
      const thin = i ? 1 - 0.45 * Math.min(1, gap / (45 * sz)) : 1;
      const sw = i ? Math.sin(phase - i * 0.9) * amp * (i / (N - 1)) : 0;
      arr[i * 3] = c[i][0] + perpx * sw - ox;
      arr[i * 3 + 1] = -(c[i][1] + perpy * sw - oy);
      arr[i * 3 + 2] = BASE[i] * sz * pf * thin;
    }

    // Hạt nước bắn ra khi click, rồi hút ngược về hoà vào giọt
    const satOn = sat.t < SAT_DUR;
    for (let k = 0; k < NS; k++) {
      const j = (N + k) * 3;
      if (satOn) {
        const u = Math.min(1, sat.t / SAT_DUR);
        const ang = sat.a + k * 2.094 + u * 0.8;
        const R = 24 * sz * Math.sin(Math.PI * u) * (1 - 0.3 * u);
        arr[j] = c[0][0] + Math.cos(ang) * R - ox;
        arr[j + 1] = -(c[0][1] + Math.sin(ang) * R - oy);
        arr[j + 2] = (0.35 + 0.65 * Math.sin(Math.PI * u)) * 3.6 * sz * scale * (1 - 0.4 * u);
      } else {
        arr[j] = 0; arr[j + 1] = 0; arr[j + 2] = -40;
      }
    }

    gl.uniform3fv(U['uB[0]'], arr);
    gl.uniform1f(U.uTime, (now / 1000) % 1000);
    gl.uniform1f(U.uK, 11 * sz * scale);
    gl.uniform1f(U.uR, 11 * sz * pf);
    gl.uniform1f(U.uAlpha, alpha);
    gl.uniform1f(U.uDark, dark);
    gl.uniform1f(U.uRefr, P.refract);
    gl.uniform1f(U.uWob, 0.9 * sz * wobE);
    gl.uniform3f(U.uVel, dirx, diry, stretch);
    gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]);
    gl.uniform2f(U.uOrg, ox, -oy);
    let ripOn = false;
    for (let i = 0; i < 2; i++) {
      const on = rips[i].t < RIP_DUR;
      if (on) ripOn = true;
      ripArr[i * 4] = rips[i].x - ox;
      ripArr[i * 4 + 1] = -(rips[i].y - oy);
      ripArr[i * 4 + 2] = rips[i].t;
      ripArr[i * 4 + 3] = on ? 1 : 0;
    }
    gl.uniform4fv(U['uRip[0]'], ripArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Đứng yên và mọi thứ đã lắng xuống: dừng vẽ (khung hình cuối vẫn nằm trên màn hình)
    let still = speed < 8 && dist(c[0], [mouse.x, mouse.y]) < 0.02
      && stretch === stretchT && und === undT && wobE === 0
      && alpha === alphaT && scale === scaleT && press === pressT && dark === darkT && bgDone && !ripOn && !satOn;
    for (let i = 1; i < N && still; i++) {
      if (dist(c[i], tg[i]) > 0.05 || Math.hypot(v[i][0], v[i][1]) > 0.05) still = false;
    }
    settle = still ? settle + 1 : 0;
    if (settle > 2) { cancelAnimationFrame(raf); raf = 0; }
  }

  function wake() {
    settle = 0;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  /* ---------- Sự kiện ---------- */
  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!shown) {
      c.forEach((p) => { p[0] = mouse.x; p[1] = mouse.y; });
      v.forEach((p) => { p[0] = 0; p[1] = 0; });
      bg[0] = bgT[0]; bg[1] = bgT[1]; bg[2] = bgT[2];
      shown = true;
    }
    if (e.target !== lastTarget) { lastTarget = e.target; classify(e.target); }
    wake();
  };
  // Nhấn: giọt đầy lên, bắn hạt nước, mặt nước gợn sóng kính lỏng tại chỗ bấm
  const onDown = (e) => {
    if (e.pointerType === 'touch' || e.button > 0) return;
    pressT = 1;
    if (!calm && alphaT > 0) {
      rips[ripI] = { x: e.clientX, y: e.clientY, t: 0 };
      ripI ^= 1;
      sat.t = 0; sat.a = Math.random() * 6.283;
      wobE = 1;
    }
    wake();
  };
  // Thả: giọt nảy nhẹ như thạch
  const onUp = (e) => {
    if (e.pointerType === 'touch') return;
    pressT = 0;
    if (!calm && alphaT > 0) press = -0.18;
    wake();
  };
  // Rời khỏi cửa sổ (hoặc đi vào iframe): ẩn giọt
  const onOut = (e) => { if (!e.relatedTarget) { alphaT = 0; lastTarget = null; wake(); } };
  // Cuộn trang làm phần tử dưới con trỏ đổi mà chuột không nhúc nhích: xét lại
  let scrollRaf = 0;
  const onScroll = () => {
    if (scrollRaf || !shown) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const el = document.elementFromPoint(mouse.x, mouse.y);
      if (el) { lastTarget = el; classify(el); wake(); }
    });
  };
  const onHidden = () => { if (document.hidden) { alphaT = 0; lastTarget = null; wake(); } };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  document.addEventListener('visibilitychange', onHidden);

  function destroy() {
    cancelAnimationFrame(raf); raf = 0;
    offParams();
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('visibilitychange', onHidden);
    document.documentElement.classList.remove('liquid-cursor-on');
    canvas.remove(); style.remove();
    delete window.__liquidCursor;
  }

  // Mất ngữ cảnh WebGL: trả lại con trỏ mặc định ngay, không để người dùng mất chuột
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); });

  const api = { destroy };
  window.__liquidCursor = api;
  return api;
}