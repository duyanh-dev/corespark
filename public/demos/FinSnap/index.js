let currentLang = "vi";
function toggleLanguage() {
  currentLang = currentLang === "vi" ? "en" : "vi";
  document.getElementById("currentLang").innerText =
    currentLang === "vi" ? "VN" : "EN";
  document.querySelectorAll(".lang").forEach((el) => {
    const newText = el.getAttribute(`data-${currentLang}`);
    if (newText) el.innerHTML = newText;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const reveals = document.querySelectorAll(".reveal");
  const generalObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          generalObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  reveals.forEach((reveal) => generalObserver.observe(reveal));
  setTimeout(() => {
    document
      .querySelectorAll(".hero .reveal")
      .forEach((el) => el.classList.add("active"));
  }, 100);

  const stickySection = document.getElementById("stickySection");
  const bleedBg = document.getElementById("bleedBg");
  const desktopPhone = document.getElementById("desktopPhone");

  const bleedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          bleedBg.classList.add("active");
          if (desktopPhone) desktopPhone.classList.add("visible");
        } else {
          bleedBg.classList.remove("active");
          if (desktopPhone) desktopPhone.classList.remove("visible");
        }
      });
    },
    {
      rootMargin: "-15% 0px -15% 0px",
    },
  );
  bleedObserver.observe(stickySection);

  const isDesktop = window.matchMedia("(min-width: 991px)").matches;

  if (isDesktop) {
    const featureBlocks = document.querySelectorAll(".feature-block");
    const screenSliders = document.querySelectorAll(".screen-slider");

    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            featureBlocks.forEach((b) => b.classList.remove("active"));
            entry.target.classList.add("active");

            const activeIndex = entry.target.getAttribute("data-index");
            screenSliders.forEach((slider) =>
              slider.classList.remove("active"),
            );
            const activeSlider = document.querySelector(
              `.screen-slider[data-index="${activeIndex}"]`,
            );
            if (activeSlider) activeSlider.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    featureBlocks.forEach((block) => scrollObserver.observe(block));
  } else {
    const mobileFeatureBlocks = document.querySelectorAll(".feature-block");
    const mobileCardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("active");
          else entry.target.classList.remove("active");
        });
      },
      { rootMargin: "-25% 0px -25% 0px" },
    );
    mobileFeatureBlocks.forEach((block) => mobileCardObserver.observe(block));
  }

  const wrappers = document.querySelectorAll(".phone-wrapper");
  wrappers.forEach((wrapper) => {
    const frame = wrapper.querySelector(".phone-frame");
    const track = wrapper.querySelector(".carousel-track");
    const dotsContainer = wrapper.querySelector(".carousel-dots");
    const slides = track.querySelectorAll("img");
    const totalSlides = slides.length;
    if (totalSlides <= 1) return;

    slides.forEach((img) => {
      img.ondragstart = () => false;
    });
    dotsContainer.innerHTML = "";
    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement("span");
      dot.classList.add("dot");
      if (i === 0) dot.classList.add("active");
      dotsContainer.appendChild(dot);
    }

    const dots = dotsContainer.querySelectorAll(".dot");
    let currentIndex = 0,
      isDragging = false,
      startPos = 0;
    let currentTranslate = 0,
      prevTranslate = 0;

    function updateSlider() {
      prevTranslate = currentIndex * -100;
      currentTranslate = prevTranslate;
      track.style.transform = `translateX(${currentTranslate}%)`;
      dots.forEach((d) => d.classList.remove("active"));
      dots[currentIndex].classList.add("active");
    }

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        currentIndex = index;
        track.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
        updateSlider();
      });
    });

    function getPositionX(event) {
      return event.type.includes("mouse")
        ? event.pageX
        : event.touches[0].clientX;
    }

    function touchStart(event) {
      if (event.type === "mousedown") event.preventDefault();
      isDragging = true;
      startPos = getPositionX(event);
      currentTranslate = prevTranslate;
      track.style.transition = "none";
    }

    function touchMove(event) {
      if (!isDragging) return;
      const diff = getPositionX(event) - startPos;
      if (event.type.includes("touch") && Math.abs(diff) > 10)
        event.preventDefault();
      else if (event.type.includes("mouse")) event.preventDefault();

      const percentDiff = (diff / frame.offsetWidth) * 100;
      currentTranslate = prevTranslate + percentDiff;

      const maxTranslate = -(totalSlides - 1) * 100;
      if (currentTranslate > 5) currentTranslate = 5;
      if (currentTranslate < maxTranslate - 5)
        currentTranslate = maxTranslate - 5;
      track.style.transform = `translateX(${currentTranslate}%)`;
    }

    function touchEnd() {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";

      const movedBy = currentTranslate - prevTranslate;
      if (movedBy < -10 && currentIndex < totalSlides - 1) currentIndex += 1;
      else if (movedBy > 10 && currentIndex > 0) currentIndex -= 1;
      updateSlider();
    }

    frame.addEventListener("touchstart", touchStart, { passive: false });
    frame.addEventListener("mousedown", touchStart);
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("mousemove", touchMove);
    window.addEventListener("touchend", touchEnd);
    window.addEventListener("mouseup", touchEnd);
  });
});

document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("senderName").value;
  const message = document.getElementById("senderMessage").value;

  const subject = encodeURIComponent(
    `[FinSnap Landing Page] Tin nhắn từ ${name}`,
  );
  const body = encodeURIComponent(
    `Chào Duy Anh,\n\nTên tôi là: ${name}\n\nNội dung tin nhắn:\n${message}`,
  );

  window.location.href = `mailto:buiduyanh.17042001@gmail.com?subject=${subject}&body=${body}`;

  this.reset();
});
