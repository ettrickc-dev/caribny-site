// CaribNY live widgets: draws /api/live feeds, the barrel countdown, the fare board
// and the link-up search. Plain JS, no dependencies.
(function () {
  var cfg = window.CARIBNY || {};
  var cache = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function feed(name, qs) {
    var key = name + (qs || '');
    if (!cache[key]) cache[key] = fetch('/api/live?f=' + name + (qs || '')).then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.detail || j.error || r.status); return j; }); });
    return cache[key];
  }
  function ago(iso) {
    if (!iso) return '';
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' hr ago';
    return Math.round(h / 24) + ' days ago';
  }
  function num(n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function signed(n, d) { return (n > 0 ? '+' : '') + num(n, d == null ? 1 : d) + '%'; }
  function day(iso, opts) { return new Date(iso).toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' }); }
  function stamp(name, j) { document.querySelectorAll('[data-stamp="' + name + '"]').forEach(function (el) { el.textContent = 'Updated ' + ago(j.checked) + '.'; }); }
  function fail(el) { el.innerHTML = '<p class="muted">This information is not available right now. Please try again a little later.</p>'; }
  function spark(vals, w, h) {
    w = w || 110; h = h || 30;
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals), r = (max - min) || 1;
    var pts = vals.map(function (v, i) { return (i * w / Math.max(1, vals.length - 1)).toFixed(1) + ',' + (h - 2 - (v - min) / r * (h - 4)).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }

  // ---------- views ----------
  var views = {
    'fx-mini': function (el, j) {
      el.innerHTML = '<table class="kv"><tbody>' + j.currencies.filter(function (c) { return c.available; }).map(function (c) {
        var cls = c.pegged ? 'flat' : c.change30 > 0.05 ? 'fx-up' : c.change30 < -0.05 ? 'fx-down' : 'flat';
        return '<tr><td>' + esc(c.code === 'XCD' ? 'Eastern Caribbean' : c.island) + ' <span class="muted small">' + esc(c.code) + '</span></td><td class="num"><strong>' + num(c.rate, c.rate < 10 ? 2 : 1) + '</strong></td><td class="num ' + cls + ' small">' + (c.pegged ? 'fixed' : signed(c.change30) + ' 30d') + '</td></tr>';
      }).join('') + '</tbody></table>';
    },
    'fx-full': function (el, j) {
      el.innerHTML = j.currencies.filter(function (c) { return c.available; }).map(function (c) {
        var cls = c.change30 > 0.05 ? 'fx-up' : c.change30 < -0.05 ? 'fx-down' : 'flat';
        var trend = c.pegged || Math.abs(c.trendPerWeekPct) < 0.05 ? '' :
          '<p class="small">30-day trend: about ' + signed(c.trendPerWeekPct, 2).replace('%', '% a week') + '. If that trend simply continued, US$1 would buy about ' + esc(c.symbol) + num(c.nextWeekIfTrend, 2) + ' next week. Trends often reverse, so treat this as a rough guide, not a prediction you can count on.</p>';
        return '<div class="card"><h3>' + esc(c.name) + ' <span class="muted small">' + esc(c.code) + ' · ' + esc(c.island) + '</span></h3>' +
          '<table class="kv"><tbody><tr><td>US$1 buys</td><td class="num"><strong>' + esc(c.symbol) + num(c.rate, 4) + '</strong></td></tr>' +
          (c.pegged ? '<tr><td colspan="2" class="muted small">' + esc(c.pegged) + '</td></tr>' :
          '<tr><td>Last 7 days</td><td class="num ' + (c.change7 > 0.05 ? 'fx-up' : c.change7 < -0.05 ? 'fx-down' : 'flat') + '">' + signed(c.change7, 2) + '</td></tr>' +
          '<tr><td>Last 30 days</td><td class="num ' + cls + '">' + signed(c.change30, 2) + '</td></tr>' +
          '<tr><td>30-day range</td><td class="num">' + num(c.min, 2) + ' – ' + num(c.max, 2) + '</td></tr>' +
          '<tr><td>Good day to send?</td><td class="num"><strong>' + (c.score == null ? '–' : c.score + '/100') + '</strong></td></tr>') +
          '</tbody></table><p>' + esc(c.verdict) + '</p>' + (c.pegged ? '' : '<div class="fx-spark" title="Last 30 days">' + spark(c.series.map(function (p) { return p[1]; }), 300, 50) + '</div>') + trend + '</div>';
      }).join('') + '<p class="muted small">' + esc(j.source) + ' Rates as of ' + esc(j.currencies[0].date || '') + '.</p>';
      calc(j);
    },
    'hur-mini': function (el, j) {
      var atl = j.storms.filter(function (s) { return s.atlantic; });
      el.innerHTML = atl.length ? '<ul class="plain">' + atl.map(function (s) { return '<li class="note" style="margin:6px 0">' + esc(s.line) + '</li>'; }).join('') + '</ul>'
        : '<p><span class="pill ok">All clear</span> No active storms in the Atlantic right now.' + (j.inSeason ? '' : ' The hurricane season runs June 1 to November 30.') + '</p>';
    },
    'hur-full': function (el, j) {
      stamp('hurricanes', j);
      var atl = j.storms.filter(function (s) { return s.atlantic; });
      var html = '';
      if (!atl.length) html += '<div class="card"><p class="status-big"><span class="pill ok">All clear</span> No active storms in the Atlantic right now.</p><p>' + (j.inSeason ? 'We check the National Hurricane Center every few minutes. If a storm forms, it will show up here with its distance from each island.' : 'The Atlantic hurricane season runs June 1 to November 30. Storms outside the season are rare, but we keep watching.') + '</p></div>';
      atl.forEach(function (s) {
        html += '<div class="card storm"><h3>' + esc(s.label) + '</h3><p class="lede" style="font-size:1.05rem">' + esc(s.line) + '</p>' +
          '<p class="meta">Winds ' + s.windMph + ' mph · moving ' + (s.movementDir != null ? compass(s.movementDir) + ' ' : '') + 'at ' + s.movementMph + ' mph · ' + (s.lat != null ? Math.abs(s.lat).toFixed(1) + (s.lat >= 0 ? '°N' : '°S') + ', ' + Math.abs(s.lon).toFixed(1) + (s.lon <= 0 ? '°W' : '°E') : '') + (s.updated ? ' · advisory ' + ago(s.updated) : '') + '</p>' +
          '<h4>Distance from home</h4><ul class="hur-places">' +
          s.places.slice().sort(function (a, b) { return (b.heading - a.heading) || (a.heading ? a.hours - b.hours : a.miles - b.miles); }).map(function (p) { return '<li><strong>' + esc(p.name) + '</strong> <span class="muted small">' + esc(p.city) + '</span><span class="hp">' + num(p.miles, 0) + ' mi · ' + (p.heading ? '<strong>~' + (p.hours < 48 ? p.hours + ' hours' : (Math.round(p.hours / 12) / 2) + ' days') + ' at current speed</strong>' + (p.passBy > 60 ? ' (track passes ~' + num(p.passBy, 0) + ' mi away)' : '') : 'not on its current track') + '</span></li>'; }).join('') +
          '</ul><p>' + (s.advisoryUrl ? '<a href="' + esc(s.advisoryUrl) + '" rel="noopener" target="_blank">Latest NHC advisory</a> · ' : '') + (s.graphicsUrl ? '<a href="' + esc(s.graphicsUrl) + '" rel="noopener" target="_blank">Forecast cone</a>' : '') + '</p></div>';
      });
      if (j.outlook) html += '<div class="card"><h3>' + esc(j.outlook.title) + '</h3><p>' + esc(j.outlook.text) + '</p>' + (j.outlook.link ? '<p><a href="' + esc(j.outlook.link) + '" rel="noopener" target="_blank">Full outlook on nhc.noaa.gov</a></p>' : '') + '</div>';
      el.innerHTML = html;
    },
    'wx': function (el, j) {
      el.innerHTML = '<table class="kv"><tbody>' + j.places.filter(function (p) { return p.key !== 'new-york'; }).map(function (p) {
        var d = p.days[0] || {};
        return '<tr><td>' + esc(p.city) + ' <span class="muted small">' + esc(p.name) + '</span></td><td class="num"><strong>' + (p.temp == null ? '–' : p.temp + '°F') + '</strong></td><td class="small">' + esc(p.sky) + (d.rain != null ? ' · ' + d.rain + '% rain' : '') + '</td></tr>';
      }).join('') + '</tbody></table><p class="muted small">Now, with today’s chance of rain. Data: Open-Meteo.</p>';
    },
    'adv': function (el, j) {
      el.innerHTML = '<table class="kv"><tbody>' + j.countries.map(function (c) {
        return '<tr><td>' + esc(c.country) + '</td><td class="num"><span class="lvl lvl' + c.level + '" title="Level ' + c.level + '">' + c.level + '</span></td><td class="small">' + esc(c.level_text || '') + (c.confirmed === false ? ' <span class="muted">(being re-checked)</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table><p class="muted small">Levels 1 (normal precautions) to 4 (do not travel). Advisories can cover only parts of a country. Read the full advisory on <a href="' + esc(j.source) + '" rel="noopener" target="_blank">travel.state.gov</a> before you go.</p>';
    },
    'news': function (el, j) {
      el.innerHTML = j.top.length ? '<ul class="news-list">' + j.top.map(function (n) {
        return '<li><a href="' + esc(n.link) + '" rel="noopener" target="_blank">' + esc(n.title) + '</a><span class="meta">' + esc(n.source) + (n.date ? ' · ' + ago(n.date) : '') + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted">No headlines right now.</p>';
    },
    'cricket': function (el, j) {
      el.innerHTML = (j.live.length ? '<p><strong>Live:</strong> ' + j.live.map(esc).join(' · ') + '</p>' : '') +
        (j.stories.length ? '<ul class="news-list">' + j.stories.map(function (n) { return '<li><a href="' + esc(n.link) + '" rel="noopener" target="_blank">' + esc(n.title) + '</a><span class="meta">ESPNcricinfo' + (n.date ? ' · ' + ago(n.date) : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">No West Indies news right now.</p>');
    },
    'subway': function (el, j) {
      stamp('subway', j);
      var chips = j.routes.map(function (r) {
        var t = j.byRoute[r] || [];
        return '<li><span class="bullet r' + esc(r) + '" style="opacity:1">' + esc(r) + '</span> ' + (t.length ? '<span class="pill">' + esc(t[0]) + (t.length > 1 ? ' +' + (t.length - 1) : '') + '</span>' : '<span class="pill ok">Good service</span>') + '</li>';
      }).join('');
      el.innerHTML = '<ul class="plain route-status">' + chips + '</ul>' + (j.alerts.length ? j.alerts.map(function (a) {
        return '<div class="alert"><p>' + a.routes.map(function (r) { return '<span class="bullet r' + esc(r) + '">' + esc(r) + '</span>'; }).join('') + ' <strong>' + esc(a.type) + '</strong>' + (a.updated ? ' <span class="muted small">' + ago(a.updated) + '</span>' : '') + '</p><p>' + esc(a.header) + '</p>' + (a.detail ? '<details class="mini"><summary>Details</summary><p class="small">' + esc(a.detail) + '</p></details>' : '') + '</div>';
      }).join('') : '<p>No active alerts on these lines right now.</p>');
    },
    'asp': function (el, j) {
      function line(label, s) { return '<p><strong>' + label + ' (' + day(s.date + 'T12:00:00') + '):</strong> ' + (s.suspended ? '<span class="pill ok">Suspended</span> ' + esc(s.reason || '') : '<span class="pill">In effect</span> Move your car per posted signs.') + '</p>'; }
      el.innerHTML = line('Today', j.today) + line('Tomorrow', j.tomorrow) + (j.upcoming.length ? '<p class="small">Next suspensions: ' + j.upcoming.map(function (u) { return day(u.date + 'T12:00:00') + ' (' + esc(u.reason) + ')'; }).join(' · ') + '</p>' : '');
    },
    'nyc': function (el, j) {
      el.innerHTML = (j.alerts.length ? j.alerts.map(function (a) { return '<p class="note"><strong>' + esc(a.event) + ':</strong> ' + esc(a.headline || '') + '</p>'; }).join('') : '') +
        '<table class="kv"><tbody>' + j.periods.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="num"><strong>' + p.temp + '°' + esc(p.unit) + '</strong></td><td class="small">' + esc(p.short) + (p.rain != null ? ' · ' + p.rain + '% rain' : '') + '</td></tr>'; }).join('') + '</tbody></table>';
    }
  };
  function compass(d) { return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(d / 45) % 8]; }

  function calc(j) {
    var form = document.getElementById('fx-calc'); if (!form) return;
    var amt = document.getElementById('fx-amt'), cur = document.getElementById('fx-cur'), out = document.getElementById('fx-out');
    try { var saved = localStorage.getItem('cny_fx_cur'); if (saved) cur.value = saved; } catch (e) {}
    function run() {
      var c = j.currencies.filter(function (x) { return x.code === cur.value; })[0]; var a = Number(amt.value) || 0;
      if (!c || !c.available) { out.textContent = 'Rate not available right now.'; return; }
      var got = a * c.rate, then = a * c.series[0][1], diff = got - then;
      out.innerHTML = '<span class="big">' + esc(c.symbol) + num(got, 2) + '</span>' +
        (c.pegged ? 'at the fixed rate of ' + num(c.rate, 2) + '.' : 'at ' + num(c.rate, 4) + ' per US$. ' + (Math.abs(diff) >= 0.01 ? 'That is <strong class="' + (diff > 0 ? 'fx-up' : 'fx-down') + '">' + esc(c.symbol) + num(Math.abs(diff), 2) + ' ' + (diff > 0 ? 'more' : 'less') + '</strong> than the same US$' + num(a, 0) + ' bought 30 days ago. ' : '') + '<br><strong>' + esc(c.verdict) + '</strong>') +
        '<br><span class="muted small">Mid-market rate. Your provider’s rate and fees will reduce the amount received.</span>';
      try { localStorage.setItem('cny_fx_cur', cur.value); } catch (e) {}
    }
    amt.addEventListener('input', run); cur.addEventListener('change', run); run();
  }

  function load(el) {
    var name = el.dataset.feed, view = views[el.dataset.view]; if (!view) return;
    var qs = '';
    if (name === 'subway') {
      var picks = [].slice.call(document.querySelectorAll('#route-picks input:checked')).map(function (i) { return i.value; });
      qs = '&routes=' + encodeURIComponent((picks.length ? picks : ['2', '3', '4', '5', 'B', 'Q']).join(','));
    }
    el.setAttribute('aria-busy', 'true');
    feed(name, qs).then(function (j) { view(el, j); if (name === 'fx') stamp('fx', j); }).catch(function () { fail(el); document.querySelectorAll('[data-stamp="' + name + '"]').forEach(function (s) { s.textContent = ''; }); })
      .then(function () { el.removeAttribute('aria-busy'); });
  }
  var picks = document.getElementById('route-picks');
  document.querySelectorAll('[data-feed]').forEach(function (el) { if (!(picks && el.dataset.feed === 'subway')) load(el); });
  if (picks) {
    try { var saved = JSON.parse(localStorage.getItem('cny_routes') || 'null'); if (saved && saved.length) picks.querySelectorAll('input').forEach(function (i) { i.checked = saved.indexOf(i.value) > -1; }); } catch (e) {}
    load(document.querySelector('[data-feed="subway"]'));
    picks.addEventListener('change', function () {
      var v = [].slice.call(picks.querySelectorAll('input:checked')).map(function (i) { return i.value; });
      try { localStorage.setItem('cny_routes', JSON.stringify(v)); } catch (e) {}
      load(document.querySelector('[data-feed="subway"]'));
    });
  }
  // refresh fast-moving feeds while the page is open
  setInterval(function () {
    if (document.hidden) return;
    ['subway', 'hurricanes'].forEach(function (n) { Object.keys(cache).forEach(function (k) { if (k.indexOf(n) === 0) delete cache[k]; }); document.querySelectorAll('[data-feed="' + n + '"]').forEach(load); });
  }, 5 * 60 * 1000);

  // ---------- countdowns ----------
  function nyToday() { var p = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); return new Date(p + 'T12:00:00'); }
  function daysBetween(a, b) { return Math.round((b - a) / 864e5); }
  document.querySelectorAll('[data-countdown]').forEach(function (el) {
    var t = nyToday(), md = el.dataset.countdown.split('-');
    var target = new Date(t.getFullYear() + '-' + md[0] + '-' + md[1] + 'T12:00:00');
    if (target < t) target = new Date((t.getFullYear() + 1) + '-' + md[0] + '-' + md[1] + 'T12:00:00');
    el.textContent = daysBetween(t, target);
  });

  var board = document.getElementById('barrel-board');
  if (board) {
    var rows = []; try { rows = JSON.parse(board.dataset.cutoffs || '[]'); } catch (e) {}
    var t = nyToday(), xmas = new Date(t.getFullYear() + '-12-25T12:00:00');
    if (xmas < t) xmas = new Date((t.getFullYear() + 1) + '-12-25T12:00:00');
    var fmt = function (d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    var left = function (d) { var n = daysBetween(t, d); return '<div class="days">' + (n < 0 ? '<span class="pill">passed</span>' : n === 0 ? '<b>Today</b>' : '<b>' + n + '</b><span>day' + (n === 1 ? '' : 's') + ' left</span>') + '</div>'; };
    var items = rows.map(function (r) {
      if (r.kind === 'weekly_schedule' && r.sail_weekday != null) {
        var s = new Date(xmas.getTime() - 864e5); while (s.getDay() !== r.sail_weekday) s = new Date(s.getTime() - 864e5);
        var c = null;
        if (r.cutoff_weekday != null) { c = new Date(s.getTime() - 864e5); while (c.getDay() !== r.cutoff_weekday) c = new Date(c.getTime() - 864e5); }
        return { sort: (c || s).getTime(), html: '<li class="cut">' + left(c || s) + '<div><h3>' + esc(r.destination) + '</h3><p class="small">' + (r.business_slug ? '<a href="/business/' + esc(r.business_slug) + '/">' + esc(r.shipper) + '</a>' : esc(r.shipper)) + ' · weekly schedule</p><p>' + (c ? 'Drop off by <strong>' + fmt(c) + '</strong> for the ' : 'Last sailing before Christmas: ') + '<strong>' + fmt(s) + '</strong> sailing, the last one before Christmas.</p></div></li>', note: r };
      }
      if (r.kind === 'published_cutoff' && r.cutoff_date) {
        var d = new Date(r.cutoff_date + 'T12:00:00');
        return { sort: d.getTime(), html: '<li class="cut">' + left(d) + '<div><h3>' + esc(r.destination) + '</h3><p class="small">' + (r.business_slug ? '<a href="/business/' + esc(r.business_slug) + '/">' + esc(r.shipper) + '</a>' : esc(r.shipper)) + ' · published Christmas cutoff' + (r.source_url ? ' (<a href="' + esc(r.source_url) + '" rel="noopener" target="_blank">source</a>)' : '') + '</p><p>Christmas cutoff: <strong>' + fmt(d) + '</strong></p>' + (r.note ? '<p class="small">' + esc(r.note) + '</p>' : '') + '</div></li>', note: r };
      }
      return null;
    }).filter(Boolean).sort(function (a, b) { return a.sort - b.sort; });
    var concessions = rows.filter(function (r) { return r.kind === 'customs_concession'; });
    var sources = rows.filter(function (r) { return r.source_url; }).map(function (r) { return r.source_url; }).filter(function (u, i, a) { return a.indexOf(u) === i; });
    board.innerHTML = (items.length ? '<h2>Days left, by destination</h2><ul class="cut-list">' + items.map(function (i) { return i.html; }).join('') + '</ul>' +
      '<p class="muted small">Weekly-schedule dates are calculated by CaribNY from each shipper’s published weekly sailing pattern; holiday changes can move them. Last checked: ' + esc(rows.map(function (r) { return r.verified_on; }).filter(Boolean).sort().pop() || '') + '.</p>' : '<p>No shipper has published a Christmas cutoff yet.</p>') +
      (concessions.length ? '<h2>Duty-free barrel concessions back home</h2>' + concessions.map(function (r) { return '<div class="card"><h3>' + esc(r.destination) + '</h3><p>' + esc(r.note || '') + '</p>' + (r.source_url ? '<p class="small"><a href="' + esc(r.source_url) + '" rel="noopener" target="_blank">Source</a></p>' : '') + '</div>'; }).join('') : '') +
      (sources.length ? '<p class="muted small">Sources: ' + sources.map(function (u) { return '<a href="' + esc(u) + '" rel="noopener" target="_blank">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) + '</a>'; }).join(', ') + '</p>' : '');
  }

  // ---------- fare board ----------
  var fb = document.getElementById('fare-board');
  function loadFares() {
    var airports = {}; try { airports = JSON.parse(fb.dataset.airports); } catch (e) {}
    var since = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10);
    fetch(cfg.url + '/rest/v1/fare_reports?select=origin,destination,airline,price_usd,trip_type,travel_month,seen_on,where_seen,created_at&status=eq.published&seen_on=gte.' + since + '&order=created_at.desc&limit=1000', { headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        var now = Date.now(), cut14 = now - 14 * 864e5, cut28 = now - 28 * 864e5;
        var rt = rows.filter(function (r) { return r.trip_type === 'round-trip'; });
        var groups = {};
        rt.forEach(function (r) { var k = r.origin + '-' + r.destination; (groups[k] = groups[k] || []).push(r); });
        function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }
        var sum = Object.keys(groups).map(function (k) {
          var g = groups[k], seen = function (r) { return new Date(r.seen_on + 'T12:00:00').getTime(); };
          var cur = g.filter(function (r) { return seen(r) >= cut14; }).map(function (r) { return r.price_usd; });
          var prev = g.filter(function (r) { return seen(r) < cut14 && seen(r) >= cut28; }).map(function (r) { return r.price_usd; });
          var useCur = cur.length ? cur : g.map(function (r) { return r.price_usd; });
          var hol = g.filter(function (r) { return /-12-01$/.test(r.travel_month); }).map(function (r) { return r.price_usd; });
          return { k: k, o: g[0].origin, d: g[0].destination, n: useCur.length, med: median(useCur), low: Math.min.apply(null, useCur), avg: Math.round(useCur.reduce(function (s, x) { return s + x; }, 0) / useCur.length), prev: median(prev), hol: median(hol), recent: !!cur.length };
        }).sort(function (a, b) { return b.n - a.n; });
        var html = '';
        if (sum.length) {
          var top = sum[0];
          html += '<div class="card highlight"><p class="status-big">' + esc(airports[top.d] ? airports[top.d].replace(/ \(.*/, '') : top.d) + ' from ' + esc(top.o) + ' is averaging $' + num(top.avg, 0) + ' round trip</p><p class="muted">Based on ' + top.n + ' fare' + (top.n === 1 ? '' : 's') + ' readers spotted ' + (top.recent ? 'in the last 14 days' : 'recently') + (top.prev ? '; the 2 weeks before that the typical fare was $' + num(top.prev, 0) : '') + '.</p></div>';
          html += '<h2>Round-trip fares by route</h2><div class="table-wrap"><table class="stats fare-sum"><thead><tr><th>Route</th><th class="num">Reports</th><th class="num">Typical</th><th class="num">Lowest</th><th class="num">Trend</th><th class="num">December trips</th></tr></thead><tbody>' + sum.map(function (s) {
            var tr = s.prev && s.med ? Math.round((s.med - s.prev) / s.prev * 100) : null;
            return '<tr><td>' + esc(s.o) + ' → ' + esc(airports[s.d] || s.d) + '</td><td class="num">' + s.n + '</td><td class="num"><strong>$' + num(s.med, 0) + '</strong></td><td class="num">$' + num(s.low, 0) + '</td><td class="num ' + (tr == null ? '' : tr > 3 ? 'up' : tr < -3 ? 'down' : 'flat') + '">' + (tr == null ? '–' : (tr > 0 ? '+' : '') + tr + '%') + '</td><td class="num">' + (s.hol ? '$' + num(s.hol, 0) : '–') + '</td></tr>';
          }).join('') + '</tbody></table></div><p class="muted small">"Typical" is the middle (median) price reported in the last 14 days. "Trend" compares it with the 2 weeks before. Few reports means a rough picture.</p>';
        } else html += '<div class="card highlight"><p class="status-big">No fares spotted yet. Be the first!</p><p>Seen a price for a flight home? Add it below. Once a few people share, we show the typical price for each route and whether fares are rising or falling.</p></div>';
        if (rows.length) html += '<h2>Latest fares spotted</h2><ul class="news-list">' + rows.slice(0, 15).map(function (r) {
          return '<li><strong>$' + num(r.price_usd, 0) + '</strong> ' + esc(r.trip_type) + ' ' + esc(r.origin) + ' → ' + esc(airports[r.destination] || r.destination) + '<span class="meta">' + (r.airline ? esc(r.airline) + ' · ' : '') + 'travel ' + new Date(r.travel_month + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' · spotted ' + day(r.seen_on + 'T12:00:00') + (r.where_seen ? ' · ' + esc(r.where_seen) : '') + '</span></li>';
        }).join('') + '</ul>';
        fb.innerHTML = html;
      }).catch(function () { fail(fb); });
  }
  if (fb) { loadFares(); document.addEventListener('cny:submitted', function (e) { if (e.detail.table === 'fare_reports') loadFares(); }); }

  // ---------- link-up search ----------
  var luq = document.getElementById('lu-q');
  if (luq) {
    var kind = document.getElementById('lu-kind'), count = document.getElementById('lu-count');
    var cards = [].slice.call(document.querySelectorAll('.lu-list > li'));
    var apply = function () {
      var terms = luq.value.toLowerCase().trim().split(/\s+/).filter(Boolean), n = 0;
      cards.forEach(function (c) { var ok = (!kind.value || c.dataset.kind === kind.value) && terms.every(function (t) { return c.dataset.text.indexOf(t) > -1; }); c.hidden = !ok; if (ok) n++; });
      count.textContent = n + ' of ' + cards.length + ' groups and organizations';
    };
    luq.addEventListener('input', apply); kind.addEventListener('change', apply); apply();
  }
})();
