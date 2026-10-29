(function () {
  var d = document, w = window;
  w.__calm = true;
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in w;
  var each = function (sel, fn) { Array.prototype.forEach.call(d.querySelectorAll(sel), fn); };

  /* the menu: full screen, Esc closes, focus stays inside, the page behind does not scroll */
  var menu = d.getElementById('menu'), openBtn = d.querySelector('.menu-btn'), closeBtn = menu && menu.querySelector('.menu__close');
  if (menu && openBtn && closeBtn) {
  function focusables() { return Array.prototype.filter.call(menu.querySelectorAll('a[href], button'), function (el) { return el.offsetParent !== null; }); }
  function openMenu() { menu.hidden = false; d.body.classList.add('is-locked'); openBtn.setAttribute('aria-expanded', 'true'); closeBtn.focus(); }
  function closeMenu(back) { menu.hidden = true; d.body.classList.remove('is-locked'); openBtn.setAttribute('aria-expanded', 'false'); if (back) openBtn.focus(); }
  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', function () { closeMenu(true); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(false); });
  d.addEventListener('keydown', function (e) {
    if (menu.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
    if (e.key === 'Tab') {
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  w.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches && !menu.hidden) closeMenu(false); });
  }

  /* sections settle in as they arrive */
  var RV = '.rv, .rvt, .rvp';
  if (reduce || !hasIO) { each(RV, function (el) { el.classList.add('in'); }); }
  else {
    var rv = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add('in'); rv.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    each(RV, function (el) { rv.observe(el); });
    /* an anchor jump or a fast scroll can skip past an element without it ever crossing into view:
       anything at or above the viewport is shown at once (classes only, once each; no per-tick motion) */
    var queued = false;
    function sweep() {
      queued = false;
      var left = 0;
      each(RV, function (el) {
        if (el.classList.contains('in')) return;
        left++;
        if (el.getBoundingClientRect().top < innerHeight) { el.classList.add('in'); rv.unobserve(el); left--; }
      });
      if (!left) { w.removeEventListener('scroll', onScroll); w.removeEventListener('hashchange', onScroll); }
    }
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(sweep); } }
    w.addEventListener('scroll', onScroll, { passive: true });
    w.addEventListener('hashchange', onScroll);
  }
  if (reduce || !hasIO) return;

  /* the slow drift only runs while a photograph is on screen */
  var kb = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('on', e.isIntersecting); });
  });
  each('.kbw', function (el) { kb.observe(el); });

  /* the cover film: four shots from Balian's own Facility Tour video (the carved gate over the indoor pool, the Hinoki Bath
     under the rooftop pavilion, the meditation room, the rooftop pool), crossfading in a 13.9 s seamless loop; 16:9 on wide screens, square on phones. It loads after the page has finished,
     starts muted and inline, fades in over the same still, pauses off screen, and is skipped for reduced motion
     (returned above), save-data and 2G. */
  var c = navigator.connection || {};
  if (c.saveData || /2g/.test(c.effectiveType || '')) return;
  var hero = d.getElementById('hero'), v = hero && hero.querySelector('video');
  if (!v || !v.canPlayType) return;
  function start() {
    setTimeout(function () {
      var k = w.matchMedia('(max-width: 767px)').matches ? 'phone' : 'wide';
      var webm = v.getAttribute('data-' + k + '-webm'), mp4 = v.getAttribute('data-' + k + '-mp4');
      v.src = v.canPlayType('video/mp4; codecs="avc1.640028"') ? mp4 : webm;   /* H.264 first: every phone plays it */
      v.muted = true; v.defaultMuted = true; v.loop = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.addEventListener('playing', function () { v.classList.add('is-on'); }, { once: true });
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      }).observe(hero);
    }, 600);
  }
  if (d.readyState === 'complete') start(); else w.addEventListener('load', start);
})();
