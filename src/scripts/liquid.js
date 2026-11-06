/* =========================================================
   LIQUID.JS - Kính lỏng / nước chảy biến hình   (bản nâng cấp: mịn viền + dịu màu)
   Một khối chất lỏng duy nhất, vẽ bằng ray marching trong fragment shader (GPU):
     01 Giọt nước        (Ý tưởng)   - nước: gợn mạnh, trong, ít tán sắc
     02 Tấm kính lỏng    (Thiết kế)  - kính: sắc nét, khúc xạ, tán sắc nhẹ
     03 Chữ </> bằng chất lỏng (Code)
     04 Vòng + lõi       (Ra mắt)    - vòng chất lỏng ôm một giọt

   NÂNG CẤP SO VỚI BẢN CŨ
     Chống răng cưa
       - Viền khối có độ phủ (coverage) mềm theo kích thước 1 pixel -> hết răng cưa ở mép, cả PC lẫn điện thoại
       - Ngưỡng chạm và bước lấy pháp tuyến co giãn theo kích thước pixel -> mặt kính không lấm tấm
       - Đèn studio (vệt sáng phản chiếu) dùng chuyển tiếp mềm thay vì cạnh cứng
       - Ký hiệu trong kính được làm mềm trước khi khúc xạ, vệt màu là dải gradient mềm
       - Độ phân giải tự thích ứng nâng trần lên gần độ nét gốc của màn hình (trước đây chỉ 62% rồi bị phóng to)
       - Thêm dither nhẹ để xoá vệt bậc (banding) ở vùng tối
     Dịu màu
       - Dải màu cùng họ xanh (xanh trời / chàm / lơ / băng) trên nền xanh navy sâu, độ bão hoà vừa phải
       - Bỏ các vệt trắng gắt, ký hiệu là trắng ngà bán trong
       - Giảm tán sắc, giảm hấp thụ màu, giảm ánh viền, thêm tone mapping mềm để không cháy sáng

   Cách dùng (giữ nguyên như bản cũ):
     const api = initLiquid(holder, { palette, focus, pointerTarget, calm })
     api.setScrub(t)  t = 0..3
     api.pulse()
     api.onScrubFrame (r,g,b)
     api.stats()      { fps, res }
   ========================================================= */
import * as THREE from 'three';
import gsap from 'gsap';
import { getParams, onParams } from './liquid-params.js';

const CAMZ = 4.6;          // khoảng cách camera tới tâm khối
const KFOV = 0.78;         // hệ số góc nhìn
const PLANEZ = -2.2;       // mặt phẳng chứa bức tranh phía sau
const PLANE_HALF = 2.5;    // bức tranh phủ từ -2.5 đến +2.5

/* Thông số vật liệu theo từng chương: ior = độ khúc xạ, disp = độ tán sắc màu, wob = độ gợn mặt nước */
const MAT = [
  { ior: 1.33, disp: 0.006, wob: 0.050 },   // nước
  { ior: 1.52, disp: 0.026, wob: 0.010 },   // kính
  { ior: 1.45, disp: 0.018, wob: 0.025 },   // kính pha nước
  { ior: 1.40, disp: 0.015, wob: 0.038 },   // nước đặc
];

const VERT = /* glsl */`
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec2  uRes;
  uniform float uTime;
  uniform float uS;          // hình bên trái của cặp đang chuyển (0..2)
  uniform float uF;          // mức chuyển sang hình kế tiếp (0..1)
  uniform vec2  uCenter;     // tâm khối trên màn hình (đơn vị: chiều cao màn hình)
  uniform float uFit;        // hệ số co để khối vừa khung
  uniform vec2  uRot;        // yaw, pitch
  uniform float uWob;        // độ gợn mặt nước
  uniform float uKick;       // cú "sóng sánh" khi đổi chương / cuộn nhanh
  uniform vec4  uP0;         // chuỗi giọt bám theo con trỏ: xyz = vị trí, w = bán kính
  uniform vec4  uP1;
  uniform vec4  uP2;
  uniform vec4  uRip[3];     // gợn sóng: xyz = gốc, w = thời điểm sinh
  uniform float uIor;
  uniform float uDisp;
  uniform vec3  uTint;
  uniform sampler2D uBgA;
  uniform sampler2D uBgB;
  uniform float uBgMix;

  const float CAMZ = ${CAMZ.toFixed(2)};
  const float KFOV = ${KFOV.toFixed(2)};
  const float PLANEZ = ${PLANEZ.toFixed(2)};
  const float PLANE_HALF = ${PLANE_HALF.toFixed(2)};

  mat3 R;

  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

  float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }
  float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
  }
  float sdCap(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }

  /* 4 hình */
  float shape(float id, vec3 p) {
    if (id < 0.5) return length(p) - 1.05;                                   // giọt nước
    if (id < 1.5) return sdRoundBox(p, vec3(1.2, 0.78, 0.14), 0.2);          // tấm kính
    if (id < 2.5) {                                                          // </> bằng chất lỏng
      float d = sdCap(p, vec3(-0.35, 0.55, 0.0), vec3(-0.95, 0.0, 0.0), 0.2);
      d = smin(d, sdCap(p, vec3(-0.95, 0.0, 0.0), vec3(-0.35, -0.55, 0.0), 0.2), 0.15);
      d = smin(d, sdCap(p, vec3(0.35, 0.55, 0.0), vec3(0.95, 0.0, 0.0), 0.2), 0.15);
      d = smin(d, sdCap(p, vec3(0.95, 0.0, 0.0), vec3(0.35, -0.55, 0.0), 0.2), 0.15);
      d = smin(d, sdCap(p, vec3(0.22, 0.7, 0.0), vec3(-0.22, -0.7, 0.0), 0.2), 0.15);
      return d;
    }
    float t = length(vec2(length(p.xy) - 0.95, p.z)) - 0.27;                 // vòng + lõi
    return smin(t, length(p) - 0.42, 0.35);
  }

  float map(vec3 p) {
    vec3 q = R * p;

    // Biến hình: trộn khoảng cách của 2 hình (chỉ tính hình thứ 2 khi cần)
    float d = shape(uS, q);
    if (uF > 0.999) d = shape(uS + 1.0, q);
    else if (uF > 0.001) d = mix(d, shape(uS + 1.0, q), uF);

    // Mặt nước chảy
    float w = sin(q.x * 3.1 + uTime * 1.3 + sin(q.y * 2.7 + uTime * 0.9))
            * sin(q.y * 3.3 - uTime * 1.1)
            * sin(q.z * 2.9 + uTime * 0.8);
    d += w * (uWob + uKick * 0.06);

    // Gợn sóng lan trên mặt
    for (int i = 0; i < 3; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.w;
      if (age > 0.0 && age < 4.0) {
        float rr = length(p - r.xyz);
        d += sin(rr * 10.0 - age * 9.0) * exp(-age * 1.5) * exp(-rr * 1.1) * 0.05;
      }
    }

    // Chuỗi giọt bám theo con trỏ, hoà vào khối bằng smooth-min
    float dp = length(p - uP0.xyz) - uP0.w;
    dp = smin(dp, length(p - uP1.xyz) - uP1.w, 0.3);
    dp = smin(dp, length(p - uP2.xyz) - uP2.w, 0.3);
    return smin(d, dp, 0.45);
  }

  /* Pháp tuyến: bước lấy mẫu co giãn theo kích thước pixel -> mặt kính mịn, không lấm tấm */
  vec3 calcN(vec3 p, float eps) {
    vec2 e = vec2(eps, -eps);
    return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
                     e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
  }

  /* Bức tranh phía sau (2 ảnh, trộn theo uBgMix). Trả về màu ĐÃ NHÂN alpha (premultiplied).
     Ngoài vùng ảnh là trong suốt */
  vec4 bgSample(vec2 xy) {
    vec2 uv = xy / (2.0 * PLANE_HALF) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return mix(texture2D(uBgA, uv), texture2D(uBgB, uv), uBgMix);
  }

  vec4 refrSample(vec3 p, vec3 rd, vec3 n, float ior) {
    vec3 rr = refract(rd, n, 1.0 / ior);
    float tt = (PLANEZ - p.z) / min(rr.z, -0.15);
    tt = clamp(tt, 0.0, 9.0);
    return bgSample(p.xy + rr.xy * tt);
  }

  /* Môi trường phản chiếu: vài hộp đèn studio MỀM (chuyển tiếp rộng, không cạnh cứng) */
  vec3 env(vec3 r) {
    float key = pow(smoothstep(0.55, 0.97, dot(r, normalize(vec3(-0.55, 0.65, 0.55)))), 3.0);
    float rim = pow(smoothstep(0.72, 0.98, dot(r, normalize(vec3(0.85, 0.15, 0.35)))), 2.0);
    float bar = smoothstep(0.20, 0.0, abs(r.y - 0.28)) * smoothstep(0.10, 0.50, r.z);
    float top = smoothstep(0.78, 0.99, r.y);
    float sky = 0.03 + 0.09 * smoothstep(-0.6, 0.9, r.y);
    vec3 amb = vec3(sky * 0.85, sky, sky * 1.3);                      // nền môi trường hơi xanh lạnh
    return amb + vec3(0.90, 0.95, 1.0) * (key * 0.70 + rim * 0.32 + bar * 0.22 + top * 0.20);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec2 q = (uv - uCenter) * uFit;
    vec3 ro = vec3(0.0, 0.0, CAMZ);
    vec3 rd = normalize(vec3(q * KFOV, -1.0));
    R = rotX(uRot.y) * rotY(uRot.x);

    // Kích thước 1 pixel trong không gian thế giới, tính theo mỗi đơn vị khoảng cách
    float pxk = uFit * KFOV / uRes.y;

    // Sphere tracing + ghi lại điểm gần khối nhất (để tính độ phủ mềm ở viền)
    float t = 0.0, minD = 1e9, tMin = 0.0;
    bool hit = false;
    vec3 p = ro;
    for (int i = 0; i < __STEPS__; i++) {
      p = ro + rd * t;
      float d = map(p);
      float pw = t * pxk;
      if (d < minD) { minD = d; tMin = t; }
      if (d < max(0.0012, pw * 0.45)) { hit = true; break; }
      t += d * 0.82;
      if (t > 8.0) break;
    }

    // Viền chống răng cưa: tia sượt qua mép trong phạm vi ~1 pixel được phủ một phần
    float cov = 1.0;
    if (!hit) {
      float rel = minD / max(tMin * pxk, 0.0001);
      cov = 1.0 - smoothstep(0.35, 1.3, rel);
      if (cov < 0.004) { gl_FragColor = vec4(0.0); return; }   // ngoài khối: trong suốt
      p = ro + rd * tMin;
    }

    float px = length(p - ro) * pxk;
    vec3 n = calcN(p, max(0.003, px * 0.7));
    vec3 V = -rd;
    float ndv = clamp(dot(n, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    float thick = 0.5 + 0.9 * (1.0 - ndv);

    // Khúc xạ + tán sắc nhẹ: mỗi kênh màu bẻ theo một chiết suất khác nhau
    vec3 base = vec3(0.025, 0.040, 0.078);                    // xanh navy sâu thay cho đen thuần
    vec4 sr = refrSample(p, rd, n, uIor - uDisp);
    vec4 sg = refrSample(p, rd, n, uIor);
    vec4 sb = refrSample(p, rd, n, uIor + uDisp);
    vec3 col = vec3(sr.r + base.r * (1.0 - sr.a),
                    sg.g + base.g * (1.0 - sg.a),
                    sb.b + base.b * (1.0 - sb.a));

    // Hấp thụ màu theo độ dày + phản chiếu + ánh viền mảnh (đều đã giảm cường độ cho dịu mắt)
    col *= mix(vec3(1.0), uTint, clamp(thick * 0.45, 0.0, 1.0));
    vec3 spec = env(reflect(rd, n)) * (0.22 + 0.55 * fres);
    col = col * (1.0 - 0.30 * fres) + spec + uTint * pow(1.0 - ndv, 4.0) * 0.20;

    // Tone mapping mềm: vùng sáng không bị cháy trắng gắt
    col = col / (1.0 + 0.18 * col) * 1.10;

    // Dither rất nhẹ: xoá vệt bậc ở vùng tối
    col += (hash12(gl_FragCoord.xy) - 0.5) / 160.0;
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col * cov, cov);                      // premultiplied alpha
  }
`;

/* ---------- Vẽ nền màu NẰM SAU khối (chỉ thấy qua khúc xạ) ----------
   Bảng màu cùng họ xanh, suy ra từ màu chính P.a và trắng ngà P.c:
     deep (navy sâu), A (xanh chính), sky (xanh trời), indigo (chàm), cyan (lơ), ice (băng)
   Vệt màu là dải gradient mềm, ký hiệu được làm mềm trước khi khúc xạ. */
const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgba = (c, a) => `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`;

function makeBg(i, P) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');

  const A = P.a, W = P.c;
  const deep = [A[0] * 0.16 + 0.01, A[1] * 0.20 + 0.015, A[2] * 0.32 + 0.04];
  const sky = lerp3(A, W, 0.5);
  const indigo = lerp3(A, [0.42, 0.36, 0.98], 0.6);
  const cyan = lerp3(A, [0.20, 0.82, 0.92], 0.55);
  const ice = lerp3(A, W, 0.78);
  const COL = { A, sky, indigo, cyan, ice };

  // 1) Nền navy: sáng ở giữa, tối dần ra ngoài -> kính luôn có màu, không có "lỗ đen"
  const bgGrad = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.55);
  bgGrad.addColorStop(0, rgba(lerp3(deep, A, 0.38), 1));
  bgGrad.addColorStop(0.6, rgba(lerp3(deep, A, 0.12), 1));
  bgGrad.addColorStop(1, rgba(deep, 1));
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, S, S);

  // 2) Dải màu mềm: [lệch khỏi tâm, độ dày, màu, độ đậm]
  const SET = [
    { ang: -0.55, bands: [[-250, 240, 'A', 0.80], [-40, 120, 'ice', 0.40], [130, 180, 'cyan', 0.60], [320, 270, 'indigo', 0.80]] },
    { ang: 0.40,  bands: [[-300, 190, 'indigo', 0.75], [-110, 270, 'A', 0.80], [110, 110, 'sky', 0.45], [280, 230, 'cyan', 0.65]] },
    { ang: -0.25, bands: [[-270, 270, 'cyan', 0.65], [-60, 150, 'A', 0.70], [90, 100, 'ice', 0.40], [260, 250, 'indigo', 0.80]] },
    { ang: 0.70,  bands: [[-280, 210, 'A', 0.80], [-90, 120, 'sky', 0.45], [100, 270, 'indigo', 0.80], [300, 170, 'cyan', 0.60]] },
  ][i];
  g.save();
  g.translate(S / 2, S / 2);
  g.rotate(SET.ang);
  const PROFILE = [[0, 0], [0.15, 0.10], [0.30, 0.50], [0.50, 1], [0.70, 0.50], [0.85, 0.10], [1, 0]];
  SET.bands.forEach(([o, w, k, a]) => {
    const grad = g.createLinearGradient(0, o - w / 2, 0, o + w / 2);
    PROFILE.forEach(([s, v]) => grad.addColorStop(s, rgba(COL[k], a * v)));
    g.fillStyle = grad;
    g.fillRect(-900, o - w / 2, 1800, w);
  });
  g.restore();

  // 3) Vignette: làm mờ dần ra rìa để mép bức tranh không bao giờ lộ đường cắt
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(S / 2, S / 2, S * 0.26, S / 2, S / 2, S * 0.5);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';

  // 4) Ký hiệu: vẽ ở độ phân giải thấp rồi phóng lên -> cạnh mềm, khúc xạ không bị răng cưa
  const SM = 256, k = SM / S;
  const sc = document.createElement('canvas');
  sc.width = sc.height = SM;
  const s = sc.getContext('2d');
  s.scale(k, k);
  s.fillStyle = s.strokeStyle = rgba(ice, 1);
  s.textAlign = 'center'; s.textBaseline = 'middle';
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  if (i === 0) { s.font = `800 440px ${sans}`; s.fillText('?', 512, 540); }
  else if (i === 1) { s.font = `800 380px ${sans}`; s.fillText('Aa', 512, 540); }
  else if (i === 2) { s.font = '800 340px ui-monospace, Menlo, Consolas, monospace'; s.fillText('{ }', 512, 540); }
  else {
    s.lineWidth = 72; s.lineCap = 'round'; s.lineJoin = 'round';
    s.beginPath(); s.moveTo(360, 664); s.lineTo(664, 360); s.stroke();
    s.beginPath(); s.moveTo(430, 360); s.lineTo(664, 360); s.lineTo(664, 594); s.stroke();
  }
  g.save();
  g.globalAlpha = 0.78;                       // trắng ngà bán trong, không chói
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(sc, 0, 0, S, S);
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.premultiplyAlpha = true;              // shader dùng màu đã nhân alpha: không viền bẩn ở vùng nửa trong suốt
  tex.minFilter = THREE.LinearFilter;       // không mipmap: tránh vệt nối ở mép khi lấy mẫu trong nhánh rẽ
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/* ---------- HÀM CHÍNH ---------- */
export function initLiquid(container, options = {}) {
  const { palette, focus, pointerTarget = container, calm = false } = options;
  const api = {
    onScrubFrame: null, setScrub() {}, pulse() {}, stats: () => ({ fps: 0, res: 0 }),
  };

  let GP = getParams().glass;        // độ lớn + độ khúc xạ từ bảng chỉnh

  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const STEPS = isMobile ? 36 : 56;
  const DPR = window.devicePixelRatio || 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    container.classList.add('no-gl');
    return api;                       // máy không hỗ trợ WebGL: để trống, phần chữ vẫn chạy bình thường
  }
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', imageRendering: 'auto' });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tex = palette.map((P, i) => makeBg(i, P));

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 }, uS: { value: 0 }, uF: { value: 0 },
    uCenter: { value: new THREE.Vector2(0, 0) }, uFit: { value: 1 },
    uRot: { value: new THREE.Vector2(0, 0) },
    uWob: { value: 0.05 }, uKick: { value: 0 },
    uP0: { value: new THREE.Vector4(0, 0, 0, -0.6) },
    uP1: { value: new THREE.Vector4(0, 0, 0, -0.6) },
    uP2: { value: new THREE.Vector4(0, 0, 0, -0.6) },
    uRip: { value: [new THREE.Vector4(0, 0, 0, -100), new THREE.Vector4(0, 0, 0, -100), new THREE.Vector4(0, 0, 0, -100)] },
    uIor: { value: MAT[0].ior }, uDisp: { value: MAT[0].disp },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uBgA: { value: tex[0] }, uBgB: { value: tex[1] }, uBgMix: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG.replace('__STEPS__', String(STEPS)),
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  /* ----- Độ phân giải tự thích ứng: máy yếu thì giảm, máy khoẻ thì tăng.
     Trần được nâng lên gần độ nét gốc của màn hình (không vượt quá devicePixelRatio) ----- */
  const qMax = Math.min(DPR, isMobile ? 1.1 : 1.25);
  const qMin = isMobile ? 0.5 : 0.55;
  let q = Math.min(qMax, isMobile ? 0.75 : 0.95);

  /* ----- Bố cục: khối nằm ở đâu và to cỡ nào (đọc từ phần tử `focus`) ----- */
  let cx = 0, cy = 0, fit = 1;
  function layout() {
    const cr = container.getBoundingClientRect();
    if (!cr.height) return;
    const fr = (focus || container).getBoundingClientRect();
    cx = ((fr.left + fr.width / 2) - (cr.left + cr.width / 2)) / cr.height;
    cy = -((fr.top + fr.height / 2) - (cr.top + cr.height / 2)) / cr.height;
    const size = Math.min(fr.width, fr.height) / cr.height;
    fit = Math.min(3.2, Math.max(0.7, 0.87 / Math.max(size, 0.1))) / GP.size;   // size lớn hơn -> fit nhỏ hơn -> khối to hơn
    uniforms.uCenter.value.set(cx, cy);
    uniforms.uFit.value = fit;
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(q, DPR));
    renderer.setSize(w, h, false);
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    uniforms.uRes.value.copy(v);
    layout();
  }
  new ResizeObserver(resize).observe(container);
  if (focus) new ResizeObserver(layout).observe(focus);
  resize();
  onParams((s) => { GP = s.glass; layout(); });

  /* ----- Con trỏ -> toạ độ thế giới (mặt phẳng z = 0), cùng công thức với shader ----- */
  const toWorld = (clientX, clientY) => {
    const r = container.getBoundingClientRect();
    const ux = (clientX - r.left - r.width / 2) / r.height;
    const uy = -(clientY - r.top - r.height / 2) / r.height;
    return [(ux - cx) * fit * KFOV * CAMZ, (uy - cy) * fit * KFOV * CAMZ];
  };

  /* ----- Gợn sóng: vòng đệm 3 ô ----- */
  let ripI = 0, time = 0;
  const addRipple = (x, y, z) => { uniforms.uRip.value[ripI].set(x, y, z, time); ripI = (ripI + 1) % 3; };

  /* ----- API ----- */
  let scrubTarget = 0, scrubPos = 0;
  const kick = { v: 0 };
  api.setScrub = (t) => { scrubTarget = t; };
  api.pulse = () => {
    if (calm) return;
    addRipple(0, 0, 1.0);
    gsap.fromTo(kick, { v: 1 }, { v: 0, duration: 1.6, ease: 'power2.out', overwrite: true });
  };

  /* ----- Tương tác ----- */
  const tgt = [0, 0];
  let active = false, activeTimer = 0;
  let down = false, downT = 0, moved = 0, lastX = 0, dragVel = 0, dragRot = 0;
  let pressTarget = 0, press = 0, nx = 0, ny = 0;

  const isUi = (e) => !!(e.target instanceof Element && e.target.closest('button, a'));
  const normPointer = (e) => {
    const r = container.getBoundingClientRect();
    nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const deactivate = (delay) => { clearTimeout(activeTimer); activeTimer = window.setTimeout(() => { active = false; }, delay); };

  pointerTarget.addEventListener('pointermove', (e) => {
    const w = toWorld(e.clientX, e.clientY);
    tgt[0] = w[0]; tgt[1] = w[1];
    active = true; clearTimeout(activeTimer);
    normPointer(e);
    if (down) {
      const dx = e.clientX - lastX;
      dragRot += dx * 0.006; dragVel = dx * 0.006;
      moved += Math.abs(dx); lastX = e.clientX;
    }
  });
  pointerTarget.addEventListener('pointerleave', () => deactivate(250));
  pointerTarget.addEventListener('pointerdown', (e) => {
    if (isUi(e)) return;
    const w = toWorld(e.clientX, e.clientY);
    tgt[0] = w[0]; tgt[1] = w[1];
    active = true; clearTimeout(activeTimer);
    down = true; moved = 0; lastX = e.clientX; dragVel = 0; downT = performance.now();
    pressTarget = 1;
  });
  window.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false; pressTarget = 0;
    // Bấm nhẹ (không kéo): tạo một vòng sóng gợn tại điểm bấm
    if (moved < 6 && performance.now() - downT < 450 && !calm) {
      const w = toWorld(e.clientX, e.clientY);
      addRipple(w[0], w[1], 0.9);
    }
    if (e.pointerType !== 'mouse') deactivate(700);   // cảm ứng: giọt nán lại một chút rồi tan
  });
  // Trình duyệt huỷ cử chỉ (vuốt dọc để cuộn trang): không tính là bấm
  window.addEventListener('pointercancel', () => { down = false; pressTarget = 0; deactivate(500); });

  /* ----- Chuỗi giọt: mỗi giọt đuổi theo giọt trước bằng lò xo, tạo cái đuôi chất lỏng ----- */
  const chain = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const RAD = [0.26, 0.19, 0.13];
  let vis = 0;
  const idle = (t) => [Math.cos(t * 0.45) * 1.55, Math.sin(t * 0.62) * 0.95, Math.sin(t * 0.38) * 0.6];

  /* ----- Vòng lặp vẽ ----- */
  const clock = new THREE.Clock();
  let running = true, lastT = 0, fps = 60, curS = -1;
  let accT = 0, accN = 0;
  api.stats = () => ({ fps, res: Math.round(q * 100) });

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const now = clock.getElapsedTime();
    const raw = now - lastT;
    const dt = Math.min(raw, 0.1);
    lastT = now;

    // fps làm mượt + điều chỉnh độ phân giải (mỗi 90 khung)
    if (raw > 0 && raw < 0.25) {
      fps += (1 / raw - fps) * 0.05;
      accT += raw; accN++;
      if (accN >= 90) {
        const avg = accN / accT;
        if (avg < 42 && q > qMin) { q = Math.max(qMin, q - 0.08); resize(); }
        else if (avg > 57 && q < qMax) { q = Math.min(qMax, q + 0.04); resize(); }
        accT = 0; accN = 0;
      }
    }

    time += dt * (calm ? 0.25 : 1);
    uniforms.uTime.value = time;

    // Hình + vật liệu + màu theo tiến độ cuộn
    scrubPos += (scrubTarget - scrubPos) * (1 - Math.exp(-dt * 8));
    const s = Math.min(2, Math.floor(scrubPos));
    const f = smooth(0.25, 0.75, scrubPos - s);
    uniforms.uS.value = s; uniforms.uF.value = f;
    if (s !== curS) { curS = s; uniforms.uBgA.value = tex[s]; uniforms.uBgB.value = tex[s + 1]; }
    uniforms.uBgMix.value = f;

    const M0 = MAT[s], M1 = MAT[s + 1];
    // Khúc xạ: GP.refract nhân vào phần "vượt trên 1" của chiết suất và vào độ tán sắc
    uniforms.uIor.value = 1 + (M0.ior + (M1.ior - M0.ior) * f - 1) * GP.refract;
    uniforms.uDisp.value = (M0.disp + (M1.disp - M0.disp) * f) * GP.refract;
    uniforms.uWob.value = (M0.wob + (M1.wob - M0.wob) * f) * (calm ? 0.3 : 1);
    const A = lerp3(palette[s].a, palette[s + 1].a, f);
    uniforms.uTint.value.set(1 - (1 - A[0]) * 0.40, 1 - (1 - A[1]) * 0.40, 1 - (1 - A[2]) * 0.40);
    api.onScrubFrame?.(A[0], A[1], A[2]);

    // Cuộn nhanh hoặc đổi chương: mặt nước sánh lên rồi lắng xuống
    const velKick = calm ? 0 : Math.min(1, Math.abs(scrubTarget - scrubPos) * 0.9);
    uniforms.uKick.value = Math.min(1.4, kick.v + velKick);

    // Xoay: lắc nhẹ + kéo có quán tính (tự trôi về chính diện) + nghiêng theo con trỏ
    if (!down) { dragRot += dragVel; dragVel *= Math.pow(0.9, dt * 60); }
    dragRot *= Math.exp(-dt * 0.3);
    const yaw = Math.sin(time * 0.35) * 0.45 + dragRot + nx * 0.35;
    const pitch = ny * 0.22 + Math.sin(time * 0.27) * 0.08;
    uniforms.uRot.value.x += (yaw - uniforms.uRot.value.x) * (1 - Math.exp(-dt * 7));
    uniforms.uRot.value.y += (pitch - uniforms.uRot.value.y) * (1 - Math.exp(-dt * 7));

    // Chuỗi giọt: bám con trỏ nếu có, không thì tự quay quanh khối
    const target = active ? [tgt[0], tgt[1], 0.35] : (calm ? null : idle(time));
    vis += ((target ? 1 : 0) - vis) * (1 - Math.exp(-dt * 5));
    if (target) {
      const k0 = 1 - Math.exp(-dt * 14);
      for (let i = 0; i < 3; i++) chain[0][i] += (target[i] - chain[0][i]) * k0;
    }
    const k1 = 1 - Math.exp(-dt * 8), k2 = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 3; i++) {
      chain[1][i] += (chain[0][i] - chain[1][i]) * k1;
      chain[2][i] += (chain[1][i] - chain[2][i]) * k2;
    }
    press += (pressTarget - press) * (1 - Math.exp(-dt * 10));
    const pf = 1 + press * 0.7;
    for (let i = 0; i < 3; i++) {
      // Khi ẩn: bán kính âm đủ lớn để giọt biến mất hẳn khỏi phép hoà
      uniforms['uP' + i].value.set(chain[i][0], chain[i][1], chain[i][2], RAD[i] * pf * vis - (1 - vis) * 0.6);
    }

    renderer.render(scene, camera);
  }
  tick();

  /* ----- Tạm dừng khi ra khỏi màn hình (tiết kiệm pin) ----- */
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; lastT = clock.getElapsedTime(); tick(); }
    if (!entry.isIntersecting) running = false;
  }).observe(container);

  return api;
}