// CaribNY client script: directory filters, form submission to Supabase, click tracking.
(function () {
  var cfg = window.CARIBNY || {};
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  function post(table, row) {
    return fetch(cfg.url + '/rest/v1/' + table, { method: 'POST', headers: headers, body: JSON.stringify(row) });
  }
  var sid = (function () { try { var s = sessionStorage.getItem('cny_sid'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('cny_sid', s); } return s; } catch (e) { return null; } })();
  var params = new URLSearchParams(location.search);

  // ---- directory filters
  var list = document.getElementById('biz-list');
  if (list) {
    var q = document.getElementById('f-q'), region = document.getElementById('f-region'), cat = document.getElementById('f-cat'),
        island = document.getElementById('f-island'), ver = document.getElementById('f-verified'), count = document.getElementById('f-count');
    var cards = Array.prototype.slice.call(list.children);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('region')) region.value = params.get('region');
    if (params.get('cat')) cat.value = params.get('cat');
    if (params.get('island')) island.value = params.get('island');
    function apply() {
      var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean), n = 0;
      cards.forEach(function (c) {
        var d = c.dataset;
        var ok = (!region.value || d.region === region.value) && (!cat.value || d.cat === cat.value) &&
          (!island.value || (' ' + d.islands + ' ').indexOf(' ' + island.value + ' ') > -1) && (!ver.checked || d.verified === '1') &&
          terms.every(function (t) { return d.text.indexOf(t) > -1; });
        c.hidden = !ok; if (ok) n++;
      });
      count.textContent = n + ' of ' + cards.length + ' businesses';
      var p = new URLSearchParams();
      if (q.value) p.set('q', q.value); if (region.value) p.set('region', region.value); if (cat.value) p.set('cat', cat.value); if (island.value) p.set('island', island.value);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    }
    [q, region, cat, island, ver].forEach(function (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); });
    apply();
  }

  // ---- forms
  document.querySelectorAll('form.js-form').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = form.querySelector('.form-msg'), btn = form.querySelector('button[type=submit]');
      var row = {};
      new FormData(form).forEach(function (v, k) { if (v !== '') row[k] = v; });
      form.querySelectorAll('input[type=checkbox][name]').forEach(function (c) { row[c.name] = c.checked; });
      if (row.starts_at) row.starts_at = new Date(row.starts_at).toISOString();
      form.querySelectorAll('input[type=datetime-local]').forEach(function (i) { if (i.value && i.name !== 'starts_at') row[i.name] = new Date(i.value).toISOString(); });
      form.querySelectorAll('input[type=number]').forEach(function (i) { if (i.value !== '') row[i.name] = Number(i.value); });
      if (form.dataset.table === 'subscribers') { row.source = form.dataset.source || 'site'; row.page_path = location.pathname; }
      btn.disabled = true; msg.textContent = 'Sending…';
      post(form.dataset.table, row).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        msg.textContent = form.dataset.table === 'subscribers' ? "You're subscribed. Thank you!" : form.dataset.after === 'fares' ? 'Thanks! Your fare is on the board.' : 'Thank you! We got it and will review it soon.';
        document.dispatchEvent(new CustomEvent('cny:submitted', { detail: { table: form.dataset.table } }));
      }).catch(function () {
        msg.textContent = 'Sorry, that didn’t go through. Please check the fields and try again.';
      }).finally(function () { btn.disabled = false; });
    });
  });

  // ---- outbound click tracking
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-track]');
    if (!a) return;
    var row = { event: a.dataset.track, target: a.textContent.trim().slice(0, 120), target_url: a.href, page_path: location.pathname, session_id: sid,
      utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign') };
    if (a.dataset.biz) row.business_id = a.dataset.biz;
    try { fetch(cfg.url + '/rest/v1/clicks', { method: 'POST', headers: headers, body: JSON.stringify(row), keepalive: true }); } catch (e) {}
  });
})();
