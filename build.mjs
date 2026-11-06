// CaribNY static site generator.
// Pulls public data from Supabase at build time and writes fully rendered HTML
// (so Google can read every page), with schema.org markup, a sitemap, and
// small client-side scripts for filters and forms.
//
//   npm run build                 -> live data from Supabase
//   DATA_FILE=fixtures/x.json ... -> offline build from a JSON file

import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const SITE = (process.env.SITE_URL || 'https://caribny.com').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wfrxpzbchmbvqkzkfepn.supabase.co';
// Public (anon) key: safe to ship to browsers; row-level security protects the data.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcnhwemJjaG1idnFremtmZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDIzMjAsImV4cCI6MjEwOTM3ODMyMH0.eYvkMWJ0Iqr8Uu11pmFNFp5tmQduBKkSXSaeq_sYjGY';
const OUT = path.resolve('dist');
const NOINDEX = process.env.NOINDEX === '1'; // set on preview sites
const BUILD_DATE = new Date();

// ---------- reference data ----------
const REGIONS = ['Brooklyn', 'Queens', 'Bronx', 'Manhattan', 'Long Island', 'Westchester'];
const REGION_COPY = {
  'Brooklyn': 'Brooklyn is the heart of Caribbean New York: Flatbush, Crown Heights, East Flatbush and Canarsie, with Church, Nostrand and Utica Avenues and the Labor Day parade on Eastern Parkway.',
  'Queens': 'Queens is home to Little Guyana on Liberty Avenue in Richmond Hill, and to large Jamaican, Haitian and Trinidadian communities in Jamaica, Cambria Heights, Laurelton, Rosedale and Queens Village.',
  'Bronx': 'The northeast Bronx, especially Wakefield, Williamsbridge and Eastchester along White Plains Road, is one of the biggest Jamaican communities outside Jamaica.',
  'Manhattan': 'Manhattan has Harlem and Sugar Hill favorites, the island consulates in Midtown, and newer Caribbean restaurants downtown.',
  'Long Island': 'On Long Island, Caribbean families have built communities in Elmont, Uniondale, Hempstead, Freeport and further east in Huntington and Patchogue.',
  'Westchester': 'In Westchester, Mount Vernon and New Rochelle have long-established Jamaican and West Indian communities, with Caribbean takeouts and bakeries downtown and along North Avenue.'
};
const CATEGORY_COPY = {
  'restaurants': 'From jerk chicken and oxtail to roti, doubles, griot and cou-cou: Caribbean restaurants and takeout spots.',
  'catering': 'Patties, coco bread, hard dough bread, black cake and rum cake: Caribbean bakeries and caterers for every celebration.',
  'groceries': 'Ground provisions, callaloo, scotch bonnet, Grace and Matouk\'s products: Caribbean groceries and markets.',
  'beauty': 'Braiders, barbers, loc specialists and salons serving Caribbean New Yorkers.',
  'shipping': 'Barrels and boxes home for Christmas, back to school or family needs: shipping companies serving Jamaica, Trinidad, Guyana, Haiti and the wider Caribbean.',
  'money-transfer': 'Sending money home: Caribbean-focused remittance and money transfer services.',
  'travel': 'Flights home, family reunions and carnival trips: travel agents who know the islands.',
  'tax-accounting': 'Tax preparation and accounting from people who understand Caribbean families and businesses.',
  'churches': 'Caribbean congregations and places of worship.',
  'music-events': 'Steel pan, sound systems, DJs, mas bands and event services.',
  'health': 'Doctors, wellness and health services serving the Caribbean community.',
  'community': 'Island consulates, cultural groups and community organizations.',
  'other': 'Other Caribbean-owned shops and services.'
};
const ISLANDS = {
  'jamaica': 'Jamaican', 'trinidad-tobago': 'Trinidadian', 'guyana': 'Guyanese', 'haiti': 'Haitian',
  'barbados': 'Bajan', 'grenada': 'Grenadian', 'st-vincent': 'Vincentian', 'st-lucia': 'St. Lucian',
  'dominica': 'Dominican (Dominica)', 'antigua': 'Antiguan', 'bahamas': 'Bahamian', 'belize': 'Belizean',
  'suriname': 'Surinamese', 'puerto-rico': 'Puerto Rican', 'dominican-republic': 'Dominican', 'cuba': 'Cuban'
};
const ISLAND_NAMES = {
  'jamaica': 'Jamaica', 'trinidad-tobago': 'Trinidad & Tobago', 'guyana': 'Guyana', 'haiti': 'Haiti',
  'barbados': 'Barbados', 'grenada': 'Grenada', 'st-vincent': 'St. Vincent & the Grenadines', 'st-lucia': 'St. Lucia',
  'dominica': 'Dominica', 'antigua': 'Antigua & Barbuda', 'bahamas': 'The Bahamas', 'belize': 'Belize',
  'suriname': 'Suriname', 'puerto-rico': 'Puerto Rico', 'dominican-republic': 'Dominican Republic', 'cuba': 'Cuba'
};
const SCHEMA_TYPE = {
  'restaurants': 'Restaurant', 'catering': 'Bakery', 'groceries': 'GroceryStore', 'beauty': 'BeautySalon',
  'travel': 'TravelAgency', 'tax-accounting': 'AccountingService', 'churches': 'Church', 'health': 'MedicalBusiness',
  'money-transfer': 'FinancialService'
};
const CTA = {
  ettrickcampbell: { label: 'Talk to Attorney Ettrick M. Campbell', sub: 'Medicaid planning, immigration and divorce · Brooklyn · (718) 675-6729', url: 'https://easylegalfiling.com/attorney/ettrick-campbell', advertising: true },
  easydivorcefiling: { label: 'Start your NY divorce papers', sub: 'Attorney-designed, court-ready documents', url: 'https://easydivorcefiling.com', advertising: true },
  easyimmigrationfiling: { label: 'Get help with your immigration filing', sub: 'Attorney-designed immigration forms', url: 'https://easyimmigrationfiling.com', advertising: true }
};
const GUIDE_TOPICS = { medicaid: 'Medicaid & home care', immigration: 'Immigration', divorce: 'Family & divorce', community: 'Community' };
const MEDICAID_RE = /medicaid|home care|cdpap|mltc|power of attorney|personal care agreement/i;
const CARNIVAL_RE = /soca|fete|carnival|mas\b|j'?ouvert|jouvay|panorama|steel ?pan|calypso|dimanche/i;

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const regionSlug = (r) => slugify(r);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const listJoin = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
const tz = 'America/New_York';
const fmtDate = (d, opts) => new Date(d).toLocaleString('en-US', { timeZone: tz, ...opts });
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const mapsQuery = (b) => [b.name, b.address || b.neighborhood, b.city || b.region, 'NY'].filter(Boolean).join(', ');
const telHref = (p) => 'tel:+1' + String(p).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

async function fetchTable(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function loadData() {
  if (process.env.DATA_FILE) return JSON.parse(await fs.readFile(process.env.DATA_FILE, 'utf8'));
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const [businesses, categories, events, guides] = await Promise.all([
    fetchTable('businesses', 'select=*&order=name.asc'),
    fetchTable('categories', 'select=*&order=sort_order.asc'),
    fetchTable('events', `select=*&status=eq.published&starts_at=gte.${since}&order=starts_at.asc`),
    fetchTable('guides', 'select=*&status=eq.published&order=sort_order.asc')
  ]);
  return { businesses, categories, events, guides };
}

async function write(rel, html) {
  const file = path.join(OUT, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

// ---------- layout ----------
function layout({ title, description, canonical, body, schema = [], noindex = false, ogType = 'website' }) {
  const url = SITE + canonical;
  const robots = (NOINDEX || noindex) ? '<meta name="robots" content="noindex,follow">' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
${robots}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="CaribNY">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0f3d2e">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/site.css">
${schema.map(jsonld).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="/">Carib<span>NY</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/directory/">Directory</a>
      <a href="/events/">Events</a>
      <a href="/carnival/">Carnival</a>
      <a href="/guides/">Guides</a>
      <a class="nav-cta" href="/recommend/">Add a business</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo" href="/">Carib<span>NY</span></a>
      <p>The Caribbean community guide to New York: trusted businesses, events and plain-language guides for Brooklyn, Queens, the Bronx, Manhattan, Long Island and Westchester.</p>
    </div>
    <div>
      <h2 class="h-small">Areas</h2>
      <ul class="plain">${REGIONS.map((r) => `<li><a href="/${regionSlug(r)}/">${esc(r)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="h-small">CaribNY</h2>
      <ul class="plain">
        <li><a href="/recommend/">Recommend a business</a></li>
        <li><a href="/events/#submit">Submit an event</a></li>
        <li><a href="/about/">About &amp; how we verify</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap fine">© ${BUILD_DATE.getFullYear()} CaribNY. Listings are provided for information; always confirm hours before you go.</div>
</footer>
<script>window.CARIBNY={url:${JSON.stringify(SUPABASE_URL)},key:${JSON.stringify(SUPABASE_ANON_KEY)}};</script>
<script src="/assets/app.js" defer></script>
</body>
</html>`;
}

const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map((c, i) => i === items.length - 1 ? `<span>${esc(c.name)}</span>` : `<a href="${c.path}">${esc(c.name)}</a>`).join(' <span aria-hidden="true">›</span> ')}</nav>`;
const crumbSchema = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path }))
});

const subscribeBox = (source) => `
<section class="subscribe card" aria-labelledby="sub-h">
  <h2 id="sub-h">What's on this weekend, every Thursday</h2>
  <p>Caribbean events, new businesses and useful guides for New York. Free, one email a week.</p>
  <form class="js-form" data-table="subscribers" data-source="${esc(source)}">
    <label class="sr" for="sub-email">Email</label>
    <input id="sub-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
    <input type="hidden" name="consent_text" value="I agree to receive the CaribNY weekly email and can unsubscribe at any time.">
    <button type="submit">Subscribe</button>
    <p class="form-msg" role="status"></p>
  </form>
</section>`;

// ---------- cards ----------
function badge(b) {
  if (b.verified_at) return '<span class="badge verified" title="Owner confirmed this listing">✓ Verified</span>';
  if (b.status === 'claimed') return '<span class="badge claimed">Owner-managed</span>';
  return '';
}
function businessCard(b, cat) {
  const islands = (b.islands || []).map((i) => ISLANDS[i]).filter(Boolean);
  const data = `data-region="${esc(b.region || '')}" data-cat="${esc(cat?.slug || '')}" data-islands="${esc((b.islands || []).join(' '))}" data-verified="${b.verified_at ? 1 : 0}" data-text="${esc([b.name, b.neighborhood, b.description, cat?.name, ...islands].join(' ').toLowerCase())}"`;
  return `<li class="biz-card" ${data}>
  <a class="biz-link" href="/business/${esc(b.slug)}/">
    <h3>${esc(b.name)} ${badge(b)}</h3>
    <p class="meta">${esc(cat?.name || '')}${b.neighborhood ? ' · ' + esc(b.neighborhood) : ''}${b.region && b.region !== b.neighborhood ? ', ' + esc(b.region) : ''}</p>
    ${b.description ? `<p>${esc(b.description)}</p>` : ''}
    ${islands.length ? `<p class="tags">${islands.map((i) => `<span class="tag">${esc(i)}</span>`).join('')}</p>` : ''}
  </a>
</li>`;
}
function eventCard(e) {
  const when = e.time_tba ? fmtDate(e.starts_at, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · time TBA'
    : fmtDate(e.starts_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `<li class="event-card">
  <time datetime="${esc(new Date(e.starts_at).toISOString())}"><span class="ev-m">${fmtDate(e.starts_at, { month: 'short' })}</span><span class="ev-d">${fmtDate(e.starts_at, { day: 'numeric' })}</span></time>
  <div>
    <h3>${e.url ? `<a href="${esc(e.url)}" rel="noopener" target="_blank" data-track="event">${esc(e.title)}</a>` : esc(e.title)}</h3>
    <p class="meta">${esc(when)}${e.venue ? ' · ' + esc(e.venue) : ''}${(e.neighborhood || e.region) && (e.neighborhood || e.region) !== e.venue ? ' · ' + esc(e.neighborhood || e.region) : ''}${e.is_free ? ' · <strong>Free</strong>' : ''}</p>
    ${e.description ? `<p>${esc(e.description)}</p>` : ''}
  </div>
</li>`;
}
function eventSchema(e) {
  return {
    '@context': 'https://schema.org', '@type': 'Event', name: e.title,
    startDate: new Date(e.starts_at).toISOString(), ...(e.ends_at ? { endDate: new Date(e.ends_at).toISOString() } : {}),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.venue || e.neighborhood || e.region || 'New York',
      address: { '@type': 'PostalAddress', addressLocality: e.neighborhood || e.region || 'New York', addressRegion: 'NY', addressCountry: 'US' } },
    ...(e.description ? { description: e.description } : {}), ...(e.url ? { url: e.url } : {}),
    ...(e.is_free != null ? { isAccessibleForFree: !!e.is_free } : {})
  };
}

// ---------- pages ----------
async function build() {
  const data = await loadData();
  const cats = data.categories;
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));
  const biz = data.businesses.filter((b) => b.status !== 'hidden');
  const events = data.events.filter((e) => new Date(e.ends_at || e.starts_at) >= new Date(Date.now() - 6 * 3600 * 1000));
  const guides = data.guides.map((g) => ({ ...g, topicKey: g.topic === 'medicaid' || MEDICAID_RE.test(g.title) ? 'medicaid' : g.topic }));
  const sitemap = [];
  const addUrl = (p, prio = 0.6) => sitemap.push({ loc: SITE + p, prio });

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await fs.cp('public', OUT, { recursive: true });

  // --- business pages
  for (const b of biz) {
    const cat = catById[b.category_id];
    const islands = (b.islands || []).filter((i) => ISLANDS[i]);
    const region = b.region || 'New York';
    const crumbItems = [{ name: 'CaribNY', path: '/' }, { name: region, path: `/${regionSlug(region)}/` },
      ...(cat ? [{ name: cat.name, path: `/${regionSlug(region)}/${cat.slug}/` }] : []), { name: b.name, path: `/business/${b.slug}/` }];
    const lb = {
      '@context': 'https://schema.org', '@type': SCHEMA_TYPE[cat?.slug] || 'LocalBusiness', '@id': `${SITE}/business/${b.slug}/#business`,
      name: b.name, url: `${SITE}/business/${b.slug}/`, ...(b.description ? { description: b.description } : {}),
      ...(b.phone ? { telephone: '+1-' + String(b.phone).replace(/\D/g, '').slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') } : {}),
      address: { '@type': 'PostalAddress', ...(b.address ? { streetAddress: b.address } : {}), addressLocality: b.city || region, addressRegion: 'NY', addressCountry: 'US' },
      ...(b.website ? { sameAs: [b.website] } : {}), ...(b.photo_urls?.length ? { image: b.photo_urls } : {}),
      ...(cat?.slug === 'restaurants' || cat?.slug === 'catering' ? { servesCuisine: islands.length ? islands.map((i) => ISLANDS[i]) : ['Caribbean'] } : {}),
      areaServed: b.neighborhood || region
    };
    const others = biz.filter((o) => o.id !== b.id && o.region === b.region && o.category_id === b.category_id).slice(0, 4);
    const hasLocation = !!(b.address || (b.neighborhood && b.neighborhood !== region));
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
<article class="biz">
  <h1>${esc(b.name)} ${badge(b)}</h1>
  <p class="meta big">${esc(cat?.name || '')}${b.neighborhood ? ' in ' + esc(b.neighborhood) : ''}${b.region && b.region !== b.neighborhood ? ', ' + esc(b.region) : ''}</p>
  ${islands.length ? `<p class="tags">${islands.map((i) => `<a class="tag" href="/island/${i}/">${esc(ISLANDS[i])}</a>`).join('')}</p>` : ''}
  ${b.photo_urls?.length ? `<img class="biz-photo" src="${esc(b.photo_urls[0])}" alt="${esc(b.name)}" loading="lazy">` : ''}
  ${b.description ? `<p class="lede">${esc(b.description)}</p>` : ''}
  <dl class="facts">
    ${b.address ? `<dt>Address</dt><dd>${esc(b.address)}</dd>` : ''}
    ${b.phone ? `<dt>Phone</dt><dd><a href="${telHref(b.phone)}" data-track="call" data-biz="${b.id}">${esc(b.phone)}</a></dd>` : ''}
    ${b.website ? `<dt>Website</dt><dd><a href="${esc(b.website)}" rel="noopener" target="_blank" data-track="website" data-biz="${b.id}">${esc(b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd>` : ''}
    ${b.whatsapp ? `<dt>WhatsApp</dt><dd><a href="https://wa.me/${esc(String(b.whatsapp).replace(/\D/g, ''))}" rel="noopener" target="_blank" data-track="whatsapp" data-biz="${b.id}">${esc(b.whatsapp)}</a></dd>` : ''}
    ${b.hours ? `<dt>Hours</dt><dd>${esc(b.hours)}</dd>` : ''}
  </dl>
  <p class="actions">
    <a class="btn" href="${esc(b.google_maps_url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapsQuery(b)))}" rel="noopener" target="_blank" data-track="directions" data-biz="${b.id}">Directions</a>
    ${b.phone ? `<a class="btn ghost" href="${telHref(b.phone)}" data-track="call" data-biz="${b.id}">Call</a>` : ''}
  </p>
  ${hasLocation ? `<div class="map"><iframe title="Map of ${esc(b.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(mapsQuery(b))}&output=embed"></iframe></div>` : ''}
  ${b.verified_at ? `<p class="note">✓ <strong>Verified:</strong> the owner claimed this listing and CaribNY confirmed their contact details on ${fmtDate(b.verified_at, { month: 'long', day: 'numeric', year: 'numeric' })}. <a href="/about/#verified">How we verify</a></p>` : ''}
</article>

${b.status === 'unclaimed' ? `<details class="card claim" id="claim">
  <summary><strong>Is this your business?</strong> Claim it free and get the ✓ Verified badge.</summary>
  <form class="js-form" data-table="claim_requests">
    <input type="hidden" name="business_id" value="${b.id}">
    <label>Your name<input name="claimant_name" required minlength="2" maxlength="120" autocomplete="name"></label>
    <label>Email<input name="claimant_email" type="email" required autocomplete="email"></label>
    <label>Phone<input name="claimant_phone" type="tel" autocomplete="tel"></label>
    <label>Your role<select name="role"><option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff</option></select></label>
    <label>Anything to add or fix? (website, hours, photos)<textarea name="message" maxlength="2000" rows="3"></textarea></label>
    <button type="submit">Send claim</button>
    <p class="form-msg" role="status"></p>
  </form>
</details>` : ''}

<details class="card report">
  <summary>Something wrong with this listing?</summary>
  <form class="js-form" data-table="reports">
    <input type="hidden" name="business_id" value="${b.id}">
    <input type="hidden" name="page_path" value="/business/${esc(b.slug)}/">
    <label>What's wrong?<select name="reason">
      <option value="wrong_info">Wrong information</option><option value="closed">It has closed</option>
      <option value="remove_my_business">Remove my business</option><option value="spam_or_scam">Spam or scam</option><option value="other">Other</option></select></label>
    <label>Details<textarea name="details" maxlength="2000" rows="3"></textarea></label>
    <label>Your email (optional)<input name="contact_email" type="email"></label>
    <button type="submit">Send report</button>
    <p class="form-msg" role="status"></p>
  </form>
</details>

${others.length ? `<section><h2>More ${esc(cat?.name.toLowerCase() || 'places')} in ${esc(region)}</h2><ul class="biz-list">${others.map((o) => businessCard(o, cat)).join('')}</ul>
<p><a href="/${regionSlug(region)}/${cat.slug}/">See all ${esc(cat.name.toLowerCase())} in ${esc(region)} →</a></p></section>` : ''}
</div>`;
    const descParts = [b.description, b.neighborhood && `${cat?.name || 'Caribbean business'} in ${b.neighborhood}, ${region}.`, b.phone && `Call ${b.phone}.`].filter(Boolean);
    await write(`business/${b.slug}/index.html`, layout({
      title: `${b.name} · ${b.neighborhood || region} | CaribNY`, description: descParts.join(' ').slice(0, 300),
      canonical: `/business/${b.slug}/`, body, schema: [lb, crumbSchema(crumbItems)]
    }));
    addUrl(`/business/${b.slug}/`, 0.7);
  }

  // --- region and region x category pages
  for (const region of REGIONS) {
    const inRegion = biz.filter((b) => b.region === region);
    if (!inRegion.length) continue;
    const rs = regionSlug(region);
    const byCat = cats.map((c) => ({ c, list: inRegion.filter((b) => b.category_id === c.id) })).filter((x) => x.list.length);
    for (const { c, list } of byCat) {
      const hoods = [...new Set(list.map((b) => b.neighborhood).filter((n) => n && n !== region))];
      const islandCounts = {};
      list.forEach((b) => (b.islands || []).forEach((i) => { islandCounts[i] = (islandCounts[i] || 0) + 1; }));
      const topIslands = Object.entries(islandCounts).sort((a, b) => b[1] - a[1]).map(([i]) => ISLANDS[i]).filter(Boolean).slice(0, 3);
      const crumbItems = [{ name: 'CaribNY', path: '/' }, { name: region, path: `/${rs}/` }, { name: c.name, path: `/${rs}/${c.slug}/` }];
      const title = `Caribbean ${c.name} in ${region}`;
      const intro = `${plural(list.length, 'Caribbean ' + c.name.toLowerCase().replace(/s$/, '') + ' listing', 'Caribbean ' + c.name.toLowerCase() + ' listings')} in ${region}${hoods.length ? `, in ${listJoin(hoods.slice(0, 5))}${hoods.length > 5 ? ' and more' : ''}` : ''}.${topIslands.length ? ` Includes ${listJoin(topIslands)} spots.` : ''} ${list.filter((b) => b.verified_at).length ? `${list.filter((b) => b.verified_at).length} verified by the owner.` : ''}`;
      const body = `<div class="wrap">
${crumbs(crumbItems)}
<h1>${esc(title)}</h1>
<p class="lede">${esc(intro)}</p>
<p>${esc(CATEGORY_COPY[c.slug] || '')} ${esc(REGION_COPY[region] || '')}</p>
<ul class="biz-list">${list.sort((a, b) => (!!b.verified_at - !!a.verified_at) || a.name.localeCompare(b.name)).map((b) => businessCard(b, c)).join('')}</ul>
<p class="muted">Know a Caribbean ${esc(c.name.toLowerCase())} in ${esc(region)} we're missing? <a href="/recommend/">Recommend it</a>.</p>
<h2>Other Caribbean businesses in ${esc(region)}</h2>
<p class="chips">${byCat.filter((x) => x.c.id !== c.id).map((x) => `<a class="chip" href="/${rs}/${x.c.slug}/">${esc(x.c.name)} (${x.list.length})</a>`).join('')}</p>
</div>`;
      const thin = list.length < 2;
      await write(`${rs}/${c.slug}/index.html`, layout({
        title: `${title} | CaribNY`, description: intro.slice(0, 300), canonical: `/${rs}/${c.slug}/`, body, noindex: thin,
        schema: [crumbSchema(crumbItems), { '@context': 'https://schema.org', '@type': 'ItemList', name: title,
          itemListElement: list.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/business/${b.slug}/`, name: b.name })) }]
      }));
      if (!thin) addUrl(`/${rs}/${c.slug}/`, 0.8);
    }
    const regionEvents = events.filter((e) => e.region === region).slice(0, 6);
    const crumbItems = [{ name: 'CaribNY', path: '/' }, { name: region, path: `/${rs}/` }];
    const body = `<div class="wrap">
${crumbs(crumbItems)}
<h1>Caribbean ${esc(region)}</h1>
<p class="lede">${esc(REGION_COPY[region])}</p>
<p class="chips">${byCat.map((x) => `<a class="chip" href="/${rs}/${x.c.slug}/">${esc(x.c.name)} (${x.list.length})</a>`).join('')}</p>
${regionEvents.length ? `<h2>Coming up in ${esc(region)}</h2><ul class="event-list">${regionEvents.map(eventCard).join('')}</ul><p><a href="/events/">All events →</a></p>` : ''}
${byCat.map((x) => `<h2><a href="/${rs}/${x.c.slug}/">${esc(x.c.name)}</a></h2><ul class="biz-list">${x.list.slice(0, 6).map((b) => businessCard(b, x.c)).join('')}</ul>${x.list.length > 6 ? `<p><a href="/${rs}/${x.c.slug}/">All ${x.list.length} →</a></p>` : ''}`).join('\n')}
</div>`;
    await write(`${rs}/index.html`, layout({
      title: `Caribbean ${region}: businesses, food & events | CaribNY`, description: `${plural(inRegion.length, 'Caribbean business', 'Caribbean businesses')} in ${region}. ${REGION_COPY[region]}`.slice(0, 300),
      canonical: `/${rs}/`, body, schema: [crumbSchema(crumbItems)]
    }));
    addUrl(`/${rs}/`, 0.9);
  }

  // --- island pages
  const islandKeys = [...new Set(biz.flatMap((b) => b.islands || []))].filter((i) => ISLANDS[i]);
  for (const key of islandKeys) {
    const list = biz.filter((b) => (b.islands || []).includes(key));
    const regs = [...new Set(list.map((b) => b.region))];
    const crumbItems = [{ name: 'CaribNY', path: '/' }, { name: 'Directory', path: '/directory/' }, { name: ISLANDS[key], path: `/island/${key}/` }];
    const title = `${ISLANDS[key]} businesses and food in New York`;
    const body = `<div class="wrap">
${crumbs(crumbItems)}
<h1>${esc(title)}</h1>
<p class="lede">${esc(`${plural(list.length, ISLANDS[key] + ' listing', ISLANDS[key] + ' listings')} across ${listJoin(regs)}, from restaurants and bakeries to shipping and community services for people from ${ISLAND_NAMES[key]}.`)}</p>
${regs.map((r) => `<h2>${esc(r)}</h2><ul class="biz-list">${list.filter((b) => b.region === r).map((b) => businessCard(b, catById[b.category_id])).join('')}</ul>`).join('')}
</div>`;
    await write(`island/${key}/index.html`, layout({
      title: `${title} | CaribNY`, description: `Find ${ISLANDS[key]} restaurants, bakeries and services in ${listJoin(regs)}.`, canonical: `/island/${key}/`, body,
      noindex: list.length < 2, schema: [crumbSchema(crumbItems)]
    }));
    if (list.length >= 2) addUrl(`/island/${key}/`, 0.8);
  }

  // --- directory with client-side filters
  {
    const regionOpts = REGIONS.filter((r) => biz.some((b) => b.region === r));
    const catOpts = cats.filter((c) => biz.some((b) => b.category_id === c.id));
    const body = `<div class="wrap">
<h1>Caribbean business directory for New York</h1>
<p class="lede">${biz.length} Caribbean businesses across ${regionOpts.length} areas. Filter by area, type or island.</p>
<form class="filters" id="filters" role="search" onsubmit="return false">
  <label class="grow"><span class="sr">Search</span><input id="f-q" type="search" placeholder="Search: roti, barrels, oxtail, Flatbush…"></label>
  <label><span class="sr">Area</span><select id="f-region"><option value="">All areas</option>${regionOpts.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
  <label><span class="sr">Type</span><select id="f-cat"><option value="">All types</option>${catOpts.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></label>
  <label><span class="sr">Island</span><select id="f-island"><option value="">All islands</option>${islandKeys.map((i) => `<option value="${i}">${esc(ISLAND_NAMES[i])}</option>`).join('')}</select></label>
  <label class="check"><input id="f-verified" type="checkbox"> Verified only</label>
</form>
<p class="muted" id="f-count" aria-live="polite"></p>
<ul class="biz-list" id="biz-list">${biz.map((b) => businessCard(b, catById[b.category_id])).join('')}</ul>
<p class="muted">Missing a business? <a href="/recommend/">Recommend it</a> and we'll add it.</p>
</div>`;
    await write('directory/index.html', layout({
      title: 'Caribbean Business Directory: New York | CaribNY',
      description: `Find ${biz.length} Caribbean restaurants, bakeries, barrel shippers, salons, churches and services in Brooklyn, Queens, the Bronx, Manhattan, Long Island and Westchester.`,
      canonical: '/directory/', body
    }));
    addUrl('/directory/', 0.9);
  }

  // --- events
  {
    const groups = {};
    events.forEach((e) => { const k = fmtDate(e.starts_at, { month: 'long', year: 'numeric' }); (groups[k] ||= []).push(e); });
    const body = `<div class="wrap">
<h1>Caribbean events in New York</h1>
<p class="lede">Fetes, concerts, independence celebrations, health fairs and community events across the five boroughs, Long Island and Westchester. Updated ${fmtDate(BUILD_DATE, { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
${events.length ? Object.entries(groups).map(([k, list]) => `<h2>${esc(k)}</h2><ul class="event-list">${list.map(eventCard).join('')}</ul>`).join('') : '<p>No upcoming events listed yet. Know of one? Submit it below.</p>'}
<section class="card" id="submit">
  <h2>Submit an event</h2>
  <p>Organizers: tell us about your event and we'll review it within a day or two.</p>
  <form class="js-form" data-table="event_submissions">
    <label>Event name<input name="title" required minlength="3" maxlength="140"></label>
    <label>Date and start time<input name="starts_at" type="datetime-local" required></label>
    <label>Venue<input name="venue" required minlength="2" maxlength="200"></label>
    <label>Area<select name="region" required>${[...REGIONS, 'Staten Island', 'Online'].map((r) => `<option>${r}</option>`).join('')}</select></label>
    <label>Ticket or info link<input name="url" type="url" maxlength="500"></label>
    <label class="check"><input name="is_free" type="checkbox" value="true"> Free event</label>
    <label>Short description<textarea name="description" maxlength="1000" rows="3"></textarea></label>
    <label>Your name or organization<input name="organizer_name" required minlength="2" maxlength="120"></label>
    <label>Email or phone (not published)<input name="organizer_contact" required minlength="5" maxlength="160"></label>
    <button type="submit">Submit event</button>
    <p class="form-msg" role="status"></p>
  </form>
</section>
${subscribeBox('events')}
</div>`;
    await write('events/index.html', layout({
      title: 'Caribbean Events in New York This Month | CaribNY',
      description: `Upcoming Caribbean events in NYC, Long Island and Westchester: soca and reggae parties, concerts, independence celebrations and community events.`,
      canonical: '/events/', body, schema: events.map(eventSchema)
    }));
    addUrl('/events/', 0.9);
  }

  // --- carnival hub
  {
    const carnivalEvents = events.filter((e) => CARNIVAL_RE.test(`${e.title} ${e.description || ''}`));
    const bands = biz.filter((b) => catById[b.category_id]?.slug === 'music-events');
    const body = `<div class="wrap narrow">
<h1>New York Caribbean Carnival guide</h1>
<p class="lede">Everything for Labor Day carnival in Brooklyn, all year round: the fete calendar, the parade, J'ouvert, Panorama, mas bands and how to enjoy it safely.</p>
<div class="card highlight">
  <h2>Labor Day 2027: Monday, September 6</h2>
  <p>The West Indian American Day Carnival parade takes over <strong>Eastern Parkway in Crown Heights</strong> on Labor Day. <strong>J'ouvert</strong> starts in the early morning hours before the parade. Official 2027 times and routes are set by the West Indian American Day Carnival Association (WIADCA). We'll post them here as soon as they're announced.</p>
</div>
<h2>The carnival weekend, traditionally</h2>
<ul>
  <li><strong>Junior Carnival:</strong> the children's parade and costume competition, held the weekend before Labor Day.</li>
  <li><strong>Panorama:</strong> the steel band competition, traditionally on the Saturday before Labor Day near the Brooklyn Museum.</li>
  <li><strong>Dimanche Gras:</strong> the Sunday-night show of calypso, kings and queens of the bands.</li>
  <li><strong>J'ouvert:</strong> pre-dawn Monday, with paint, powder, mud, steel pan and jab jab.</li>
  <li><strong>The parade:</strong> Labor Day afternoon, with mas bands and trucks along Eastern Parkway toward Grand Army Plaza.</li>
</ul>
<p class="muted">Exact dates and locations change from year to year. Always confirm with <a href="https://wiadcacarnival.org/" rel="noopener" target="_blank">WIADCA</a>.</p>
<h2>Fetes and soca events coming up</h2>
${carnivalEvents.length ? `<ul class="event-list">${carnivalEvents.map(eventCard).join('')}</ul>` : '<p>No fetes listed right now.</p>'}
<p><a href="/events/">Full events calendar →</a> · <a href="/events/#submit">Promoters: add your fete</a></p>
<h2>Mas bands, steel bands and sound systems</h2>
${bands.length ? `<ul class="biz-list">${bands.map((b) => businessCard(b, catById[b.category_id])).join('')}</ul>` : ''}
<p>Run a mas band, steel orchestra or mas camp? <a href="/recommend/">Add it to the directory</a> so revelers can find you before registration opens.</p>
<h2>J'ouvert and parade safety tips</h2>
<ul>
  <li>Go with a group and agree on a meeting spot. Phone service gets weak in the crowd.</li>
  <li>Expect security checkpoints. Leave glass bottles and anything you'd hate to lose at home.</li>
  <li>Bring water, sunscreen, a small amount of cash and a charged phone.</li>
  <li>Wear old clothes and closed shoes for J'ouvert. Paint and mud don't come out.</li>
  <li>Check MTA service changes before you travel. Some stations along the route may be closed or busy.</li>
</ul>
${subscribeBox('carnival')}
</div>`;
    await write('carnival/index.html', layout({
      title: 'NYC Caribbean Carnival 2027 Guide: J\'ouvert, Parade, Panorama & Fetes | CaribNY',
      description: 'Labor Day carnival in Brooklyn: 2027 date, J\'ouvert, Panorama, Junior Carnival, Eastern Parkway parade, fete calendar, mas bands and safety tips.',
      canonical: '/carnival/', body, schema: carnivalEvents.map(eventSchema)
    }));
    addUrl('/carnival/', 0.9);
  }

  // --- guides
  const ctaBox = (key) => {
    const c = CTA[key]; if (!c) return '';
    return `<aside class="cta card">
  ${c.advertising ? '<p class="adv">Attorney Advertising</p>' : ''}
  <p class="cta-h">${esc(c.label)}</p><p>${esc(c.sub)}</p>
  <a class="btn" href="${esc(c.url)}" rel="noopener" target="_blank" data-track="cta-${esc(key)}">Get help →</a>
</aside>`;
  };
  for (const g of guides) {
    const html = marked.parse(g.body_md || '');
    const related = guides.filter((o) => o.slug !== g.slug && o.topicKey === g.topicKey).slice(0, 4);
    const topicName = GUIDE_TOPICS[g.topicKey] || 'Guides';
    const crumbItems = [{ name: 'CaribNY', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: topicName, path: `/guides/#${g.topicKey}` }, { name: g.title, path: `/guides/${g.slug}/` }];
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
<article class="guide">
  <h1>${esc(g.title)}</h1>
  ${g.summary ? `<p class="lede">${esc(g.summary)}</p>` : ''}
  <p class="meta">Updated ${fmtDate(g.updated_at || BUILD_DATE, { month: 'long', day: 'numeric', year: 'numeric' })}${g.cta ? ' · Reviewed by Ettrick M. Campbell, Esq.' : ''}</p>
  <div class="prose">${html}</div>
</article>
${ctaBox(g.cta)}
${related.length ? `<section><h2>Related guides</h2><ul class="guide-list">${related.map((o) => `<li><a href="/guides/${o.slug}/">${esc(o.title)}</a><p>${esc(o.summary || '')}</p></li>`).join('')}</ul></section>` : ''}
${subscribeBox('guide')}
</div>`;
    const article = {
      '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.summary || '',
      dateModified: new Date(g.updated_at || BUILD_DATE).toISOString(), mainEntityOfPage: `${SITE}/guides/${g.slug}/`,
      publisher: { '@type': 'Organization', name: 'CaribNY', url: SITE },
      ...(g.cta ? { reviewedBy: { '@type': 'Person', name: 'Ettrick M. Campbell', honorificSuffix: 'Esq.', url: 'https://easylegalfiling.com/attorney/ettrick-campbell' } } : {})
    };
    await write(`guides/${g.slug}/index.html`, layout({
      title: `${g.title} | CaribNY`, description: g.summary || g.title, canonical: `/guides/${g.slug}/`, body, ogType: 'article',
      schema: [article, crumbSchema(crumbItems)]
    }));
    addUrl(`/guides/${g.slug}/`, 0.8);
  }
  {
    const order = ['medicaid', 'immigration', 'divorce', 'community'];
    const topics = order.filter((t) => guides.some((g) => g.topicKey === t));
    const body = `<div class="wrap narrow">
<h1>Plain-language guides for Caribbean New Yorkers</h1>
<p class="lede">Medicaid and home care for your parents, immigration, family law and everyday life in New York, explained simply.</p>
<p class="chips">${topics.map((t) => `<a class="chip" href="#${t}">${esc(GUIDE_TOPICS[t])}</a>`).join('')}</p>
${topics.map((t) => `<h2 id="${t}">${esc(GUIDE_TOPICS[t])}</h2><ul class="guide-list">${guides.filter((g) => g.topicKey === t).map((g) => `<li><a href="/guides/${g.slug}/">${esc(g.title)}</a><p>${esc(g.summary || '')}</p></li>`).join('')}</ul>`).join('')}
</div>`;
    await write('guides/index.html', layout({
      title: 'Guides: Medicaid Home Care, Immigration & More | CaribNY',
      description: 'Plain-language guides for Caribbean New Yorkers: Medicaid home care and planning, immigration, divorce and community life.',
      canonical: '/guides/', body
    }));
    addUrl('/guides/', 0.8);
  }

  // --- recommend
  {
    const body = `<div class="wrap narrow">
<h1>Recommend a Caribbean business</h1>
<p class="lede">Help us build the most complete Caribbean directory in New York. Owners: listing is free.</p>
<form class="js-form card" data-table="recommendations">
  <label>Business name<input name="business_name" required minlength="2" maxlength="120"></label>
  <label>What kind of business?<select name="category">${cats.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></label>
  <label>Neighborhood or town<input name="neighborhood" placeholder="e.g. Flatbush, Richmond Hill, Mount Vernon"></label>
  <label>Website, Instagram or phone<input name="website_or_social"></label>
  <label>Why do you recommend it?<textarea name="why" maxlength="1000" rows="3"></textarea></label>
  <label>Your email (optional)<input name="recommender_email" type="email"></label>
  <label class="check"><input name="is_owner" type="checkbox" value="true"> I own or manage this business</label>
  <button type="submit">Send recommendation</button>
  <p class="form-msg" role="status"></p>
</form>
</div>`;
    await write('recommend/index.html', layout({ title: 'Recommend a Caribbean Business | CaribNY', description: 'Add a Caribbean-owned or Caribbean-serving business to the CaribNY directory. Free for owners.', canonical: '/recommend/', body }));
    addUrl('/recommend/', 0.4);
  }

  // --- about
  {
    const body = `<div class="wrap narrow prose">
<h1>About CaribNY</h1>
<p>CaribNY is a free community guide for Caribbean New Yorkers and everyone who loves Caribbean food and culture. We cover Brooklyn, Queens, the Bronx, Manhattan, Long Island and Westchester.</p>
<h2 id="verified">How we verify businesses</h2>
<p>Every listing starts from public information. A listing gets the <strong>✓ Verified</strong> badge only when:</p>
<ol><li>the owner or manager claims it, and</li><li>we confirm their phone number or website matches the business.</li></ol>
<p>Owner-managed listings without a confirmed contact show "Owner-managed". You can report wrong information on any listing and we review reports within 2 business days. If you own a business and want it removed, use "Remove my business" on its page.</p>
<h2>Guides</h2>
<p>Our legal and benefits guides are general information, not legal advice. Guides marked "Reviewed by" were reviewed by Ettrick M. Campbell, Esq., a New York attorney (NY Bar #3938966). Links to his practice are attorney advertising.</p>
</div>`;
    await write('about/index.html', layout({ title: 'About CaribNY & How We Verify Businesses', description: 'How CaribNY lists and verifies Caribbean businesses in New York, and who reviews our guides.', canonical: '/about/', body }));
    addUrl('/about/', 0.3);
  }

  // --- home
  {
    const regionsWith = REGIONS.map((r) => ({ r, n: biz.filter((b) => b.region === r).length })).filter((x) => x.n);
    const medicaidGuides = guides.filter((g) => g.topicKey === 'medicaid').slice(0, 4);
    const otherGuides = guides.filter((g) => g.topicKey !== 'medicaid').slice(0, 4);
    const body = `<section class="hero"><div class="wrap">
  <h1>Caribbean New York, in one place</h1>
  <p class="lede">${biz.length} trusted Caribbean businesses, this week's events and plain-language guides, from Flatbush to Richmond Hill to Mount Vernon.</p>
  <form class="hero-search" action="/directory/" method="get" role="search">
    <label class="sr" for="hq">Search the directory</label>
    <input id="hq" name="q" type="search" placeholder="Roti, barrels, black cake, a salon…">
    <button type="submit">Search</button>
  </form>
  <p class="chips">${regionsWith.map((x) => `<a class="chip light" href="/${regionSlug(x.r)}/">${esc(x.r)} (${x.n})</a>`).join('')}</p>
</div></section>
<div class="wrap">
  <section><h2>This week and next</h2>
    ${events.length ? `<ul class="event-list">${events.slice(0, 6).map(eventCard).join('')}</ul>` : '<p>No events listed yet.</p>'}
    <p><a href="/events/">All events →</a> · <a href="/carnival/">Carnival guide →</a></p>
  </section>
  <section><h2>Find by island</h2>
    <p class="chips">${islandKeys.map((i) => `<a class="chip" href="/island/${i}/">${esc(ISLAND_NAMES[i])}</a>`).join('')}</p>
  </section>
  <section><h2>Find by type</h2>
    <p class="chips">${cats.filter((c) => biz.some((b) => b.category_id === c.id)).map((c) => `<a class="chip" href="/directory/?cat=${c.slug}">${esc(c.name)}</a>`).join('')}</p>
  </section>
  ${medicaidGuides.length ? `<section><h2>Caring for a parent at home? Medicaid home care, explained</h2><ul class="guide-list">${medicaidGuides.map((g) => `<li><a href="/guides/${g.slug}/">${esc(g.title)}</a><p>${esc(g.summary || '')}</p></li>`).join('')}</ul><p><a href="/guides/#medicaid">All Medicaid guides →</a></p></section>` : ''}
  ${otherGuides.length ? `<section><h2>More guides</h2><ul class="guide-list">${otherGuides.map((g) => `<li><a href="/guides/${g.slug}/">${esc(g.title)}</a><p>${esc(g.summary || '')}</p></li>`).join('')}</ul></section>` : ''}
  ${subscribeBox('home')}
</div>`;
    await write('index.html', layout({
      title: 'CaribNY: Caribbean community guide to New York',
      description: 'Caribbean businesses, events and plain-language guides for New York: Brooklyn, Queens, the Bronx, Manhattan, Long Island and Westchester.',
      canonical: '/', body,
      schema: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'CaribNY', url: SITE + '/',
        potentialAction: { '@type': 'SearchAction', target: `${SITE}/directory/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }]
    }));
    addUrl('/', 1.0);
  }

  // --- 404, sitemap, robots
  await write('404.html', layout({ title: 'Page not found | CaribNY', description: 'Page not found.', canonical: '/404.html', noindex: true,
    body: `<div class="wrap narrow"><h1>We couldn't find that page</h1><p>Try the <a href="/directory/">directory</a>, <a href="/events/">events</a> or <a href="/guides/">guides</a>.</p></div>` }));
  const today = BUILD_DATE.toISOString().slice(0, 10);
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.prio.toFixed(1)}</priority></url>`).join('\n')}\n</urlset>\n`);
  await write('robots.txt', NOINDEX ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Built ${sitemap.length} indexable pages: ${biz.length} businesses, ${events.length} events, ${guides.length} guides, ${islandKeys.length} islands.`);
}

build().catch((err) => { console.error(err); process.exit(1); });
