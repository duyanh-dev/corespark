/* =========================================================
   FILTERS.JS - Toàn bộ logic bộ lọc, tìm kiếm, sắp xếp
   Quy tắc lọc:
     - Loại website, Lĩnh vực, Phong cách: chọn nhiều = HOẶC
     - Công nghệ: chọn nhiều = phải có ĐỦ TẤT CẢ
     - Giữa các nhóm (và công tắc, ô tìm kiếm) = VÀ
   Hiệu ứng: GSAP Flip (thẻ trượt về vị trí mới)
   Trả về: { getVisible(), reset() }
   ========================================================= */
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lockScroll, unlockScroll } from './scroll-lock.js';

gsap.registerPlugin(Flip, ScrollTrigger);

/* ---------- BẢNG 1: CÁC NHÓM CHIP LỌC ----------
   key  = trùng data-group trên chip (Showcase.astro)
   get  = cách lấy các giá trị của 1 demo cho nhóm đó
   mode = 'or' (chọn nhiều thì HOẶC) | 'and' (phải có đủ tất cả)
   Muốn thêm nhóm mới: thêm 1 dòng ở đây + 1 nhóm trong Showcase.astro */
const GROUPS = {
  type:  { get: (d) => [d.type],  mode: 'or'  },
  topic: { get: (d) => [d.topic], mode: 'or'  },
  style: { get: (d) => d.styles,  mode: 'or'  },
  tech:  { get: (d) => d.tech,    mode: 'and' },
};
const KEYS = Object.keys(GROUPS);

/* ---------- BẢNG 2: CÁC KIỂU SẮP XẾP ---------- */
const SORTS = {
  newest:   (a, b) => b.date.localeCompare(a.date),
  featured: (a, b) => (Number(!!b.featured) - Number(!!a.featured)) || b.date.localeCompare(a.date),
  az:       (a, b) => a.title.localeCompare(b.title, 'vi'),
  oldest:   (a, b) => a.date.localeCompare(b.date),
};

/* ---------- HÀM 1: bỏ dấu tiếng Việt + chữ thường (để tìm "du lich" ra "Du lịch") ---------- */
const norm = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function initFilters({ demos, root }) {
  /* ----- Lấy các phần tử trên trang ----- */
  const $ = (s) => root.querySelector(s);
  const grid = $('#sc-grid'), input = $('#sc-q'), qClear = $('#sc-qclear'), sortSel = $('#sc-sort');
  const sheet = $('#sc-filters'), backdrop = $('#sc-backdrop'), openBtn = $('#sc-fbtn'), badge = $('#sc-fbadge');
  const doneBtn = $('#sc-fdone'), clearBtn = $('#sc-clear'), applyN = $('#sc-apply-n'), applyBtn = $('#sc-apply');
  const activeBar = $('#sc-active'), empty = $('#sc-empty'), emptyReset = $('#sc-empty-reset');
  const chips = [...root.querySelectorAll('.sc-fchip')];
  const switches = [...root.querySelectorAll('.sc-switch input')];
  const cards = new Map([...grid.querySelectorAll('.sc-card')].map((c) => [c.dataset.slug, c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Chuẩn bị dữ liệu: chuỗi tìm kiếm không dấu + cờ "có 3D" ----- */
  demos.forEach((d) => {
    d._s = norm([d.title, d.desc, d.type, d.topic, ...d.styles, ...d.tech].join(' '));
    d._3d = d.tech.some((t) => /three|webgl/i.test(t));
  });

  /* ----- Trạng thái bộ lọc ----- */
  const st = { q: '', sort: 'newest', featured: false, has3d: false, mobile: false };
  KEYS.forEach((k) => (st[k] = new Set()));
  let tokens = [];            // từ khoá tìm kiếm đã bỏ dấu
  let visible = demos.slice();

  /* ---------- HÀM 2: demo d có khớp bộ lọc không? ----------
     skip = tên nhóm bỏ qua (dùng để đếm số cho chip của nhóm đó) */
  function matches(d, skip) {
    if (tokens.length && !tokens.every((t) => d._s.includes(t))) return false;
    for (const k of KEYS) {
      if (k === skip || !st[k].size) continue;
      const vals = GROUPS[k].get(d);
      if (GROUPS[k].mode === 'and') { for (const v of st[k]) if (!vals.includes(v)) return false; }
      else if (!vals.some((v) => st[k].has(v))) return false;
    }
    if (st.featured && !d.featured) return false;
    if (st.has3d && !d._3d) return false;
    if (st.mobile && !d.mobile) return false;
    return true;
  }

  /* ---------- HÀM 3: số demo còn lại nếu bấm thêm chip (group, value) ---------- */
  function countFor(group, value) {
    const g = GROUPS[group];
    return demos.filter((d) => {
      if (!matches(d, group)) return false;
      const vals = g.get(d);
      if (g.mode === 'and') return [...st[group], value].every((v) => vals.includes(v));   // phải có đủ
      return vals.includes(value);
    }).length;
  }

  /* ---------- HÀM 4: áp bộ lọc + sắp xếp, rồi cho thẻ trượt về vị trí mới (Flip) ---------- */
  function apply({ animate = true } = {}) {
    visible = demos.filter((d) => matches(d)).sort(SORTS[st.sort]);
    const show = new Set(visible.map((d) => d.slug));

    // 1) Chụp vị trí hiện tại của mọi thẻ, và giữ chiều cao lưới để trang không giật
    const state = animate ? Flip.getState([...cards.values()]) : null;
    if (animate) grid.style.minHeight = grid.offsetHeight + 'px';

    // 2) Đổi DOM: thẻ khớp xếp theo thứ tự mới, thẻ không khớp ẩn đi
    visible.forEach((d) => {
      const el = cards.get(d.slug);
      el.classList.remove('is-hidden');
      grid.appendChild(el);
    });
    cards.forEach((el, slug) => { if (!show.has(slug)) el.classList.add('is-hidden'); });

    // 3) Cho thẻ trượt từ vị trí cũ sang vị trí mới
    if (state) {
      Flip.from(state, {
        duration: reduce ? 0 : 0.65, ease: 'power3.inOut', absolute: true, stagger: 0.025,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.15, ease: 'power2.out' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in' }),
        onComplete: () => { grid.style.minHeight = ''; ScrollTrigger.refresh(); },   // chiều cao đổi: tính lại vị trí các section dưới
      });
    }
    updateUI();
  }

  /* ---------- HÀM 5: cập nhật mọi thứ hiển thị (chip, số đếm, thanh đang bật, trạng thái rỗng) ---------- */
  function updateUI() {
    // Chip: trạng thái bật + số đếm; chip ra 0 kết quả thì mờ đi
    chips.forEach((ch) => {
      const g = ch.dataset.group, v = ch.dataset.value;
      const on = st[g].has(v);
      const n = countFor(g, v);
      ch.classList.toggle('is-on', on);
      ch.setAttribute('aria-pressed', String(on));
      ch.querySelector('.sc-fn').textContent = n;
      ch.disabled = n === 0 && !on;
    });

    // Số bộ lọc đang bật (hiện trên nút "Bộ lọc" ở điện thoại)
    const n = KEYS.reduce((a, k) => a + st[k].size, 0) + (st.q ? 1 : 0) + ['featured', 'has3d', 'mobile'].filter((k) => st[k]).length;
    badge.textContent = n;
    badge.hidden = n === 0;
    clearBtn.disabled = n === 0;

    applyN.textContent = visible.length;
    empty.hidden = visible.length > 0;
    renderActive();
  }

  /* ---------- HÀM 6: vẽ thanh "đang bật": số kết quả + từng thẻ điều kiện (bấm để gỡ) ---------- */
  function renderActive() {
    activeBar.textContent = '';
    const count = document.createElement('span');
    count.className = 'sc-count';
    count.textContent = `${visible.length} demo`;
    activeBar.append(count);

    const addTag = (label, onRemove) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sc-tag'; b.textContent = label;
      b.setAttribute('aria-label', `Gỡ bộ lọc ${label}`);
      b.addEventListener('click', onRemove);
      activeBar.append(b);
    };
    if (st.q) addTag(`“${st.q}”`, () => { input.value = ''; setQ(''); });
    KEYS.forEach((g) => st[g].forEach((v) => addTag(v, () => toggle(g, v))));
    [['featured', 'Nổi bật'], ['has3d', 'Có 3D / WebGL'], ['mobile', 'Tối ưu mobile']].forEach(([k, t]) => {
      if (st[k]) addTag(t, () => setSwitch(k, false));
    });
  }

  /* ---------- HÀM 7: các thao tác đổi bộ lọc ---------- */
  function toggle(group, value) {
    st[group].has(value) ? st[group].delete(value) : st[group].add(value);
    apply();
  }
  function setSwitch(key, val) {
    st[key] = val;
    switches.forEach((s) => { if (s.dataset.key === key) s.checked = val; });
    apply();
  }
  function setQ(v) {
    st.q = v.trim();
    tokens = norm(st.q).split(/\s+/).filter(Boolean);
    qClear.hidden = !input.value;
    apply();
  }
  function reset() {
    KEYS.forEach((k) => st[k].clear());
    st.featured = st.has3d = st.mobile = false;
    switches.forEach((s) => (s.checked = false));
    input.value = '';
    setQ('');
  }

  /* ---------- HÀM 8: ngăn kéo bộ lọc trên điện thoại ---------- */
  let sheetOpen = false;
  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true;
    sheet.classList.add('is-open'); backdrop.classList.add('is-open');
    lockScroll();
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove('is-open'); backdrop.classList.remove('is-open');
    unlockScroll();
  }

  /* ----- Gắn sự kiện ----- */
  chips.forEach((ch) => ch.addEventListener('click', () => toggle(ch.dataset.group, ch.dataset.value)));
  switches.forEach((s) => s.addEventListener('change', () => setSwitch(s.dataset.key, s.checked)));
  sortSel.addEventListener('change', () => { st.sort = sortSel.value; apply(); });

  let timer;                                  // gõ xong 140ms mới lọc (đỡ giật khi gõ nhanh)
  input.addEventListener('input', () => {
    qClear.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(() => setQ(input.value), 140);
  });
  qClear.addEventListener('click', () => { input.value = ''; setQ(''); input.focus(); });

  clearBtn.addEventListener('click', reset);
  emptyReset.addEventListener('click', reset);
  openBtn.addEventListener('click', openSheet);
  doneBtn.addEventListener('click', closeSheet);
  applyBtn.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) closeSheet(); });  // phóng to màn hình thì tự đóng ngăn kéo

  apply({ animate: false });                  // vẽ trạng thái ban đầu (số đếm, thanh đang bật)

  return { getVisible: () => visible, reset };
}