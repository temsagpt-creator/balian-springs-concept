/* The website's link to Balian's own admin (Inquiries, Newsletter, Website details).
   - Every form posts to the admin's public API and lands in the Inquiries inbox; the newsletter form asks Mailchimp
     for a double opt-in. Nothing says "sent" until the server has answered.
   - What a visitor types is kept in this browser until it is sent, survives a reload, and leaving with unsent words
     asks first. A failed send says so and keeps the words for another try.
   - The closures notice, upcoming events and the gift card link come from the admin; without it, the page simply
     shows what it already has. */
(function () {
  var d = document, w = window;
  var meta = d.querySelector('meta[name="bs-api"]');
  var API = meta ? meta.getAttribute('content').replace(/\/+$/, '') : '';
  if (!API || !w.fetch) return;
  var PHONE = '(703) 436-9107';
  var store = (function () { try { var k = '__bs'; w.localStorage.setItem(k, k); w.localStorage.removeItem(k); return w.localStorage; } catch (e) { return null; } })();
  var dirty = 0;
  w.addEventListener('beforeunload', function (e) { if (dirty > 0) { e.preventDefault(); e.returnValue = ''; } });

  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
  }
  function timeNow() {
    try { return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase(); } catch (e) { return ''; }
  }
  function say(el, text, kind) { if (!el) return; el.textContent = text; el.classList.toggle('is-ok', kind === 'ok'); el.classList.toggle('is-err', kind === 'err'); }

  /* ---- inquiry forms: <form data-inquiry="contact|event|membership|partnership"> ---- */
  Array.prototype.forEach.call(d.querySelectorAll('form[data-inquiry]'), function (form) {
    var kind = form.getAttribute('data-inquiry');
    var key = 'bs-form:' + kind + ':' + location.pathname;
    var state = form.querySelector('.form__state');
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : 'Send';
    var opened = Date.now();
    var isDirty = false;
    function setDirty(v) { if (v !== isDirty) { isDirty = v; dirty += v ? 1 : -1; } }
    function fieldsOf() {
      var o = {};
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.name !== 'hp' && el.type !== 'submit') o[el.name] = el.value; });
      return o;
    }
    function hasWords(o) { for (var k in o) { if (o[k] && String(o[k]).trim()) return true; } return false; }
    /* bring back what was typed before a reload */
    if (store) {
      try {
        var saved = JSON.parse(store.getItem(key) || 'null');
        if (saved && saved.v) {
          Array.prototype.forEach.call(form.elements, function (el) { if (el.name && saved.v[el.name] != null && el.type !== 'submit') el.value = saved.v[el.name]; });
          if (hasWords(saved.v)) { setDirty(true); say(state, 'Your unsent message is still here. Not sent yet.'); }
        }
      } catch (e) {}
    }
    form.addEventListener('input', function () {
      var v = fieldsOf();
      if (store) { try { store.setItem(key, JSON.stringify({ v: v, at: Date.now() })); } catch (e) {} }
      setDirty(hasWords(v));
      if (state && state.classList.contains('is-ok')) say(state, '');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); say(state, 'Please fill in the fields marked as needed.', 'err'); return; }
      var v = fieldsOf();
      var body = { kind: kind, name: v.name || '', email: v.email || '', phone: v.phone || '', message: v.message || '', fields: {}, page: location.pathname, hp: (form.elements.hp && form.elements.hp.value) || '', t: Date.now() - opened };
      ['organization', 'preferredDate', 'guests', 'space', 'website', 'business', 'interest'].forEach(function (k) { if (v[k]) body.fields[k] = v[k]; });
      if (btn) { btn.disabled = true; btn.textContent = 'Sending'; }
      say(state, 'Sending your message.');
      post('/api/public/inquiry', body).then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          if (store) { try { store.removeItem(key); } catch (e) {} }
          setDirty(false);
          form.reset(); opened = Date.now();
          say(state, 'Sent at ' + timeNow() + '. Thank you, our team will reply by email.', 'ok');
        } else if (r.status === 429) {
          say(state, 'Not sent: too many messages from this connection. Please wait a few minutes, or call us at ' + PHONE + '. Your words are kept here.', 'err');
        } else {
          say(state, 'Not sent: ' + ((r.body && r.body.error) || 'please check the fields and try again') + '. Your words are kept here.', 'err');
        }
      }).catch(function () {
        say(state, 'Not sent: we could not reach our inbox. Please try again, or call us at ' + PHONE + '. Your words are kept here.', 'err');
      }).then(function () { if (btn) { btn.disabled = false; btn.textContent = label; } });
    });
  });

  /* ---- the newsletter form in the footer ---- */
  Array.prototype.forEach.call(d.querySelectorAll('form[data-subscribe]'), function (form) {
    var input = form.querySelector('input[type="email"]');
    var state = form.querySelector('.club__state');
    var btn = form.querySelector('button[type="submit"]');
    var opened = Date.now();
    var isDirty = false;
    function setDirty(v) { if (v !== isDirty) { isDirty = v; dirty += v ? 1 : -1; } }
    if (input) input.addEventListener('input', function () { setDirty(!!input.value.trim()); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input || !input.value.trim() || !input.checkValidity()) { if (input) input.reportValidity(); say(state, 'Please enter your email address.', 'err'); return; }
      if (btn) btn.disabled = true;
      say(state, 'Joining.');
      post('/api/public/subscribe', { email: input.value.trim(), page: location.pathname, hp: (form.elements.hp && form.elements.hp.value) || '', t: Date.now() - opened })
        .then(function (r) {
          if (r.status === 200 && r.body && r.body.ok) { setDirty(false); input.value = ''; say(state, 'Almost there: please confirm from the email we just sent you.', 'ok'); }
          else if (r.status === 429) say(state, 'Not joined: please wait a few minutes and try again.', 'err');
          else say(state, 'Not joined: ' + ((r.body && r.body.error) || 'please check the address') + '.', 'err');
        })
        .catch(function () { say(state, 'Not joined: we could not reach our mailing list. Please try again.', 'err'); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });

  /* ---- website details managed in the admin ---- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u || '')) || /^\//.test(String(u || '')) ? String(u) : ''; }
  function longDate(iso) {
    var p = String(iso || '').split('-'); if (p.length !== 3) return '';
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    try { return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch (e) { return iso; }
  }
  function clock(t) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); if (!m) return '';
    var h = +m[1], ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap;
  }
  fetch(API + '/api/public/site', { mode: 'cors', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
    if (!s) return;
    if (s.banner && s.banner.message) {
      var bar = d.createElement('div');
      bar.className = 'notice'; bar.setAttribute('role', 'status');
      var link = safeUrl(s.banner.linkUrl);
      bar.innerHTML = '<span>' + esc(s.banner.message) + '</span>' + (link && s.banner.linkText ? '<a href="' + esc(link) + '">' + esc(s.banner.linkText) + '</a>' : '');
      d.body.insertBefore(bar, d.body.firstChild);
      var setH = function () { d.body.style.setProperty('--notice-h', bar.offsetHeight + 'px'); };
      setH(); w.addEventListener('resize', setH);
      d.body.classList.add('has-notice');
    }
    var box = d.querySelector('[data-events]');
    if (box && s.events && s.events.length) {
      var list = box.querySelector('.evts');
      list.innerHTML = s.events.slice(0, 8).map(function (ev) {
        var when = longDate(ev.date) + (ev.startTime ? ', ' + clock(ev.startTime) + (ev.endTime ? ' to ' + clock(ev.endTime) : '') : '');
        var link = safeUrl(ev.linkUrl);
        return '<li><time datetime="' + esc(ev.date) + '">' + esc(when) + '</time><h3>' + esc(ev.title) + '</h3>' +
          (ev.summary ? '<p>' + esc(ev.summary) + '</p>' : '') +
          (link ? '<a class="more" href="' + esc(link) + '">' + esc(ev.linkText || 'Details') + '</a>' : '') + '</li>';
      }).join('');
      box.hidden = false;
    }
    var gift = safeUrl(s.giftCardUrl);
    if (gift) Array.prototype.forEach.call(d.querySelectorAll('a[data-giftcard]'), function (a) { a.href = gift; });
  }).catch(function () {});
})();
