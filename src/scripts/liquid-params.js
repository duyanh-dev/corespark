/* =========================================================
   LIQUID-PARAMS.JS - Thông số chung của "kính lỏng" (giọt con trỏ + khối kính Spark)
   Không còn bảng chỉnh và không lưu gì vào trình duyệt: muốn đổi mặc định thì sửa DEFAULTS ngay dưới đây.

     cursor.size     độ lớn giọt con trỏ (nhân với kích thước chuẩn)
     cursor.refract  độ khúc xạ giọt con trỏ (1 = nước, càng cao càng bẻ tia mạnh)
     cursor.soft     độ mềm: cao hơn = đuôi chậm, lượn nhiều, kéo giãn nhiều
     glass.size      độ lớn khối kính ở section Spark
     glass.refract   độ khúc xạ khối kính ở section Spark
   ========================================================= */
export const DEFAULTS = {
  cursor: { size: 1, refract: 1.4, soft: 1 },
  glass:  { size: 1, refract: 1.5 },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// Xoá giá trị cũ mà bảng chỉnh từng lưu (nếu có), để không bị kẹt thông số lạ
try { localStorage.removeItem('liquid-params-v1'); } catch (e) { /* bỏ qua */ }

const store = typeof window !== 'undefined'
  ? (window.__liquidParams = window.__liquidParams || { state: clone(DEFAULTS), subs: new Set() })
  : { state: clone(DEFAULTS), subs: new Set() };

export const getParams = () => store.state;

export function setParams(patch) {
  for (const g in patch) Object.assign(store.state[g], patch[g]);
  store.subs.forEach((cb) => cb(store.state));
}

export function resetParams() {
  for (const g in DEFAULTS) Object.assign(store.state[g], DEFAULTS[g]);
  store.subs.forEach((cb) => cb(store.state));
}

export function onParams(cb) {
  store.subs.add(cb);
  return () => store.subs.delete(cb);
}