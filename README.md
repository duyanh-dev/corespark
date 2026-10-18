<div align="center">

# 🚀 coreSpark

**Từ lõi logic đến tia lửa. Website được thắp sáng bằng chuyển động.**

Landing page · Portfolio · Animation · 3D

[Tiếng Việt](#tiếng-việt) · [English](#english)

</div>

---

# Tiếng Việt

## Giới thiệu

**coreSpark** là studio thiết kế và lập trình website, chuyên làm **landing page** và **portfolio** có nhiều animation, hiệu ứng 3D và cảm giác chuyển động mượt như sản phẩm công nghệ cao cấp.

Đây cũng chính là website giới thiệu của studio: nơi bạn xem trực tiếp các demo chạy thật, lọc theo loại website, lĩnh vực, phong cách hay công nghệ, rồi mở ra thử trên cả máy tính lẫn điện thoại.

## Ý nghĩa cái tên

> **core** là lõi: phần logic cốt lõi quyết định một website chạy đúng, nhanh và bền.
> **Spark** là tia lửa: một chiếc tên lửa thắp sáng toàn bộ phần lõi đó, biến nó thành trải nghiệm khiến người xem muốn bấm vào.

Mỗi website đều có một bộ khung kỹ thuật chắc chắn bên dưới. coreSpark làm cho bộ khung đó bừng sáng.

## coreSpark làm gì

- **Landing page** giới thiệu sản phẩm, dịch vụ, chiến dịch, bố cục rõ ràng, cuộn mượt, chữ hiện từng dòng.
- **Portfolio** cho người làm sáng tạo, thương hiệu, freelancer, trình bày dự án dạng thẻ lớn, dễ đọc.
- **Website doanh nghiệp, blog, web app** nhỏ như trang đặt lịch, bảng điều khiển số liệu, cửa hàng.
- **Animation và 3D**: cuộn kích hoạt chuyển động, hiệu ứng kính, khối 3D tương tác bằng Three.js.
- **Lắng nghe và làm theo nhu cầu**: mỗi dự án đi từ câu hỏi "bạn muốn người xem cảm thấy gì?", rồi mới đến thiết kế và code.

Quy trình gồm 4 bước: **Ý tưởng, Thiết kế, Code, Ra mắt**. Sản phẩm bàn giao là website có link để gửi cho khách, đo được và sửa được.

## Điểm nổi bật của website này

- **Khu Showcase** có bộ lọc tự sinh từ dữ liệu (loại website, lĩnh vực, phong cách, công nghệ), tìm kiếm, sắp xếp, và khung xem demo toàn màn hình với chế độ **Máy tính / Điện thoại**.
- **Section câu chuyện** ghim màn hình: một khối kính lỏng biến hình theo từng chương khi cuộn.
- **Footer Liquid Glass** với thấu kính chạy theo con trỏ trên máy có chuột.
- Giao diện tối ưu cho điện thoại, tôn trọng chế độ giảm chuyển động của hệ điều hành.

## Công nghệ

| Mảng | Công nghệ |
| :-- | :-- |
| Framework | [Astro](https://astro.build) |
| Animation | [GSAP](https://gsap.com) + ScrollTrigger |
| 3D / WebGL | [Three.js](https://threejs.org) |
| Cuộn mượt | Lenis |
| Giao diện | phong cách Liquid Glass |

## Cấu trúc dự án

```text
corespark/
├─ public/
│  ├─ demos/              Mã nguồn các demo (HTML, CSS, JS), mỗi demo một thư mục
│  └─ thumbs/             Ảnh thumbnail của từng demo
├─ src/
│  ├─ components/         Các section: Hero, Spark, Showcase, Process, Studio, Footer...
│  ├─ data/demos.json     Danh sách demo (nguồn dữ liệu duy nhất cho Showcase)
│  ├─ layouts/Layout.astro
│  ├─ pages/index.astro
│  ├─ scripts/            hero3d.js, liquid.js, smooth-scroll.js, make-thumbs.mjs
│  │  └─ showcase/        filters.js, cards.js, viewer.js, scroll-lock.js
│  └─ styles/global.css
└─ astro.config.mjs
```

## Chạy trên máy

Yêu cầu: Node.js phiên bản mới (khuyến nghị bản LTS).

```sh
npm install        # cài thư viện
npm run dev        # chạy dev tại http://localhost:4321
npm run build      # build ra thư mục ./dist
npm run preview    # xem thử bản build
```

> Nếu `astro.config.mjs` có đặt `base` (ví dụ `/corespark`), mọi đường dẫn khi chạy dev sẽ nằm dưới tiền tố đó, ví dụ `http://localhost:4321/corespark/`.

## Thêm một demo mới

1. Copy thư mục demo (HTML, CSS, JS, ảnh) vào `public/demos/<ten-demo>/`.
   Trong demo nên dùng đường dẫn **tương đối** (`images/a.png`), tránh bắt đầu bằng `/` (`/images/a.png`), vì demo nằm trong thư mục con của site.
2. Thêm một mục vào `src/data/demos.json`:

```json
{
  "slug": "ten-demo",
  "title": "Tên Demo",
  "desc": "Mô tả ngắn một hai dòng.",
  "type": "Landing page",
  "topic": "Công nghệ",
  "styles": ["Glass", "Minimal"],
  "tech": ["GSAP", "Pure CSS"],
  "date": "2026-10-19",
  "featured": false,
  "mobile": true,
  "thumb": "/thumbs/ten-demo.jpg",
  "url": "https://link-demo-online-neu-co/",
  "localUrl": "/demos/ten-demo/index.html"
}
```

3. Thêm ảnh thumbnail vào `public/thumbs/` (tỉ lệ 16:10, chụp 1280×800).

Các chip lọc (loại, lĩnh vực, phong cách, công nghệ) **tự xuất hiện** khi có giá trị mới. Nếu file `localUrl` có thật trong `public/` thì demo chạy bằng mã nguồn đó, không thì dùng `url`.

## Liên hệ

Bạn cần một landing page bứt phá, hay một portfolio đậm chất riêng? Hãy nói với coreSpark bạn muốn người xem cảm thấy gì.

- Email: [buiduyanh.17042001@gmail.com](mailto:buiduyanh.17042001@gmail.com)
- GitHub: [github.com/duyanh-dev](https://github.com/duyanh-dev)
- Facebook: [facebook.com/duy.anh.207927](https://www.facebook.com/duy.anh.207927)
- Zalo: [zalo.me/0842695949](https://zalo.me/0842695949)

---

# English

## About

**coreSpark** is a web design and development studio specializing in **landing pages** and **portfolios** rich in animation, 3D effects, and the kind of smooth motion you expect from premium tech products.

This repository is the studio's own website: a place to browse live demos, filter them by website type, topic, style, or technology, and open each one on both desktop and mobile.

## The meaning behind the name

> **core** is the heart of a website: the core logic that makes it correct, fast, and durable.
> **Spark** is the ignition: a rocket that lights up that core and turns it into an experience people want to click.

Every website has solid engineering underneath. coreSpark makes it shine.

## What coreSpark builds

- **Landing pages** for products, services, and campaigns, with clear layouts, smooth scrolling, and line-by-line text reveals.
- **Portfolios** for creatives, brands, and freelancers, presenting projects as large, readable cards.
- **Business sites, blogs, and small web apps** such as trip planners, dashboards, and shops.
- **Animation and 3D**: scroll-driven motion, Liquid Glass effects, and interactive Three.js scenes.
- **Listening first**: every project starts with "what should visitors feel?", then moves to design and code.

The process has four steps: **Idea, Design, Code, Launch**. You get a live website with a shareable link that can be measured and edited.

## Highlights of this site

- **Showcase** with filters generated automatically from data (type, topic, style, technology), search, sorting, and a full-screen demo viewer with **Desktop / Mobile** modes.
- **Pinned story section**: a liquid glass form that morphs through each chapter as you scroll.
- **Liquid Glass footer** with a lens that follows the cursor on devices with a mouse.
- Mobile-friendly, and respects the operating system's reduced-motion setting.

## Tech stack

| Area | Technology |
| :-- | :-- |
| Framework | [Astro](https://astro.build) |
| Animation | [GSAP](https://gsap.com) + ScrollTrigger |
| 3D / WebGL | [Three.js](https://threejs.org) |
| Smooth scroll | Lenis |
| Styling | Liquid Glass look |

## Project structure

```text
corespark/
├─ public/
│  ├─ demos/              Demo source code (HTML, CSS, JS), one folder per demo
│  └─ thumbs/             Thumbnail image for each demo
├─ src/
│  ├─ components/         Sections: Hero, Spark, Showcase, Process, Studio, Footer...
│  ├─ data/demos.json     Demo list (single source of truth for the Showcase)
│  ├─ layouts/Layout.astro
│  ├─ pages/index.astro
│  ├─ scripts/            hero3d.js, liquid.js, smooth-scroll.js, make-thumbs.mjs
│  │  └─ showcase/        filters.js, cards.js, viewer.js, scroll-lock.js
│  └─ styles/global.css
└─ astro.config.mjs
```

## Getting started

Requirements: a recent version of Node.js (LTS recommended).

```sh
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:4321
npm run build      # build to ./dist
npm run preview    # preview the production build
```

> If `astro.config.mjs` sets a `base` (for example `/corespark`), all paths in dev live under that prefix, e.g. `http://localhost:4321/corespark/`.

## Adding a new demo

1. Copy the demo folder (HTML, CSS, JS, images) into `public/demos/<demo-name>/`.
   Use **relative** paths inside the demo (`images/a.png`) and avoid paths starting with `/` (`/images/a.png`), because demos live in a subfolder of the site.
2. Add an entry to `src/data/demos.json`:

```json
{
  "slug": "demo-name",
  "title": "Demo Title",
  "desc": "A short one or two line description.",
  "type": "Landing page",
  "topic": "Technology",
  "styles": ["Glass", "Minimal"],
  "tech": ["GSAP", "Pure CSS"],
  "date": "2026-10-19",
  "featured": false,
  "mobile": true,
  "thumb": "/thumbs/demo-name.jpg",
  "url": "https://online-demo-link-if-any/",
  "localUrl": "/demos/demo-name/index.html"
}
```

3. Add a thumbnail to `public/thumbs/` (16:10 ratio, captured at 1280×800).

Filter chips (type, topic, style, technology) **appear automatically** when a new value is added. If the `localUrl` file exists in `public/`, the demo runs from that source; otherwise it falls back to `url`.

## Contact

Need a breakout landing page, or a portfolio with a personality of its own? Tell coreSpark what you want your visitors to feel.

- Email: [buiduyanh.17042001@gmail.com](mailto:buiduyanh.17042001@gmail.com)
- GitHub: [github.com/duyanh-dev](https://github.com/duyanh-dev)
- Facebook: [facebook.com/duy.anh.207927](https://www.facebook.com/duy.anh.207927)
- Zalo: [zalo.me/0842695949](https://zalo.me/0842695949)

---

<div align="center">

**coreSpark** · Made with ☕ and 🚀 in Sài Gòn

</div>