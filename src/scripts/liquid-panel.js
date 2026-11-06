/* =========================================================
   LIQUID-PANEL.JS - Bảng chỉnh "kính lỏng" nổi khối ở cạnh phải màn hình
   Chính bảng này cũng là một tấm liquid glass: nền mờ + viền vát sáng + bóng nổi, nghiêng nhẹ theo chuột.

   Thanh trượt
     Giọt con trỏ:      Độ lớn · Khúc xạ · Độ mềm
     Khối kính Spark:   Độ lớn · Khúc xạ
   Giá trị lưu trong localStorage (liquid-params.js). Nút "Đặt lại" trả về mặc định, nút "−" thu gọn.
   Chỉ hiện trên máy có chuột và màn hình >= 900px.

   Dùng:   import { initLiquidPanel } from '../scripts/liquid-panel.js';  initLiquidPanel();
   ========================================================= */
import { getParams, setParams, resetParams, onParams } from './liquid-params.js';

const CFG = [
  {
    group: 'cursor', title: 'Giọt con trỏ',
    items: [
      { key: 'size',    label: 'Độ lớn',  min: 0.6, max: 2.4, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
      { key: 'refract', label: 'Khúc xạ', min: 0,   max: 3,   step: 0.05, fmt: (v) => v.toFixed(2) },
      { key: 'soft',    label: 'Độ mềm',  min: 0.5, max: 2,   step: 0.05, fmt: (v) => v.toFixed(2) },
    ],
  },
  {
    group: 'glass', title: 'Khối kính (Spark)',
    items: [
      { key: 'size',    label: 'Độ lớn',  min: 0.6, max: 1.3, step: 0.02, fmt: (v) => Math.round(v * 100) + '%' },
      { key: 'refract', label: 'Khúc xạ', min: 0,   max: 3,   step: 0.05, fmt: (v) => v.toFixed(2) },
    ],
  },
];

const CSS = `
  .lgp {
    position: fixed; right: 18px; top: 50%; z-index: 2147483000; width: 236px;
    padding: 14px 14px 12px; border-radius: 28px; color: #f5f5f7;
    font: 500 13px/1.3 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
    transform: translateY(-50%) perspective(800px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
    transition: transform .25s cubic-bezier(.2, .8, .2, 1), width .35s cubic-bezier(.2, .9, .3, 1.2);
    background:
      linear-gradient(150deg, rgba(255,255,255,.26) 0%, rgba(255,255,255,.05) 38%, rgba(255,255,255,.02) 62%, rgba(255,255,255,.12) 100%),
      rgba(26, 30, 44, .42);
    -webkit-backdrop-filter: blur(24px) saturate(1.9) brightness(1.05);
            backdrop-filter: blur(24px) saturate(1.9) brightness(1.05);
    box-shadow:
      inset 0 1.5px 0 rgba(255,255,255,.65),
      inset 0 -1.5px 0 rgba(255,255,255,.10),
      inset 1.5px 0 0 rgba(255,255,255,.22),
      inset -1.5px 0 0 rgba(255,255,255,.10),
      inset 0 0 22px rgba(255,255,255,.07),
      0 26px 50px -12px rgba(0,0,0,.45),
      0 4px 10px rgba(0,0,0,.20);
    user-select: none; -webkit-user-select: none;
  }
  /* Vệt sáng cong trên mặt kính cho cảm giác nổi khối */
  .lgp::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(120% 60% at 20% -8%, rgba(255,255,255,.34), rgba(255,255,255,0) 60%);
    mix-blend-mode: screen;
  }
  .lgp__head { position: relative; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .lgp__drop {
    width: 14px; height: 18px; flex: none; border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
    background: radial-gradient(circle at 32% 28%, #fff 0 12%, rgba(255,255,255,.35) 30%, rgba(110,175,255,.55) 70%);
    box-shadow: inset -2px -3px 5px rgba(20,60,160,.45), 0 2px 6px rgba(0,0,0,.25);
  }
  .lgp__title { flex: 1; font-weight: 700; letter-spacing: .01em; }
  .lgp__min {
    width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: inherit;
    background: rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.4);
    transition: background .2s, transform .2s;
  }
  .lgp__min:hover { background: rgba(255,255,255,.26); }
  .lgp__min:active { transform: scale(.9); }
  .lgp__min svg { width: 12px; height: 12px; display: block; }
  .lgp__body { position: relative; display: grid; gap: 10px; transition: opacity .25s; }
  .lgp__group { display: grid; gap: 9px; padding: 11px 12px 12px; border-radius: 18px;
    background: rgba(255,255,255,.07); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px rgba(255,255,255,.05); }
  .lgp__gt { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(245,245,247,.62); }
  .lgp__row { display: grid; gap: 5px; }
  .lgp__lab { display: flex; justify-content: space-between; align-items: baseline; }
  .lgp__val { font-variant-numeric: tabular-nums; color: rgba(245,245,247,.72); font-size: 12px; }
  .lgp__reset {
    justify-self: end; padding: 6px 14px; border-radius: 999px; font: inherit; font-weight: 600; color: inherit;
    background: rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.4);
    transition: background .2s, transform .2s;
  }
  .lgp__reset:hover { background: rgba(255,255,255,.26); }
  .lgp__reset:active { transform: scale(.95); }

  /* Thanh trượt kiểu kính */
  .lgp input[type=range] {
    -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0; background: transparent; outline: none;
  }
  .lgp input[type=range]::-webkit-slider-runnable-track {
    height: 5px; border-radius: 999px;
    background: linear-gradient(90deg, rgba(140,195,255,.95) var(--p, 50%), rgba(255,255,255,.22) var(--p, 50%));
    box-shadow: inset 0 1px 2px rgba(0,0,0,.25);
  }
  .lgp input[type=range]::-moz-range-track {
    height: 5px; border-radius: 999px;
    background: linear-gradient(90deg, rgba(140,195,255,.95) var(--p, 50%), rgba(255,255,255,.22) var(--p, 50%));
  }
  .lgp input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 22px; height: 22px; margin-top: -8.5px; border-radius: 50%; border: 0;
    background: radial-gradient(circle at 32% 26%, #fff 0 18%, rgba(255,255,255,.75) 42%, rgba(205,225,255,.9) 100%);
    box-shadow: inset 0 -2px 4px rgba(60,100,190,.35), 0 3px 8px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.5);
    transition: transform .2s cubic-bezier(.2,.9,.3,1.4);
  }
  .lgp input[type=range]::-moz-range-thumb {
    width: 22px; height: 22px; border-radius: 50%; border: 0;
    background: radial-gradient(circle at 32% 26%, #fff 0 18%, rgba(255,255,255,.75) 42%, rgba(205,225,255,.9) 100%);
    box-shadow: inset 0 -2px 4px rgba(60,100,190,.35), 0 3px 8px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.5);
  }
  .lgp input[type=range]:active::-webkit-slider-thumb { transform: scale(1.18); }
  .lgp input[type=range]:focus-visible::-webkit-slider-thumb { outline: 2px solid rgba(140,195,255,.9); outline-offset: 2px; }

  /* Thu gọn: chỉ còn thanh tiêu đề */
  .lgp.is-min { width: 150px; }
  .lgp.is-min .lgp__body { display: none; }
  .lgp.is-min .lgp__head { margin-bottom: 0; }
  .lgp.is-min .lgp__title { white-space: nowrap; }

  @media (max-width: 899px), (hover: none) { .lgp { display: none; } }
  @media (prefers-reduced-motion: reduce) { .lgp { transition: none; } }
`;

const ICON_MIN = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 6h7"/></svg>';
const ICON_MAX = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 6h7M6 2.5v7"/></svg>';

export function initLiquidPanel() {
  if (typeof window === 'undefined' || window.__liquidPanel) return null;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement('aside');
  panel.className = 'lgp';
  panel.setAttribute('aria-label', 'Chỉnh kính lỏng');
  panel.innerHTML = `
    <div class="lgp__head">
      <span class="lgp__drop" aria-hidden="true"></span>
      <strong class="lgp__title">Liquid glass</strong>
      <button class="lgp__min" type="button" aria-label="Thu gọn bảng chỉnh">${ICON_MIN}</button>
    </div>
    <div class="lgp__body">
      ${CFG.map((g) => `
        <section class="lgp__group" data-group="${g.group}">
          <p class="lgp__gt">${g.title}</p>
          ${g.items.map((it) => `
            <label class="lgp__row">
              <span class="lgp__lab"><span>${it.label}</span><output class="lgp__val" data-out="${g.group}.${it.key}"></output></span>
              <input type="range" min="${it.min}" max="${it.max}" step="${it.step}" data-g="${g.group}" data-k="${it.key}" />
            </label>`).join('')}
        </section>`).join('')}
      <button class="lgp__reset" type="button">Đặt lại</button>
    </div>
  `;
  document.body.appendChild(panel);

  const inputs = [...panel.querySelectorAll('input[type=range]')];
  const fmtOf = {};
  CFG.forEach((g) => g.items.forEach((it) => { fmtOf[g.group + '.' + it.key] = it; }));

  function paint(el, value) {
    const it = fmtOf[el.dataset.g + '.' + el.dataset.k];
    el.value = String(value);
    el.style.setProperty('--p', ((value - it.min) / (it.max - it.min)) * 100 + '%');
    const out = panel.querySelector(`[data-out="${el.dataset.g}.${el.dataset.k}"]`);
    if (out) out.textContent = it.fmt(value);
  }
  function sync(state) { inputs.forEach((el) => paint(el, state[el.dataset.g][el.dataset.k])); }
  sync(getParams());

  inputs.forEach((el) => {
    el.addEventListener('input', () => {
      const val = parseFloat(el.value);
      paint(el, val);
      setParams({ [el.dataset.g]: { [el.dataset.k]: val } });
    });
  });
  panel.querySelector('.lgp__reset').addEventListener('click', () => resetParams());
  const offParams = onParams(sync);   // đồng bộ lại khi "Đặt lại"

  // Thu gọn / mở rộng
  const minBtn = panel.querySelector('.lgp__min');
  minBtn.addEventListener('click', () => {
    const min = panel.classList.toggle('is-min');
    minBtn.innerHTML = min ? ICON_MAX : ICON_MIN;
    minBtn.setAttribute('aria-label', min ? 'Mở rộng bảng chỉnh' : 'Thu gọn bảng chỉnh');
  });

  // Nghiêng nhẹ theo chuột cho cảm giác nổi khối
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    panel.addEventListener('pointermove', (e) => {
      const r = panel.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      panel.style.setProperty('--ry', (nx * 7).toFixed(2) + 'deg');
      panel.style.setProperty('--rx', (-ny * 7).toFixed(2) + 'deg');
    });
    panel.addEventListener('pointerleave', () => {
      panel.style.setProperty('--ry', '0deg');
      panel.style.setProperty('--rx', '0deg');
    });
  }

  const api = {
    destroy() { offParams(); panel.remove(); style.remove(); delete window.__liquidPanel; },
  };
  window.__liquidPanel = api;
  return api;
}