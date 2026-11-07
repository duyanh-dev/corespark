/* =========================================================
   STUDIO3D.JS - Khối kính LỎNG vật lý chứa các công nghệ bên trong
   Kỹ thuật: MeshPhysicalMaterial (transmission = khúc xạ thật) + vertex shader tự chèn
   (onBeforeCompile) để bề mặt biến dạng như chất lỏng.
   Hiệu ứng lỏng:
     1. Bề mặt "thở": nhiễu simplex noise dịch chuyển đỉnh theo thời gian
     2. Jelly: kéo nhanh thì khối dãn theo hướng kéo rồi rung lại như thạch (spring)
     3. Ripple: bấm vào đâu, sóng nước lan ra từ điểm đó
     4. Morph: cầu <-> khối <-> xoắn chảy thẳng vào nhau (không còn thu về 0)
   5. Viên thuốc kính lỏng: trôi theo dòng, co giãn theo vận tốc, hòa vào khối khi đi gần mặt
   Cách dùng (API giữ nguyên như cũ):
     const api = initStudio(el); api.setShape('knot')
     api.setLiquid(1.5)  // MỚI: độ lỏng, 0 = đứng yên, 1 = mặc định, 2 = rất lỏng
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

/* ---------- CẤU HÌNH ---------- */
// Màu nền khung 3D: PHẢI trùng với background của .studio__stage trong Studio.astro
const STAGE_BG = '#0b0b0d';

// Các công nghệ nằm trong khối kính [tên, màu chip]. NỘI DUNG LÀ MẪU, sửa theo ý bạn
const TAGS = [
  ['HTML', '#ff9f0a'], ['CSS', '#0a84ff'], ['JavaScript', '#ffd60a'], ['GSAP', '#30d158'],
  ['Three.js', '#f5f5f7'], ['WebGL', '#bf5af2'], ['Astro', '#ff375f'], ['Responsive', '#64d2ff'],
  ['Shader', '#5e5ce6'], ['ScrollTrigger', '#ff6482'],
];

// Thông số 3 hình (giữ đúng kích thước như bản cũ)
const SPHERE_R = 1.5;                                   // bán kính cầu
const BOX_B = 0.7, BOX_R = 0.55;                        // khối bo góc: nửa cạnh lõi + bán kính bo (2.5/2 = 0.7 + 0.55)
const KNOT_R = 1.05, KNOT_TUBE = 0.46, KNOT_P = 2, KNOT_Q = 3;  // xoắn: bán kính, độ dày ống, p, q

// Thứ tự hình -> chỉ số (dùng cho trọng số morph)
const SHAPE_INDEX = { sphere: 0, box: 1, knot: 2 };

/* =========================================================
   PHẦN A - HÌNH HỌC: 1 lưới đỉnh duy nhất, 3 vị trí đích (cầu / khối / xoắn)
   Cùng một lưới nên các hình có thể "chảy" vào nhau bằng cách trộn vị trí
   ========================================================= */

/* HÀM A1: điểm trên đường cong xoắn tại tham số u (công thức giống TorusKnotGeometry) */
function knotCurvePoint(u, out) {
  const qp = (KNOT_Q / KNOT_P) * u, cs = Math.cos(qp);
  return out.set(
    KNOT_R * (2 + cs) * 0.5 * Math.cos(u),
    KNOT_R * (2 + cs) * Math.sin(u) * 0.5,
    KNOT_R * Math.sin(qp) * 0.5
  );
}

/* HÀM A2: điểm + pháp tuyến trên mặt ống xoắn. u = dọc theo xoắn (0..1), v = quanh ống (0..1)
   flip = lật chiều quanh ống (để mặt quay ra ngoài đúng hướng) */
const _P1 = new THREE.Vector3(), _P2 = new THREE.Vector3();
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _B = new THREE.Vector3();
function knotSurface(u01, v01, flip, outPos, outNor) {
  const u = u01 * KNOT_P * Math.PI * 2;
  const v = (flip ? -1 : 1) * v01 * Math.PI * 2;
  knotCurvePoint(u, _P1);
  knotCurvePoint(u + 0.01, _P2);
  _T.subVectors(_P2, _P1);
  _N.addVectors(_P2, _P1);
  _B.crossVectors(_T, _N);
  _N.crossVectors(_B, _T);
  _B.normalize(); _N.normalize();
  const cx = -KNOT_TUBE * Math.cos(v), cy = KNOT_TUBE * Math.sin(v);
  outPos.set(_P1.x + cx * _N.x + cy * _B.x, _P1.y + cx * _N.y + cy * _B.y, _P1.z + cx * _N.z + cy * _B.z);
  outNor.subVectors(outPos, _P1).normalize();
}

/* HÀM A3: khoảng cách có dấu tới khối bo góc (âm = bên trong). Dùng để dò mặt khối bằng chia đôi */
function sdRoundBox(x, y, z) {
  const qx = Math.max(Math.abs(x) - BOX_B, 0), qy = Math.max(Math.abs(y) - BOX_B, 0), qz = Math.max(Math.abs(z) - BOX_B, 0);
  return Math.hypot(qx, qy, qz) - BOX_R;
}

/* HÀM A4: chiếu hướng (dx,dy,dz) từ tâm ra mặt khối bo góc, trả về điểm và pháp tuyến */
function boxSurface(dx, dy, dz, outPos, outNor) {
  let lo = 0, hi = 4;
  for (let i = 0; i < 24; i++) {                          // chia đôi 24 lần là đủ chính xác
    const mid = (lo + hi) * 0.5;
    if (sdRoundBox(dx * mid, dy * mid, dz * mid) < 0) lo = mid; else hi = mid;
  }
  const t = (lo + hi) * 0.5;
  const px = dx * t, py = dy * t, pz = dz * t;
  outPos.set(px, py, pz);
  // pháp tuyến = hướng từ điểm gần nhất của "lõi" tới điểm trên mặt
  const qx = Math.sign(px) * Math.max(Math.abs(px) - BOX_B, 0);
  const qy = Math.sign(py) * Math.max(Math.abs(py) - BOX_B, 0);
  const qz = Math.sign(pz) * Math.max(Math.abs(pz) - BOX_B, 0);
  outNor.set(qx, qy, qz);
  if (outNor.lengthSq() < 1e-8) outNor.set(dx, dy, dz);
  outNor.normalize();
}

/* HÀM A5: thể tích có dấu của lưới (dương = mặt quay ra ngoài). Dùng để biết có cần lật xoắn không */
function signedVolume(pos, index) {
  let vol = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
         - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
         + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return vol / 6;
}

/* HÀM A6: dựng geometry lưới w x h. Thuộc tính:
   position/normal = cầu | aBox/aBoxN = khối | aKnot/aKnotN = xoắn */
function buildLiquidGeometry(w, h) {
  const count = (w + 1) * (h + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const box = new Float32Array(count * 3), boxN = new Float32Array(count * 3);
  const knot = new Float32Array(count * 3), knotN = new Float32Array(count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();

  // 1) Cầu + khối: dùng hướng từ tâm (kinh độ / vĩ độ như SphereGeometry của three)
  for (let iy = 0, k = 0; iy <= h; iy++) {
    const v = iy / h, sinT = Math.sin(v * Math.PI), cosT = Math.cos(v * Math.PI);
    for (let ix = 0; ix <= w; ix++, k += 3) {
      const u = ix / w;
      const dx = -Math.cos(u * Math.PI * 2) * sinT, dy = cosT, dz = Math.sin(u * Math.PI * 2) * sinT;
      pos[k] = dx * SPHERE_R; pos[k + 1] = dy * SPHERE_R; pos[k + 2] = dz * SPHERE_R;
      nor[k] = dx; nor[k + 1] = dy; nor[k + 2] = dz;
      boxSurface(dx, dy, dz, p, n);
      box[k] = p.x; box[k + 1] = p.y; box[k + 2] = p.z;
      boxN[k] = n.x; boxN[k + 1] = n.y; boxN[k + 2] = n.z;
    }
  }

  // 2) Chỉ số tam giác: lấy ĐỦ mọi tam giác (kể cả hàng cực) vì xoắn cần phủ kín mặt
  const index = [];
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) {
      const a = iy * (w + 1) + ix + 1, b = iy * (w + 1) + ix;
      const c = (iy + 1) * (w + 1) + ix, d = (iy + 1) * (w + 1) + ix + 1;
      index.push(a, b, d, b, c, d);
    }
  }
  const indexArr = new Uint32Array(index);

  // 3) Xoắn: kinh độ -> chạy dọc đường xoắn, vĩ độ -> quay quanh ống
  const fillKnot = (flip) => {
    for (let iy = 0, k = 0; iy <= h; iy++) {
      for (let ix = 0; ix <= w; ix++, k += 3) {
        knotSurface(ix / w, iy / h, flip, p, n);
        knot[k] = p.x; knot[k + 1] = p.y; knot[k + 2] = p.z;
        knotN[k] = n.x; knotN[k + 1] = n.y; knotN[k + 2] = n.z;
      }
    }
  };
  fillKnot(false);
  if (signedVolume(knot, indexArr) < 0) fillKnot(true);   // mặt đang quay vào trong thì lật lại

  const geo = new THREE.BufferGeometry();
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3),
    aBox: new THREE.BufferAttribute(box, 3), aBoxN: new THREE.BufferAttribute(boxN, 3),
    aKnot: new THREE.BufferAttribute(knot, 3), aKnotN: new THREE.BufferAttribute(knotN, 3),
  };
  for (const key in attrs) geo.setAttribute(key, attrs[key]);
  geo.setIndex(new THREE.BufferAttribute(indexArr, 1));
  return { geo, attrs, index: geo.index };
}

/* =========================================================
   PHẦN B - SHADER CHÈN VÀO MeshPhysicalMaterial
   ========================================================= */

/* Khai báo uniform, attribute và các hàm GLSL (chèn sau #include <common>) */
const LIQUID_VERT_DECL = /* glsl */`
  uniform float uTime;        // thời gian (giây)
  uniform float uWobble;      // biên độ gợn "thở"
  uniform vec3  uW;           // trọng số morph (cầu, khối, xoắn), tổng = 1
  uniform vec4  uRip[3];      // 3 sóng ripple: xyz = tâm, w = thời điểm bắt đầu
  uniform float uJelly;       // độ dãn jelly (+ dãn, - bẹp) dọc uJellyDir
  uniform vec4  uTouch;       // xyz = điểm ngón tay chạm, w = cường độ 0..1
  uniform vec3  uPills[${TAGS.length}];   // vị trí các viên thuốc để bề mặt phình về phía chúng
  uniform vec3  uPull;        // vector da bị kéo theo ngón tay
  uniform vec3  uJellyDir;    // hướng jelly, trong không gian vật thể
  attribute vec3 aBox;  attribute vec3 aBoxN;
  attribute vec3 aKnot; attribute vec3 aKnotN;

  // --- Simplex noise 3D (Ashima Arts) ---
  vec3 lqMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 lqMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 lqPermute(vec4 x) { return lqMod289(((x * 34.0) + 1.0) * x); }
  vec4 lqTaylor(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = lqMod289(i);
    vec4 p = lqPermute(lqPermute(lqPermute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = lqTaylor(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // HÀM GLSL 1: đẩy điểm p dọc pháp tuyến n = gợn "thở" (noise) + sóng ripple khi bấm
  vec3 lqDisplace(vec3 p, vec3 n) {
    float t = uTime;
    // hai lớp noise: lớp lớn chậm + lớp nhỏ nhanh hơn, tạo cảm giác giọt nước đang sống
    float w = snoise(p * 0.55 + vec3(0.0, t * 0.18, t * 0.10)) * 0.70
            + snoise(p * 0.90 + vec3(t * 0.12, -t * 0.14, 0.0)) * 0.15;
    float d = w * uWobble;
    // ripple: vòng sóng lan ra từ điểm bấm, mờ dần theo thời gian
    for (int i = 0; i < 3; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.w;
      if (age > 0.0 && age < 3.5) {
        float dist = distance(p, r.xyz);
        float off = dist - age * 2.4;                          // khoảng cách tới mặt sóng
        d += sin(off * 5.0) * exp(-off * off * 1.8) * exp(-age * 1.4) * 0.09;
        d -= exp(-dist * dist * 4.0) * exp(-age * 5.0) * 0.07; // vết lõm lúc ngón tay chạm
      }
    }
    // chạm vào giọt nước: da quanh điểm chạm bị kéo theo ngón tay (uPull) và lõm nhẹ, mềm dần ra xa
    vec3 tp = p - uTouch.xyz;
    float g = exp(-dot(tp, tp) * 1.6) * uTouch.w;
    // viên thuốc hòa vào khối: bề mặt phình về phía viên thuốc khi nó đi gần mặt (như cổ giọt metaball)
    vec3 extra = vec3(0.0);
    for (int k = 0; k < ${TAGS.length}; k++) {
      vec3 c = uPills[k];
      float len = length(c);
      float reach = smoothstep(0.95, 1.45, len) * (1.0 - smoothstep(1.8, 3.0, len));   // chỉ tác dụng khi viên ở gần mặt
      if (reach > 0.001) {
        vec3 dd = c - p;
        float pull = exp(-dot(dd, dd) * 1.7) * reach * 0.5;
        extra += normalize(dd + 1e-4) * pull;
      }
    }
    return p + n * (d - g * 0.05) + uPull * g + extra;
  }

  // HÀM GLSL 2: jelly = dãn theo hướng uJellyDir, co ngang để giữ thể tích. Cập nhật cả pháp tuyến
  void lqJelly(inout vec3 p, inout vec3 n) {
    float a = max(1.0 + uJelly, 0.4);                           // hệ số dọc hướng kéo
    float b = inversesqrt(a);                                   // hệ số ngang (bảo toàn thể tích)
    vec3 d = uJellyDir;
    float pd = dot(p, d);
    p = d * pd * a + (p - d * pd) * b;
    float nd = dot(n, d);
    n = normalize(d * nd / a + (n - d * nd) / b);               // pháp tuyến dùng ma trận nghịch đảo chuyển vị
  }
`;

/* Thay cho #include <beginnormal_vertex>: trộn 3 hình, dịch chuyển đỉnh, tính pháp tuyến mới, jelly */
const LIQUID_VERT_NORMAL = /* glsl */`
  // 1) Trộn vị trí + pháp tuyến theo trọng số morph
  vec3 lqN = normal * uW.x + aBoxN * uW.y + aKnotN * uW.z;
  lqN = (length(lqN) > 1e-4) ? normalize(lqN) : normal;
  vec3 lqP = position * uW.x + aBox * uW.y + aKnot * uW.z;
  // 2) Hệ trục tiếp tuyến tại đỉnh, để tính pháp tuyến mới bằng sai phân hữu hạn
  vec3 lqUp = abs(lqN.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 lqT = normalize(cross(lqN, lqUp));
  vec3 lqB = normalize(cross(lqN, lqT));
  float lqE = 0.03;
  vec3 lqD0 = lqDisplace(lqP, lqN);
  vec3 lqD1 = lqDisplace(lqP + lqT * lqE, lqN);
  vec3 lqD2 = lqDisplace(lqP + lqB * lqE, lqN);
  vec3 objectNormal = normalize(cross(lqD1 - lqD0, lqD2 - lqD0));
  // 3) Jelly áp sau cùng
  lqJelly(lqD0, objectNormal);
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif
`;

/* =========================================================
   PHẦN C - CHIP CHỮ
   ========================================================= */

/* ---------- HÀM 1: texture chữ cho viên thuốc (nền trong suốt, chỉ có chữ) ---------- */
// Chữ được "in" thẳng lên mặt kính trong shader nên không bao giờ lơ lửng cách mặt kính
const PILL_W = 0.92, PILL_H = 0.30;                      // kích thước viên thuốc (dài x cao)
function makePillText(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  const setFont = (s) => { g.font = `700 ${s}px -apple-system, "Inter", "Segoe UI", sans-serif`; };
  let size = 60;
  setFont(size);
  const maxW = 512 * 0.62;                                 // chữ chỉ chiếm phần thân thẳng của viên thuốc
  const w = g.measureText(text).width;
  if (w > maxW) { size = Math.floor(size * maxW / w); setFont(size); }   // chữ dài thì tự thu nhỏ
  g.fillStyle = '#ffffff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 82);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/* ---------- HÀM 2: hình viên thuốc (capsule nằm ngang, hơi dẹt theo chiều sâu), dùng chung cho mọi viên ---------- */
const PILL_GEO = (() => {
  const g = new THREE.CapsuleGeometry(PILL_H / 2, PILL_W - PILL_H, 12, 28);
  g.rotateZ(Math.PI / 2);                                  // trục capsule nằm ngang
  g.scale(1, 1, 0.75);                                     // dẹt bớt chiều sâu cho mảnh hơn
  return g;
})();

/* ---------- HÀM 3: tạo 1 viên thuốc kính lỏng ----------
   Vật liệu đặc (không transmission) để khối kính chính vẫn khúc xạ được nó.
   Cảm giác "kính lỏng" đến từ: gel màu có clearcoat bóng + viền Fresnel sáng + chữ in dưới mặt kính */
function makePill(text, color) {
  const tint = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({
    color: tint, emissive: tint, emissiveIntensity: 0.22,   // phát sáng nhẹ để màu luôn tươi
    roughness: 0.16, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3,
  });
  const textTex = makePillText(text);
  const rim = tint.clone().lerp(new THREE.Color(1, 1, 1), 0.55);   // màu viền sáng
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uText = { value: textTex };
    shader.uniforms.uRim = { value: rim };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');   // vị trí trong hệ viên thuốc, để chiếu chữ phẳng từ phía trước
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform sampler2D uText;\nuniform vec3 uRim;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 tUv = vec2(vObjPos.x / ${PILL_W.toFixed(3)} + 0.5, vObjPos.y / ${PILL_H.toFixed(3)} + 0.5);
        float ink = texture2D(uText, tUv).a * smoothstep(0.0, 0.06, vObjPos.z);   // chỉ in mặt trước
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04), ink);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (1.0 - ink);')   // chữ không bị phát sáng
      .replace('#include <tonemapping_fragment>', `float lqF = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
        gl_FragColor.rgb += uRim * lqF * 0.7;                                     // viền Fresnel sáng như mép kính
        #include <tonemapping_fragment>`);
  };
  return new THREE.Mesh(PILL_GEO, mat);
}

/* =========================================================
   PHẦN D - HÀM CHÍNH
   ========================================================= */
export function initStudio(container) {
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  // --- Renderer (nền đặc để kính có thứ để khúc xạ) ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = isMobile ? 0.5 : 1; // nhẹ hơn trên mobile
  container.appendChild(renderer.domElement);
  // Canvas nằm tuyệt đối trong khung: không ảnh hưởng kích thước khung, tránh canvas "phình ra" dần
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE_BG);
  // Ánh sáng môi trường: nguồn phản chiếu cho kính (không cần đèn riêng)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 8;

  /* ----- Uniform dùng chung cho shader kính lỏng ----- */
  const U = {
    uTime: { value: 0 },
    uWobble: { value: 0.05 },
    uW: { value: new THREE.Vector3(1, 0, 0) },                       // đang là hình cầu
    uRip: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, -1000)) }, // -1000 = sóng chưa kích hoạt
    uJelly: { value: 0 },
    uJellyDir: { value: new THREE.Vector3(1, 0, 0) },
    uTouch: { value: new THREE.Vector4(0, 0, 0, 0) },   // xyz = điểm chạm (không gian vật thể), w = cường độ 0..1
    uPills: { value: Array.from({ length: TAGS.length }, () => new THREE.Vector3(0, 0, 10)) },   // vị trí các viên thuốc (không gian vật thể), 10 = ở xa
    uPull: { value: new THREE.Vector3() },              // vector da bị kéo theo ngón tay (không gian vật thể)
  };

  /* ----- HÀM 2: lưới kính lỏng (1 geometry cho cả 3 hình) ----- */
  const { geo, attrs, index } = buildLiquidGeometry(isMobile ? 128 : 256, isMobile ? 40 : 64);

  // --- Vật liệu kính ---
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04,
    transmission: 1,               // 1 = trong suốt hoàn toàn, có khúc xạ
    thickness: 1.4,                // độ dày để khúc xạ "bẻ" mạnh hơn
    ior: 1.45,                     // chiết suất (kính thật ~1.5)
    attenuationColor: new THREE.Color(0xffffff), attenuationDistance: 0.9,  // kính nhuộm màu
    clearcoat: 1, clearcoatRoughness: 0.03,
  });
  // Chèn shader biến dạng vào vật liệu có sẵn (giữ nguyên toàn bộ phần quang học của three)
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + LIQUID_VERT_DECL)
      .replace('#include <beginnormal_vertex>', LIQUID_VERT_NORMAL)
      .replace('#include <begin_vertex>', 'vec3 transformed = lqD0;');
  };

  // holder: nhóm xoay theo thao tác kéo. glass: khối kính. labels: các chip bên trong
  const holder = new THREE.Group();
  scene.add(holder);
  const glass = new THREE.Mesh(geo, mat);
  glass.frustumCulled = false;       // đỉnh bị dịch chuyển trong shader nên bounding sphere gốc không còn đúng
  holder.add(glass);

  // Lưới vô hình để raycast: dùng đúng vị trí của hình đang hiển thị (shader không đổi geometry trên CPU)
  const pickGeo = new THREE.BufferGeometry();
  pickGeo.setIndex(index);
  pickGeo.setAttribute('position', attrs.position);
  const pick = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  pick.visible = false;
  holder.add(pick);

  // --- Chip công nghệ: rải đều bên trong khối (công thức Fibonacci) ---
  const labels = new THREE.Group();
  holder.add(labels);
  const golden = Math.PI * (3 - Math.sqrt(5));
  TAGS.forEach(([text, color], i) => {
    const m = makePill(text, color);
    const y = 1 - (i / (TAGS.length - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    m.userData.base = new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r).multiplyScalar(0.8);
    m.userData.ph = i * 2.399963;                           // pha riêng mỗi viên để chuyển động không đồng bộ
    m.userData.k = 0.75 + 0.5 * ((i * 0.618) % 1);          // mỗi viên bung xa gần khác nhau
    m.userData.prev = m.userData.base.clone();              // vị trí khung trước (tính vận tốc để co giãn)
    labels.add(m);
  });

  /* ----- Trạng thái hiệu ứng lỏng ----- */
  const state = { burst: 0 };           // độ bung của chip
  const boost = { v: 0 };               // độ "sôi" tạm thời khi đổi hình (cộng vào biên độ gợn)
  let liquid = 1;                       // hệ số độ lỏng toàn cục (setLiquid)
  const jelly = { s: 0, v: 0 };         // spring jelly: s = độ dãn, v = vận tốc của spring
  const jellyNew = new THREE.Vector3();            // hướng kéo vừa đo (tạm), để làm mượt dần sang jellyWorld
  const jellyWorld = new THREE.Vector3(1, 0, 0);   // hướng kéo trong không gian thế giới
  const qInv = new THREE.Quaternion();
  const tgt = { x: 0, y: 0 };                      // góc xoay ĐÍCH (ngón tay / quán tính điều khiển cái này)
  const contact = new THREE.Vector3();             // điểm ngón tay chạm trên mặt khối (không gian vật thể)
  let touching = false;                            // đang có ngón tay giữ trên khối
  const pullSm = new THREE.Vector3();              // vector kéo đã làm mượt (không gian vật thể)
  let touchW = 0;                                  // cường độ chạm 0..1
  const touchPlane = new THREE.Plane(), fingerW = new THREE.Vector3(), contactW = new THREE.Vector3(), pullW = new THREE.Vector3();
  const spr = { vx: 0, vy: 0 };                    // vận tốc spring: khối đuổi theo góc đích, trễ và nảy như chất lỏng

  /* ----- HÀM 3: bấm vào = chip bung ra rồi bật về, khối bóp nhẹ rồi nảy lại ----- */
  function pulse() {
    gsap.timeline()
      .to(state, { burst: 1, duration: 0.35, ease: 'power3.out' })
      .to(state, { burst: 0, duration: 1.5, ease: 'power3.out' });
    gsap.fromTo(holder.scale, { x: 0.88, y: 0.88, z: 0.88 }, { x: 1, y: 1, z: 1, duration: 1.3, ease: 'power3.out', overwrite: true });
  }

  /* ----- HÀM 4: ripple - bắn tia từ con trỏ, lấy điểm chạm trên mặt hình, kích hoạt 1 sóng ----- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitLocal = new THREE.Vector3();
  let ripIdx = 0;                       // vòng tròn qua 3 ô sóng, sóng cũ nhất bị ghi đè
  function ripple(e) {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(pick, false)[0];
    if (!hit) return;                                        // bấm ra ngoài khối thì thôi
    pick.worldToLocal(hitLocal.copy(hit.point));             // đổi về không gian vật thể, khớp với shader
    U.uRip.value[ripIdx].set(hitLocal.x, hitLocal.y, hitLocal.z, U.uTime.value);
    ripIdx = (ripIdx + 1) % 3;
  }

  /* ----- API 1: đổi hình = MORPH (các đỉnh chảy từ hình cũ sang hình mới) ----- */
  const W = { a: 1, b: 0, c: 0 };                            // trọng số hiện tại (cầu, khối, xoắn)
  let currentShape = 'sphere';
  const shapeAttr = [attrs.position, attrs.aBox, attrs.aKnot];
  function setShape(name) {
    if (name === currentShape || !(name in SHAPE_INDEX)) return;
    currentShape = name;
    const k = SHAPE_INDEX[name];
    // Lưới raycast chuyển sang hình đích để bấm trúng đúng chỗ
    pickGeo.setAttribute('position', shapeAttr[k]);
    pickGeo.computeBoundingSphere();
    // Trộn trọng số: các trọng số cùng easing nên tổng luôn = 1
    gsap.to(W, {
      a: k === 0 ? 1 : 0, b: k === 1 ? 1 : 0, c: k === 2 ? 1 : 0,
      duration: 1.3, ease: 'power3.inOut', overwrite: true,
      onUpdate: () => U.uW.value.set(W.a, W.b, W.c),
    });
    // Trong lúc chảy, bề mặt "sôi" mạnh hơn rồi lắng xuống
    gsap.killTweensOf(boost);
    gsap.timeline()
      .to(boost, { v: 1, duration: 0.45, ease: 'power2.out' })
      .to(boost, { v: 0, duration: 1.4, ease: 'power2.inOut' });
  }

  /* ----- API 2: đổi màu kính (chuyển màu mượt) ----- */
  function setTint(hex) {
    const target = new THREE.Color(hex);
    const from = mat.attenuationColor.clone();
    const o = { t: 0 };
    gsap.to(o, {
      t: 1, duration: 0.7, ease: 'power2.out', overwrite: true,
      onUpdate: () => {
        mat.attenuationColor.copy(from).lerp(target, o.t);
        mat.color.set(0xffffff).lerp(mat.attenuationColor, 0.3);   // nhuộm nhẹ cả mặt kính
      },
    });
  }

  /* ----- API 3: chỉnh độ khúc xạ ----- */
  function setIor(v) { mat.ior = THREE.MathUtils.clamp(v, 1, 2.33); }

  /* ----- API 4 (MỚI): chỉnh độ lỏng. 0 = đứng yên, 1 = mặc định, 2 = rất lỏng ----- */
  function setLiquid(v) { liquid = THREE.MathUtils.clamp(v, 0, 2.5); }

  /* ----- Tương tác: kéo xoay có quán tính + nghiêng nhẹ theo chuột + bấm để bung ----- */
  const pointer = new THREE.Vector2();
  let dragging = false, moved = 0, lastX = 0, lastY = 0, vx = 0, vy = 0;

  container.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    startTouch(e);
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
  });
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    tgt.y += dx * 0.008; tgt.x += dy * 0.008;            // chỉ dời góc đích, khối tự đuổi theo bằng spring
    vy += (dx * 0.008 - vy) * 0.35; vx += (dy * 0.008 - vx) * 0.35;                       // nhớ vận tốc để quay tiếp khi thả
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = 'grab';
    touching = false;
    if (e.type === 'pointerup' && moved < 5) { ripple(e); pulse(); }   // di chuyển ít = bấm
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  /* ----- Kích thước: tự co theo khung ----- */
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = Math.max(8, 8.5 / camera.aspect);   // khung hẹp thì lùi camera
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /* ----- HÀM 5: cập nhật jelly mỗi khung hình (spring theo vận tốc kéo) ----- */
  function updateJelly(speed) {
    // Hướng kéo trên màn hình: sang phải = +x, lên = +y (vy từ dx, vx từ dy kéo xuống)
    if (speed > 0.003) {
      jellyNew.set(spr.vy, -spr.vx, 0).normalize();
      if (jellyNew.dot(jellyWorld) < 0) jellyNew.negate();      // trục dãn đối xứng: chọn chiều gần hướng cũ để không bị giật
      jellyWorld.lerp(jellyNew, 0.15).normalize();              // đổi hướng từ từ thay vì nhảy
    }
    // Mục tiêu dãn tỉ lệ với tốc độ; thả tay thì về 0 và spring tự rung quanh 0 như thạch
    const target = Math.min(speed * 2.2, 0.4) * Math.min(liquid, 1.5);
    jelly.v += (target - jelly.s) * 0.16 - jelly.v * 0.80;   // lực đàn hồi - ma sát
    jelly.s = THREE.MathUtils.clamp(jelly.s + jelly.v, -0.4, 0.7);
    U.uJelly.value = jelly.s;
    // Hướng jelly phải nằm trong không gian vật thể (vật thể đang xoay trong holder)
    U.uJellyDir.value.copy(jellyWorld).applyQuaternion(qInv.copy(holder.quaternion).invert());
  }

  /* ----- HÀM 6: bắt đầu chạm - bắn tia từ ngón tay, nhớ điểm chạm trên mặt khối ----- */
  function startTouch(e) {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointer.copy(ndc);                                       // cập nhật vị trí ngón tay ngay (điện thoại không có pointermove trước đó)
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(pick, false)[0];
    touching = !!hit;                                        // chạm ra ngoài khối thì không biến dạng
    if (hit) pick.worldToLocal(contact.copy(hit.point));
  }

  /* ----- HÀM 7: mỗi khung hình - da bị kéo theo ngón tay, thả ra thì co về từ từ (không nảy) ----- */
  function updateTouch() {
    if (touching) {
      // 1) điểm chạm hiện đang ở đâu trong thế giới (khối xoay trễ phía sau ngón tay)
      pick.localToWorld(contactW.copy(contact));
      // 2) ngón tay ở đâu: tia từ con trỏ cắt mặt phẳng vuông góc camera đi qua điểm chạm
      raycaster.setFromCamera(pointer, camera);
      touchPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(pullW).negate(), contactW);
      if (raycaster.ray.intersectPlane(touchPlane, fingerW)) {
        // 3) độ lệch ngón tay - điểm chạm = da bị kéo căng; đổi về không gian vật thể và làm mượt
        pullW.subVectors(fingerW, contactW);
        if (pullW.length() > 0.6) pullW.setLength(0.6);
        pullW.applyQuaternion(qInv.copy(holder.quaternion).invert());
        pullSm.lerp(pullW, 0.25);
      }
      touchW += (1 - touchW) * 0.2;                          // vào chạm: ôm dần
    } else {
      pullSm.multiplyScalar(0.92);                           // thả tay: da co về từ từ
      touchW *= 0.94;
    }
    U.uTouch.value.set(contact.x, contact.y, contact.z, touchW);
    U.uPull.value.copy(pullSm);
  }

  /* ----- Vòng lặp vẽ ----- */
  const tmpQ = new THREE.Quaternion();
  const camInv = new THREE.Quaternion(), tiltQ = new THREE.Quaternion(), pillQ = new THREE.Quaternion();
  const pillPos = new THREE.Vector3(), pillVel = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const t0 = performance.now();
  let running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);

    // Thời gian + biên độ gợn (nền thở + phần "sôi" khi đổi hình), nhân hệ số độ lỏng
    U.uTime.value = (performance.now() - t0) / 1000;
    U.uWobble.value = liquid * (0.05 + 0.06 * boost.v);

    // Jelly đọc vận tốc kéo hiện tại
    updateJelly(Math.hypot(spr.vx, spr.vy));
    updateTouch();
    if (dragging) { vx *= 0.85; vy *= 0.85; }               // giữ chuột đứng yên thì không còn "kéo"

    // Quán tính: thả tay vẫn quay tiếp rồi chậm dần + tự xoay nhẹ
    if (!dragging) {
      tgt.y += vy + 0.0025; tgt.x += vx;
      vy *= 0.96; vx *= 0.96;
      tgt.x *= 0.99;                            // từ từ trở về thẳng
    }
    tgt.x = THREE.MathUtils.clamp(tgt.x, -1.2, 1.2);

    // Spring: khối đuổi theo góc đích, trễ nhẹ, vọt qua rồi nảy về (đây là chỗ tạo cảm giác "mềm")
    spr.vy += (tgt.y - holder.rotation.y) * 0.10 - spr.vy * 0.60;   // 0.10 = độ cứng, 0.60 = ma sát (gần tới hạn: mượt, không nảy)
    spr.vx += (tgt.x - holder.rotation.x) * 0.10 - spr.vx * 0.60;
    holder.rotation.y += spr.vy;
    holder.rotation.x += spr.vx;

    // Nghiêng nhẹ theo chuột (parallax)
    holder.position.x += (pointer.x * 0.2 - holder.position.x) * 0.05;
    holder.position.y += (pointer.y * 0.12 - holder.position.y) * 0.05;

    // Viên thuốc kính lỏng: trôi theo dòng (không quay đều), bung ra, co giãn theo vận tốc, nghiêng nhẹ
    labels.rotation.y += 0.0012;                            // quay rất chậm, chủ yếu là trôi
    labels.getWorldQuaternion(tmpQ);                        // góc xoay thật của nhóm viên thuốc trong thế giới
    camInv.copy(camera.quaternion).invert();
    const tt = U.uTime.value;
    labels.children.forEach((m, i) => {
      const ud = m.userData, ph = ud.ph;
      // vị trí: hướng gốc x bán kính (bung theo từng viên) + trôi nhẹ như bị dòng nước cuốn
      const rad = 1 + state.burst * 2.2 * ud.k + 0.12 * Math.sin(tt * 0.6 + ph);
      pillPos.copy(ud.base).multiplyScalar(rad);
      pillPos.x += Math.sin(tt * 0.50 + ph) * 0.12;
      pillPos.y += Math.sin(tt * 0.43 + ph * 1.3) * 0.12;
      pillPos.z += Math.sin(tt * 0.37 + ph * 0.7) * 0.12;
      // vận tốc trong hệ màn hình (khung này - khung trước) để co giãn
      pillVel.subVectors(pillPos, ud.prev).applyQuaternion(tmpQ).applyQuaternion(camInv);
      ud.prev.copy(pillPos);
      m.position.copy(pillPos);
      // hình dạng: dãn theo hướng chạy, bẹp lại giữ thể tích, thở nhẹ
      const breath = 0.04 * Math.sin(tt * 1.3 + ph);
      const sx = 1 + Math.min(Math.abs(pillVel.x) * 8, 0.45) + breath;
      const sy = 1 + Math.min(Math.abs(pillVel.y) * 8, 0.35) - breath;
      const sz = 1 / Math.sqrt(sx * sy);
      m.scale.x += (sx - m.scale.x) * 0.15;
      m.scale.y += (sy - m.scale.y) * 0.15;
      m.scale.z += (sz - m.scale.z) * 0.15;
      // hướng: quay mặt về camera nhưng trễ và nghiêng nhẹ, mềm thay vì dính cứng
      tiltQ.setFromAxisAngle(zAxis, Math.sin(tt * 0.7 + ph) * 0.18);
      pillQ.copy(tmpQ).invert().multiply(camera.quaternion).multiply(tiltQ);
      m.quaternion.slerp(pillQ, 0.18);
      // gửi vị trí (không gian vật thể của khối) cho shader khối để bề mặt phình về phía viên thuốc
      U.uPills.value[i].copy(pillPos).applyQuaternion(labels.quaternion);
    });

    renderer.render(scene, camera);
  }
  tick();

  /* ----- Tạm dừng khi ra khỏi màn hình (khúc xạ khá nặng nên rất cần) ----- */
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; tick(); }
    if (!entry.isIntersecting) running = false;
  }).observe(container);

  return { setShape, setTint, setIor, setLiquid, pulse };
}