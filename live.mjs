// CaribNY live data endpoint: /api/live?f=<feed>
// Pulls free public feeds server-side (no API keys), adds CaribNY's own
// calculations, and lets Netlify's CDN cache each answer.
//
// Feeds: hurricanes, news, cricket, subway, nyc, asp, weather, fx, advisories

const UA = 'CaribNY community guide (https://caribny.com; caribny.com/about/)';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wfrxpzbchmbvqkzkfepn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcnhwemJjaG1idnFremtmZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDIzMjAsImV4cCI6MjEwOTM3ODMyMH0.eYvkMWJ0Iqr8Uu11pmFNFp5tmQduBKkSXSaeq_sYjGY';

// ---------- small helpers ----------
async function get(url, { type = 'json', timeout = 8000, headers = {} } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : '*/*', ...headers }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return type === 'json' ? res.json() : res.text();
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#039': "'", hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };
const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-z0-9#]+);/gi, (m, k) => ENT[k.toLowerCase()] ?? m)
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };
function parseRss(xml, source, max = 6) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const seen = new Set();
  return items.map((it) => {
    let link = decode(tag(it, 'link') || tag(it, 'guid'));
    try { const u = new URL(link); [...u.searchParams.keys()].filter((k) => k.startsWith('utm_') || k === 'ex_cid').forEach((k) => u.searchParams.delete(k)); u.protocol = 'https:'; link = u.toString(); } catch { link = ''; }
    const d = new Date(decode(tag(it, 'pubDate') || tag(it, 'dc:date')));
    return { title: decode(tag(it, 'title')), link, date: isNaN(d) ? null : d.toISOString(), source };
  }).filter((x) => x.title && x.link && !seen.has(x.link) && seen.add(x.link))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, max);
}
const R = 3958.8; // earth radius, miles
const rad = (d) => d * Math.PI / 180;
function distance(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const ymd = (d) => d.toISOString().slice(0, 10);

// ---------- places ----------
const PLACES = [
  { key: 'jamaica', name: 'Jamaica', city: 'Kingston', lat: 17.97, lon: -76.79 },
  { key: 'haiti', name: 'Haiti', city: 'Port-au-Prince', lat: 18.54, lon: -72.34 },
  { key: 'trinidad-tobago', name: 'Trinidad & Tobago', city: 'Port of Spain', lat: 10.65, lon: -61.51 },
  { key: 'guyana', name: 'Guyana', city: 'Georgetown', lat: 6.80, lon: -58.16 },
  { key: 'barbados', name: 'Barbados', city: 'Bridgetown', lat: 13.10, lon: -59.62 },
  { key: 'grenada', name: 'Grenada', city: "St. George's", lat: 12.05, lon: -61.75 },
  { key: 'st-vincent', name: 'St. Vincent', city: 'Kingstown', lat: 13.16, lon: -61.23 },
  { key: 'st-lucia', name: 'St. Lucia', city: 'Castries', lat: 14.01, lon: -60.99 },
  { key: 'dominica', name: 'Dominica', city: 'Roseau', lat: 15.30, lon: -61.39 },
  { key: 'antigua', name: 'Antigua', city: "St. John's", lat: 17.12, lon: -61.85 },
  { key: 'dominican-republic', name: 'Dominican Republic', city: 'Santo Domingo', lat: 18.49, lon: -69.93 },
  { key: 'bahamas', name: 'The Bahamas', city: 'Nassau', lat: 25.05, lon: -77.35 },
  { key: 'new-york', name: 'New York City', city: 'New York', lat: 40.71, lon: -74.01 }
];

// ---------- feeds ----------
const CLASS = { TD: 'Tropical Depression', TS: 'Tropical Storm', HU: 'Hurricane', MH: 'Major Hurricane', STD: 'Subtropical Depression', STS: 'Subtropical Storm', PTC: 'Potential Tropical Cyclone', PC: 'Post-tropical Cyclone', TY: 'Typhoon' };
function saffir(kt) { const k = +kt; if (k >= 137) return 5; if (k >= 113) return 4; if (k >= 96) return 3; if (k >= 83) return 2; if (k >= 64) return 1; return 0; }
function coord(num, str) {
  if (typeof num === 'number') return num;
  const m = String(str || '').match(/([\d.]+)\s*([NSEW])/i); if (!m) return null;
  return (/[SW]/i.test(m[2]) ? -1 : 1) * parseFloat(m[1]);
}
async function hurricanes() {
  const data = await get('https://www.nhc.noaa.gov/CurrentStorms.json');
  const storms = (data.activeStorms || []).filter((s) => /^(al|ep|cp)/i.test(s.id || '') ).map((s) => {
    const pos = { lat: coord(s.latitudeNumeric, s.latitude), lon: coord(s.longitudeNumeric, s.longitude) };
    const windKt = Number(s.intensity) || 0, speed = Number(s.movementSpeed) || 0, dir = Number(s.movementDir);
    const atlantic = /^al/i.test(s.id || '');
    const places = pos.lat == null || pos.lon == null ? [] : PLACES.map((p) => {
      const miles = distance(pos, p);
      const off = Number.isFinite(dir) ? angleDiff(dir, bearing(pos, p)) : 180;
      const heading = speed > 0 && off <= 35 && miles < 2500;
      const hours = heading ? miles / speed : null;
      return { key: p.key, name: p.name, city: p.city, miles: Math.round(miles), heading, hours: hours && Math.round(hours),
        passBy: heading ? Math.round(miles * Math.sin(rad(off))) : null };
    }).sort((a, b) => a.miles - b.miles);
    const cls = CLASS[s.classification] || s.classification || 'Storm';
    const cat = s.classification === 'HU' ? saffir(windKt) : 0;
    const label = `${cls}${cat ? ' (Category ' + cat + ')' : ''} ${s.name || ''}`.trim();
    const towards = places.filter((p) => p.heading && p.key !== 'new-york').sort((a, b) => a.hours - b.hours);
    let line;
    if (!atlantic) line = `${label} is in the Pacific and is not a threat to the Caribbean.`;
    else if (towards.length) {
      const t = towards[0]; const days = t.hours / 24;
      line = `${label}: about ${days < 1 ? Math.max(1, Math.round(t.hours)) + ' hours' : (Math.round(days * 2) / 2) + ' days'} from ${t.name} if it keeps its current speed (${speed} mph) and direction.`;
    } else line = `${label}: its current track is not pointed at any of the islands we watch. Nearest: ${places[0]?.name} (${places[0]?.miles.toLocaleString('en-US')} miles).`;
    return { id: s.id, name: s.name, classification: s.classification, label, category: cat, windMph: Math.round(windKt * 1.15078), windKt,
      pressureMb: Number(s.pressure) || null, lat: pos.lat, lon: pos.lon, movementDir: Number.isFinite(dir) ? dir : null, movementMph: speed,
      updated: s.lastUpdate || null, advisoryUrl: s.publicAdvisory?.url || null, graphicsUrl: s.forecastGraphics?.url || null,
      atlantic, line, places: places.slice(0, 13) };
  });
  let outlook = null;
  try {
    const xml = await get('https://www.nhc.noaa.gov/index-at.xml', { type: 'text' });
    const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
    const two = items.find((it) => /tropical weather outlook/i.test(tag(it, 'title')));
    if (two) outlook = { title: decode(tag(two, 'title')), text: decode(tag(two, 'description')).slice(0, 900), link: decode(tag(two, 'link')) };
  } catch {}
  const now = new Date(); const m = now.getUTCMonth() + 1;
  return { storms, outlook, inSeason: m >= 6 && m <= 11, checked: now.toISOString(), source: 'https://www.nhc.noaa.gov/' };
}

const NEWS = [
  { source: 'Jamaica Gleaner', island: 'Jamaica', url: 'https://jamaica-gleaner.com/feed/rss.xml' },
  { source: 'Jamaica Observer', island: 'Jamaica', url: 'https://www.jamaicaobserver.com/feed/' },
  { source: 'Trinidad Express', island: 'Trinidad & Tobago', url: 'https://trinidadexpress.com/search/?f=rss' },
  { source: 'CNC3', island: 'Trinidad & Tobago', url: 'https://www.cnc3.co.tt/feed/' },
  { source: 'News Room Guyana', island: 'Guyana', url: 'https://newsroom.gy/feed/' },
  { source: 'Demerara Waves', island: 'Guyana', url: 'https://demerarawaves.com/feed/' },
  { source: 'Barbados Today', island: 'Barbados', url: 'https://barbadostoday.bb/feed/' },
  { source: 'The Haitian Times', island: 'Haiti', url: 'https://haitiantimes.com/feed/' },
  { source: 'Loop News', island: 'Caribbean', url: 'https://www.loopnews.com/news/feed/' }
];
async function news() {
  const results = await Promise.allSettled(NEWS.map(async (n) => parseRss(await get(n.url, { type: 'text' }), n.source, 5).map((x) => ({ ...x, island: n.island }))));
  const bySource = {}; const items = [];
  results.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.length) { bySource[NEWS[i].source] = r.value; items.push(...r.value); } });
  // newest first, but at most 2 per outlet in the top list so one paper doesn't dominate
  const count = {}; const top = [];
  items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((x) => { count[x.source] = (count[x.source] || 0) + 1; if (count[x.source] <= 2) top.push(x); });
  return { top: top.slice(0, 14), bySource, checked: new Date().toISOString() };
}

async function cricket() {
  const xml = await get('https://www.cricinfo.com/rss/content/story/feeds/4.xml', { type: 'text' });
  let live = [];
  try {
    const lx = await get('https://static.cricinfo.com/rss/livescores.xml', { type: 'text', timeout: 5000 });
    live = [...lx.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => decode(tag(m[0], 'title'))).filter((t) => /west indies|windies/i.test(t)).slice(0, 5);
  } catch {}
  return { stories: parseRss(xml, 'ESPNcricinfo', 6), live, checked: new Date().toISOString() };
}

async function subway(url) {
  const want = (url.searchParams.get('routes') || '2,3,4,5,B,Q').toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
  const data = await get('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json');
  const now = Date.now() / 1000;
  const alerts = [];
  for (const e of data.entity || []) {
    const a = e.alert; if (!a) continue;
    const active = (a.active_period || []).some((p) => (p.start || 0) <= now && (!p.end || p.end > now));
    if (!active) continue;
    const routes = [...new Set((a.informed_entity || []).map((x) => String(x.route_id || '').toUpperCase()).filter(Boolean))];
    const hit = routes.filter((r) => want.includes(r) || want.includes(r.replace(/X$/, '')));
    if (!hit.length) continue;
    const pick = (t) => (t?.translation || []).find((x) => x.language === 'en')?.text || '';
    const merc = a['transit_realtime.mercury_alert'] || {};
    alerts.push({ id: e.id, routes: hit, type: merc.alert_type || 'Alert', header: pick(a.header_text).slice(0, 400), detail: pick(a.description_text).slice(0, 700), updated: merc.updated_at ? new Date(merc.updated_at * 1000).toISOString() : null });
  }
  const order = (t) => /suspend|no trains|part suspended/i.test(t) ? 0 : /delay/i.test(t) ? 1 : /reroute|express|local|skip/i.test(t) ? 2 : 3;
  alerts.sort((a, b) => order(a.type) - order(b.type) || (b.updated || '').localeCompare(a.updated || ''));
  const byRoute = Object.fromEntries(want.map((r) => [r, alerts.filter((a) => a.routes.includes(r)).map((a) => a.type)]));
  return { routes: want, byRoute, alerts: alerts.slice(0, 30), checked: new Date().toISOString(), source: 'https://new.mta.info/alerts' };
}

let nwsForecastUrl = null;
async function nyc() {
  if (!nwsForecastUrl) { const p = await get('https://api.weather.gov/points/40.65,-73.95', { headers: { Accept: 'application/geo+json' } }); nwsForecastUrl = p.properties.forecast; }
  const f = await get(nwsForecastUrl, { headers: { Accept: 'application/geo+json' } });
  const periods = (f.properties?.periods || []).slice(0, 6).map((p) => ({ name: p.name, temp: p.temperature, unit: p.temperatureUnit, short: p.shortForecast, detail: p.detailedForecast, rain: p.probabilityOfPrecipitation?.value ?? null, wind: `${p.windSpeed || ''} ${p.windDirection || ''}`.trim(), isDaytime: p.isDaytime, start: p.startTime }));
  let alerts = [];
  try {
    const a = await get('https://api.weather.gov/alerts/active?point=40.65,-73.95', { headers: { Accept: 'application/geo+json' } });
    alerts = (a.features || []).map((x) => ({ event: x.properties.event, headline: x.properties.headline, severity: x.properties.severity, ends: x.properties.ends || x.properties.expires })).slice(0, 5);
  } catch {}
  return { periods, alerts, checked: new Date().toISOString(), source: 'https://www.weather.gov/okx/' };
}

function nyDate(d = new Date()) { return new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' })); }
async function asp() {
  const today = nyDate(); const year = today.getFullYear();
  const days = new Map();
  for (const y of [year, year + 1]) {
    try {
      const ics = await get(`https://www.nyc.gov/html/dot/downloads/misc/${y}-alternate-side.ics`, { type: 'text' });
      for (const ev of ics.split('BEGIN:VEVENT').slice(1)) {
        const start = (ev.match(/DTSTART[^:]*:(\d{8})/) || [])[1];
        const end = (ev.match(/DTEND[^:]*:(\d{8})/) || [])[1];
        const summary = decode(((ev.match(/SUMMARY[^:]*:([^\r\n]*(?:\r?\n[ \t][^\r\n]*)*)/) || [])[1] || '').replace(/\r?\n[ \t]/g, '').replace(/\\,/g, ','));
        if (!start) continue;
        const s = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T12:00:00`);
        const e = end ? new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T12:00:00`) : new Date(s.getTime() + 864e5);
        for (let d = new Date(s); d < e; d = new Date(d.getTime() + 864e5)) days.set(ymd(d), summary);
      }
    } catch {}
  }
  if (!days.size) throw new Error('ASP calendar unavailable');
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const status = (d) => {
    const k = key(d); if (days.has(k)) return { date: k, suspended: true, reason: days.get(k) };
    if (d.getDay() === 0) return { date: k, suspended: true, reason: 'Sunday (ASP rules are not in effect on Sundays)' };
    return { date: k, suspended: false, reason: null };
  };
  const tomorrow = new Date(today.getTime() + 864e5);
  const upcoming = [...days.entries()].filter(([k]) => k > key(today)).sort().slice(0, 5).map(([date, reason]) => ({ date, reason }));
  return { today: status(today), tomorrow: status(tomorrow), upcoming, checked: new Date().toISOString(), source: 'https://www.nyc.gov/html/dot/html/motorist/alternate-side-parking.shtml' };
}

const WMO = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms', 96: 'Thunderstorms, hail', 99: 'Thunderstorms, hail' };
async function weather() {
  const ps = PLACES.filter((p) => ['jamaica', 'trinidad-tobago', 'guyana', 'haiti', 'barbados', 'grenada', 'st-lucia', 'st-vincent', 'dominican-republic', 'new-york'].includes(p.key));
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${ps.map((p) => p.lat).join(',')}&longitude=${ps.map((p) => p.lon).join(',')}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`;
  const data = await get(u);
  const arr = Array.isArray(data) ? data : [data];
  return { places: ps.map((p, i) => {
    const d = arr[i] || {};
    return { key: p.key, name: p.name, city: p.city, temp: d.current?.temperature_2m != null ? Math.round(d.current.temperature_2m) : null,
      humidity: d.current?.relative_humidity_2m ?? null, sky: WMO[d.current?.weather_code] || '',
      days: (d.daily?.time || []).map((t, j) => ({ date: t, hi: Math.round(d.daily.temperature_2m_max[j]), lo: Math.round(d.daily.temperature_2m_min[j]), rain: d.daily.precipitation_probability_max?.[j] ?? null, sky: WMO[d.daily.weather_code?.[j]] || '' })) };
  }), checked: new Date().toISOString(), source: 'https://open-meteo.com/' };
}

const FX = [
  { code: 'jmd', name: 'Jamaican dollar', island: 'Jamaica', symbol: 'J$' },
  { code: 'ttd', name: 'Trinidad & Tobago dollar', island: 'Trinidad & Tobago', symbol: 'TT$' },
  { code: 'gyd', name: 'Guyanese dollar', island: 'Guyana', symbol: 'G$' },
  { code: 'htg', name: 'Haitian gourde', island: 'Haiti', symbol: 'HTG ' },
  { code: 'bbd', name: 'Barbados dollar', island: 'Barbados', symbol: 'Bds$', pegged: 'Fixed at 2 Barbados dollars to US$1 by the Central Bank of Barbados.' },
  { code: 'xcd', name: 'Eastern Caribbean dollar', island: 'Grenada, St. Lucia, St. Vincent, Dominica, Antigua, St. Kitts', symbol: 'EC$', pegged: 'Fixed at 2.70 EC dollars to US$1 by the Eastern Caribbean Central Bank.' }
];
async function fxDay(date) {
  const urls = [`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`, `https://${date}.currency-api.pages.dev/v1/currencies/usd.min.json`];
  for (const u of urls) { try { const d = await get(u, { timeout: 6000 }); if (d?.usd) return { date: d.date || date, usd: d.usd }; } catch {} }
  return null;
}
async function fx() {
  const today = new Date();
  const dates = ['latest', ...Array.from({ length: 31 }, (_, i) => ymd(new Date(today.getTime() - (i + 1) * 864e5)))];
  const snaps = (await Promise.all(dates.map(fxDay))).filter(Boolean);
  if (!snaps.length) throw new Error('no fx data');
  const byDate = new Map(); snaps.forEach((s) => byDate.set(s.date, s.usd));
  const series = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-31);
  const out = FX.map((c) => {
    const pts = series.map(([date, usd]) => ({ date, rate: usd[c.code] })).filter((p) => typeof p.rate === 'number');
    if (!pts.length) return { ...c, available: false };
    const rates = pts.map((p) => p.rate); const now = rates[rates.length - 1];
    const ago = (n) => { const target = new Date(new Date(pts[pts.length - 1].date).getTime() - n * 864e5).toISOString().slice(0, 10); const p = [...pts].reverse().find((x) => x.date <= target) || pts[0]; return p.rate; };
    const min = Math.min(...rates), max = Math.max(...rates), avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    // least-squares trend in rate units per day
    const n = rates.length, xs = rates.map((_, i) => i), mx = (n - 1) / 2;
    const slope = n > 2 ? xs.reduce((s, x, i) => s + (x - mx) * (rates[i] - avg), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0) : 0;
    const spreadPct = (max - min) / avg * 100;
    let score = null, verdict;
    if (c.pegged || spreadPct < 0.15) verdict = c.pegged ? 'Fixed rate: any day is the same.' : 'Very steady this month: timing barely matters.';
    else {
      score = Math.round((now - min) / (max - min) * 100);
      verdict = score >= 70 ? 'Good day to send: the rate is near its 30-day high.' : score >= 35 ? 'Average day: the rate is in the middle of its 30-day range.' : 'Weaker day: the rate is near its 30-day low. If you can wait, it may pick up, but rates are hard to predict.';
    }
    return { code: c.code.toUpperCase(), name: c.name, island: c.island, symbol: c.symbol, pegged: c.pegged || null, available: true,
      rate: now, date: pts[pts.length - 1].date, change7: (now - ago(7)) / ago(7) * 100, change30: (now - pts[0].rate) / pts[0].rate * 100,
      min, max, avg, trendPerWeekPct: slope * 7 / avg * 100, nextWeekIfTrend: now + slope * 7, score, verdict,
      series: pts.map((p) => [p.date, Math.round(p.rate * 10000) / 10000]) };
  });
  return { currencies: out, checked: new Date().toISOString(), source: 'Mid-market reference rates from the open-source currency-api (fawazahmed0), which compiles central bank and market data.' };
}

const FIPS = ['JM', 'HA', 'TD', 'GY', 'BB', 'DR', 'GJ', 'ST', 'VC', 'BF', 'DO', 'AC'];
async function advisories() {
  const rows = await get(`${SUPABASE_URL}/rest/v1/travel_advisories?select=*&order=country.asc`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  const map = Object.fromEntries(rows.map((r) => [r.code, { ...r, from: 'caribny' }]));
  try {
    const feed = await get('https://cadataapi.state.gov/api/TravelAdvisories');
    for (const f of feed || []) {
      const code = (f.Category || [])[0]; if (!FIPS.includes(code)) continue;
      const m = String(f.Title || '').match(/^(.*?)\s*-\s*Level (\d):\s*(.+)$/); if (!m) continue;
      const updated = (f.Updated || f.Published || '').slice(0, 10);
      const cur = map[code];
      if (!cur || !cur.issued_on || updated >= cur.issued_on) map[code] = { code, country: cur?.country || m[1], level: +m[2], level_text: m[3].trim(), url: f.Link, issued_on: updated, source: 'travel.state.gov', confirmed: true, from: 'state.gov feed' };
    }
  } catch {}
  return { countries: Object.values(map).sort((a, b) => a.country.localeCompare(b.country)), checked: new Date().toISOString(), source: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/' };
}

const FEEDS = { hurricanes: [hurricanes, 600], news: [news, 1200], cricket: [cricket, 1800], subway: [subway, 120], nyc: [nyc, 1200], asp: [asp, 3600], weather: [weather, 1800], fx: [fx, 10800], advisories: [advisories, 21600] };

export default async (req) => {
  const url = new URL(req.url);
  const f = url.searchParams.get('f');
  const entry = FEEDS[f];
  if (!entry) return Response.json({ error: 'unknown feed', feeds: Object.keys(FEEDS) }, { status: 404 });
  const [fn, ttl] = entry;
  try {
    const body = await fn(url);
    return Response.json(body, { headers: {
      'Cache-Control': `public, max-age=${Math.min(ttl, 300)}`,
      'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
      'Netlify-Vary': 'query=f|routes',
      'Access-Control-Allow-Origin': '*'
    } });
  } catch (err) {
    return Response.json({ error: 'unavailable', detail: String(err.message || err).slice(0, 200) }, { status: 502, headers: { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'public, s-maxage=60' } });
  }
};

export const config = { path: '/api/live' };
