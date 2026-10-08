// Subtle reveal-on-scroll. Content is visible without JS, and under prefers-reduced-motion.
(function () {
  var items = document.querySelectorAll("[data-reveal]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });

  // Concept page: every link and button is visual only.
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });
})();
