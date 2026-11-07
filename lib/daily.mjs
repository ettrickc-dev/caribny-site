// CaribNY "check every day" pages: Back Home Today, hurricanes, commute,
// safety trends, money/exchange, barrel countdown, fare board, notices, link-up.
// Live numbers come from /api/live (netlify/functions/live.mjs) and are drawn by
// /assets/live.js; slow-changing data (crime stats, notices, groups) is rendered here.

export const TOOLS = [
  { path: '/today/', name: 'Back Home Today', blurb: 'Exchange rates, weather back home, travel advisories, headlines and cricket, every morning.' },
  { path: '/hurricanes/', name: 'Hurricane tracker', blurb: 'Active storms from the National Hurricane Center and how far they are from each island.' },
  { path: '/money/', name: 'Send money calculator', blurb: "Today's rate, the 30-day trend and a \"good day to send?\" score." },
  { path: '/commute/', name: 'Commute & parking', blurb: 'Subway alerts for the 2, 3, 4, 5, B and Q, alternate-side parking and NYC weather.' },
  { path: '/barrels/', name: 'Christmas barrel countdown', blurb: 'Days left to ship, from shippers’ published schedules and cutoffs.' },
  { path: '/fares/', name: 'Fare spotted board', blurb: 'Airfares home that readers actually saw, averaged by route.' },
  { path: '/notices/', name: 'Death notices & Nine Nights', blurb: 'Notices, funerals, Nine Nights and thanksgiving services in the community.' },
  { path: '/linkup/', name: 'Link-up board', blurb: 'Island associations, old-school alumni groups, church groups and mentoring.' },
  { path: '/safety/', name: 'Neighborhood safety trends', blurb: 'NYPD data for Caribbean neighborhoods: this year vs. last year and the 5-year average.' }
];

const AIRPORTS = { KIN: 'Kingston (KIN)', MBJ: 'Montego Bay (MBJ)', POS: 'Port of Spain (POS)', GEO: 'Georgetown (GEO)', PAP: 'Port-au-Prince (PAP)', CAP: 'Cap-Haïtien (CAP)', BGI: 'Barbados (BGI)', GND: 'Grenada (GND)', UVF: 'St. Lucia Hewanorra (UVF)', SVD: 'St. Vincent (SVD)', ANU: 'Antigua (ANU)', DOM: 'Dominica (DOM)', SDQ: 'Santo Domingo (SDQ)', STI: 'Santiago DR (STI)', PUJ: 'Punta Cana (PUJ)', NAS: 'Nassau (NAS)', SKB: 'St. Kitts (SKB)', BZE: 'Belize City (BZE)' };
const NOTICE_TYPES = { death: 'Death notice', nine_night: 'Nine Night', funeral: 'Funeral / homegoing', memorial: 'Memorial', thanksgiving: 'Thanksgiving service' };
const GROUP_KINDS = { island_association: 'Island association', alumni: 'Old-school / alumni association', church: 'Church group', mentoring: 'Mentoring', cultural: 'Cultural group', professional: 'Professional network', sports: 'Sports & cricket club', other: 'Other' };
const ISLAND_OPTS = ['Jamaica', 'Trinidad & Tobago', 'Guyana', 'Haiti', 'Barbados', 'Grenada', 'St. Vincent', 'St. Lucia', 'Dominica', 'Antigua', 'St. Kitts & Nevis', 'Montserrat', 'Bahamas', 'Belize', 'Dominican Republic', 'Cuba', 'Puerto Rico', 'Suriname', 'Other'];

export async function buildDaily(ctx) {
  const { write, layout, esc, crumbs, crumbSchema, addUrl, fmtDate, events, biz, catById, data, subscribeBox, eventCard, safety, BUILD_DATE } = ctx;
  const page = async (rel, opts) => { await write(rel, layout({ ...opts, scripts: ['/assets/live.js'] })); addUrl(opts.canonical, opts.prio || 0.8); };
  const toolNav = (current) => `<nav class="toolbar" aria-label="Daily tools">${TOOLS.map((t) => `<a href="${t.path}"${t.path === current ? ' aria-current="page"' : ''}>${esc(t.name)}</a>`).join('')}</nav>`;
  const bc = (name, path) => [{ name: 'CaribNY', path: '/' }, { name: 'Today', path: '/today/' }, ...(path === '/today/' ? [] : [{ name, path }])];
  const updatedLine = (id) => `<p class="muted small live-stamp" data-stamp="${id}">Loading live data…</p>`;
  const noscript = '<noscript><p class="note">This section updates live and needs JavaScript.</p></noscript>';

  // ---------- /today/ ----------
  {
    const soon = events.filter((e) => new Date(e.starts_at) < new Date(BUILD_DATE.getTime() + 4 * 864e5)).slice(0, 5);
    const body = `<div class="wrap">
${crumbs(bc('Back Home Today', '/today/'))}
${toolNav('/today/')}
<h1>Back Home Today</h1>
<p class="lede">Your morning check-in with the islands: exchange rates, weather back home, U.S. travel advisories, Caribbean headlines and West Indies cricket. Refreshed automatically through the day.</p>
<section class="live-grid">
  <div class="card tile" id="t-fx"><h2>Exchange rates</h2><p class="muted small">US$1 buys…</p><div data-feed="fx" data-view="fx-mini">${noscript}</div><p><a href="/money/">Calculator &amp; "good day to send?" →</a></p></div>
  <div class="card tile" id="t-hur"><h2>Hurricane watch</h2><div data-feed="hurricanes" data-view="hur-mini"></div><p><a href="/hurricanes/">Full tracker →</a></p></div>
  <div class="card tile" id="t-wx"><h2>Weather back home</h2><div data-feed="weather" data-view="wx"></div></div>
  <div class="card tile" id="t-adv"><h2>U.S. travel advisories</h2><div data-feed="advisories" data-view="adv"></div></div>
</section>
<section class="card"><h2>Caribbean headlines</h2><div data-feed="news" data-view="news"></div><p class="muted small">Headlines link to each newspaper's own site.</p></section>
<section class="card"><h2>West Indies cricket</h2><div data-feed="cricket" data-view="cricket"></div></section>
${soon.length ? `<section><h2>Happening in the next few days</h2><ul class="event-list">${soon.map(eventCard).join('')}</ul><p><a href="/events/">All events →</a></p></section>` : ''}
<section><h2>More daily tools</h2><ul class="tool-list">${TOOLS.filter((t) => t.path !== '/today/').map((t) => `<li><a href="${t.path}">${esc(t.name)}</a><p>${esc(t.blurb)}</p></li>`).join('')}</ul></section>
${subscribeBox('today')}
</div>`;
    await page('today/index.html', { title: 'Back Home Today: Caribbean exchange rates, weather, advisories & news | CaribNY', description: 'Daily check-in for Caribbean New Yorkers: JMD, TTD, GYD, HTG, BBD and EC$ rates, weather in Kingston, Port of Spain, Georgetown, Port-au-Prince and Bridgetown, U.S. travel advisories, headlines and West Indies cricket.', canonical: '/today/', body, schema: [crumbSchema(bc('Back Home Today', '/today/'))], prio: 0.9 });
  }

  // ---------- /hurricanes/ ----------
  {
    const crumbItems = bc('Hurricane tracker', '/hurricanes/');
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/hurricanes/')}
<h1>Caribbean hurricane tracker</h1>
<p class="lede">Active Atlantic storms from the U.S. National Hurricane Center, with CaribNY's quick math on how far each storm is from home.</p>
${updatedLine('hurricanes')}
<div data-feed="hurricanes" data-view="hur-full">${noscript}</div>
<div class="note"><strong>How our "days away" estimate works:</strong> we take the storm's current position, speed and direction from the latest NHC advisory and measure the straight-line distance to each capital. If the storm is heading roughly toward an island (within 35°), we divide distance by speed. Storms speed up, slow down and turn, so this is a rough guide only. Always follow the <a href="https://www.nhc.noaa.gov/" rel="noopener" target="_blank">National Hurricane Center</a> forecast cone and your island's official met office.</div>
<h2>Official weather services back home</h2>
<ul>
  <li>Jamaica: <a href="https://metservice.gov.jm/" rel="noopener" target="_blank">Meteorological Service of Jamaica</a></li>
  <li>Trinidad &amp; Tobago: <a href="https://www.metoffice.gov.tt/" rel="noopener" target="_blank">Trinidad and Tobago Meteorological Service</a></li>
  <li>Barbados: <a href="https://www.barbadosweather.org/" rel="noopener" target="_blank">Barbados Meteorological Services</a></li>
  <li>Guyana: <a href="https://hydromet.gov.gy/" rel="noopener" target="_blank">Hydrometeorological Service of Guyana</a></li>
  <li>Everywhere: <a href="https://www.nhc.noaa.gov/" rel="noopener" target="_blank">National Hurricane Center</a></li>
</ul>
<h2>Helping family after a storm</h2>
<p>Send money through licensed money transfer services, and give to relief groups you can verify. Be careful with new online fundraisers that appear right after a disaster. Check our <a href="/money/">send-money calculator</a> for today's rates and find <a href="/directory/?cat=money-transfer">money transfer</a> and <a href="/directory/?cat=shipping">shipping</a> businesses in the directory.</p>
<p class="muted small">The Atlantic hurricane season runs June 1 to November 30.</p>
</div>`;
    await page('hurricanes/index.html', { title: 'Caribbean Hurricane Tracker: Storms Near Jamaica, Haiti, Trinidad & More | CaribNY', description: 'Live Atlantic storm tracker for Caribbean New Yorkers, from the National Hurricane Center, with distance and time estimates to Jamaica, Haiti, Trinidad, Guyana, Barbados and the Eastern Caribbean.', canonical: '/hurricanes/', body, schema: [crumbSchema(crumbItems)], prio: 0.9 });
  }

  // ---------- /money/ ----------
  {
    const crumbItems = bc('Send money calculator', '/money/');
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/money/')}
<h1>Sending money home: today's rate</h1>
<p class="lede">See what your US dollars are worth in Jamaican, Trinidad, Guyanese, Haitian, Barbados and Eastern Caribbean dollars today, how that compares with last month, and whether today is a good day to send.</p>
${updatedLine('fx')}
<form class="card calc" id="fx-calc" onsubmit="return false">
  <label>You send (US$)<input id="fx-amt" type="number" min="1" step="1" value="200" inputmode="decimal"></label>
  <label>To<select id="fx-cur"><option value="JMD">Jamaica (JMD)</option><option value="TTD">Trinidad &amp; Tobago (TTD)</option><option value="GYD">Guyana (GYD)</option><option value="HTG">Haiti (HTG)</option><option value="BBD">Barbados (BBD)</option><option value="XCD">Eastern Caribbean (XCD)</option></select></label>
  <div id="fx-out" class="calc-out" aria-live="polite"></div>
</form>
<h2>All currencies, last 30 days</h2>
<div data-feed="fx" data-view="fx-full">${noscript}</div>
<div class="note"><strong>Read this before you send:</strong> these are mid-market reference rates. Money transfer companies and banks pay a lower rate and may add a fee, so the amount your family receives will be less. Compare the rate and fee your provider shows you before you pay. The "good day to send?" score only tells you where today's rate sits in the last 30 days. It is not a forecast, and nobody can predict exchange rates reliably.</div>
<p>Find <a href="/directory/?cat=money-transfer">money transfer services</a> in the directory.</p>
</div>`;
    await page('money/index.html', { title: 'Send Money to Jamaica, Trinidad, Guyana & Haiti: Today’s Rate & Calculator | CaribNY', description: 'Free calculator: US dollar to JMD, TTD, GYD, HTG, BBD and EC$ today, the 30-day trend, and a "good day to send?" score for Caribbean remittances.', canonical: '/money/', body, schema: [crumbSchema(crumbItems)], prio: 0.9 });
  }

  // ---------- /commute/ ----------
  {
    const crumbItems = bc('Commute & parking', '/commute/');
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/commute/')}
<h1>Commute &amp; parking check</h1>
<p class="lede">Before you leave: subway alerts on the lines that serve Caribbean Brooklyn, alternate-side parking for today and tomorrow, and the New York forecast.</p>
<section class="card"><h2>Subway alerts</h2>
  <p class="chips" id="route-picks">${['2', '3', '4', '5', 'B', 'Q', 'A', 'C', 'J', 'E', 'F'].map((r) => `<label class="route-pick"><input type="checkbox" value="${r}"${['2', '3', '4', '5', 'B', 'Q'].includes(r) ? ' checked' : ''}><span class="bullet r${r}">${r}</span></label>`).join('')}</p>
  ${updatedLine('subway')}
  <div data-feed="subway" data-view="subway">${noscript}</div>
  <p class="muted small">From the MTA's live alert feed. Check <a href="https://new.mta.info/alerts" rel="noopener" target="_blank">new.mta.info</a> before late-night or weekend trips.</p>
</section>
<section class="card"><h2>Alternate-side parking</h2><div data-feed="asp" data-view="asp">${noscript}</div><p class="muted small">From NYC DOT's official suspension calendar. Meters may still be in effect; always read the posted signs.</p></section>
<section class="card"><h2>New York weather</h2><div data-feed="nyc" data-view="nyc">${noscript}</div><p class="muted small">Forecast from the National Weather Service, New York office.</p></section>
</div>`;
    await page('commute/index.html', { title: 'Subway Alerts (2, 3, 4, 5, B, Q), Alternate Side Parking & NYC Weather | CaribNY', description: 'Live subway alerts for the lines serving Flatbush, Crown Heights and East Flatbush, today’s alternate-side parking status and the NYC forecast.', canonical: '/commute/', body, schema: [crumbSchema(crumbItems)] });
  }

  // ---------- /safety/ ----------
  {
    const crumbItems = bc('Neighborhood safety trends', '/safety/');
    const pct = (v) => v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;
    const word = (v) => v == null ? '' : v <= -5 ? 'down' : v >= 5 ? 'up' : 'about the same';
    const cls = (v) => v == null ? '' : v <= -5 ? 'down' : v >= 5 ? 'up' : 'flat';
    const spark = (hist) => {
      const vals = hist.map((h) => h[1]); const max = Math.max(...vals, 1), min = Math.min(...vals);
      const pts = vals.map((v, i) => `${(i * 100 / (vals.length - 1)).toFixed(1)},${(28 - (v - min) / ((max - min) || 1) * 24).toFixed(1)}`).join(' ');
      return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="${esc(hist.map((h) => `${h[0]}: ${h[1]}`).join(', '))}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
    };
    let main;
    if (!safety) main = '<p class="note">The NYPD data could not be loaded for this update. It will be back after the next daily refresh. You can also view the data directly on <a href="https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243" rel="noopener" target="_blank">NYC Open Data</a>.</p>';
    else {
      const c = safety.city;
      const boroughs = [...new Set(safety.precincts.map((p) => p.borough))];
      main = `<div class="card highlight"><p><strong>Citywide, ${esc(safety.window)}, ${safety.year}:</strong> ${c.now.toLocaleString('en-US')} major felonies, ${word(c.changeVsLast)} ${c.changeVsLast != null ? `(${pct(c.changeVsLast)})` : ''} from the same period in ${safety.year - 1} and ${pct(c.changeVs5)} compared with the ${safety.year - 5}–${safety.year - 1} average.</p>
<p class="muted small">Data through ${esc(fmtDate(safety.through + 'T12:00:00', { month: 'long', day: 'numeric', year: 'numeric' }))}. The NYPD publishes this data every three months, so the newest months are not in yet.</p></div>
${boroughs.map((b) => `<h2>${esc(b)}</h2>
<div class="table-wrap"><table class="stats">
<thead><tr><th scope="col">Area (precinct)</th><th scope="col">${safety.year} so far</th><th scope="col">vs. ${safety.year - 1}</th><th scope="col">vs. 5-yr avg</th><th scope="col">vs. city trend</th><th scope="col">${safety.year - 5}–${safety.year}</th></tr></thead>
<tbody>${safety.precincts.filter((p) => p.borough === b).map((p) => `<tr>
<th scope="row">${esc(p.area)} <span class="muted small">(${p.pct}th Pct)</span>
<details class="mini"><summary>By crime</summary><ul>${p.offenses.map((o) => `<li>${esc(o.label)}: ${o.now} <span class="${cls(o.change)}">(${o.last} last year)</span></li>`).join('')}</ul></details></th>
<td>${p.now.toLocaleString('en-US')}</td>
<td class="${cls(p.changeVsLast)}">${pct(p.changeVsLast)}</td>
<td class="${cls(p.changeVs5)}">${pct(p.changeVs5)}</td>
<td class="${cls(p.vsCity)}">${p.vsCity == null ? '–' : p.vsCity <= -5 ? 'Better than city' : p.vsCity >= 5 ? 'Worse than city' : 'In line'}</td>
<td class="spark-cell">${spark(p.history)}</td></tr>`).join('')}</tbody></table></div>`).join('\n')}`;
    }
    const body = `<div class="wrap">
${crumbs(crumbItems)}
${toolNav('/safety/')}
<h1>Neighborhood safety trends</h1>
<p class="lede">How major crime is trending in the neighborhoods where Caribbean New Yorkers live, compared with last year, the 5-year average and the city as a whole. This page shows trends and context. It is not a ranking of "safe" or "dangerous" neighborhoods.</p>
${main}
<h2>How to read this</h2>
<ul>
  <li><strong>What's counted:</strong> the seven major felonies the NYPD tracks: murder, rape, robbery, felony assault, burglary, grand larceny and car theft, by the precinct where they were reported.</li>
  <li><strong>Same window every year:</strong> each year is counted from January 1 to the same day, by the date the crime was reported (the way the NYPD's CompStat counts), so the numbers are comparable.</li>
  <li><strong>"vs. city trend":</strong> whether the precinct's change from last year is better or worse than the citywide change, by more than 5 points.</li>
  <li><strong>Counts, not rates:</strong> precincts differ a lot in population and in how many people visit, work or shop there, so compare a precinct with its own past, not with other precincts.</li>
  <li><strong>Limits:</strong> these are complaints recorded by police. Not every crime is reported, and numbers can be revised.</li>
</ul>
<p class="muted small">Source: NYPD Complaint Data, <a href="https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243" rel="noopener" target="_blank">current year</a> and <a href="https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Historic/qgea-i56i" rel="noopener" target="_blank">historic</a>, NYC Open Data. Calculations by CaribNY, updated daily. Westchester and Long Island are served by local police departments and are not included.</p>
</div>`;
    await page('safety/index.html', { title: 'Crime Trends in Flatbush, East Flatbush, Crown Heights, Canarsie, Jamaica Queens & Wakefield | CaribNY', description: 'NYPD major-crime trends for Caribbean neighborhoods in Brooklyn, Queens, the Bronx and Harlem: this year vs. last year, the 5-year average and the citywide trend.', canonical: '/safety/', body, schema: [crumbSchema(crumbItems)] });
  }

  // ---------- /barrels/ ----------
  {
    const crumbItems = bc('Christmas barrel countdown', '/barrels/');
    const cut = (data.shipping_cutoffs || []).filter((s) => s.status === 'published');
    const shippers = biz.filter((b) => catById[b.category_id]?.slug === 'shipping');
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/barrels/')}
<h1>Christmas barrel countdown</h1>
<p class="lede">How many days you have left to get a barrel out of New York before Christmas, worked out from each shipper's own published schedule or cutoff.</p>
<div class="card highlight countdown"><p class="big-num" data-countdown="12-25">–</p><p>days until Christmas</p></div>
<div id="barrel-board" data-cutoffs='${esc(JSON.stringify(cut.map(({ shipper, business_slug, destination, kind, cutoff_date, ends_on, sail_weekday, cutoff_weekday, note, source_url, verified_on }) => ({ shipper, business_slug, destination, kind, cutoff_date, ends_on, sail_weekday, cutoff_weekday, note, source_url, verified_on }))))}'>${noscript}</div>
<div class="note"><strong>Important:</strong> "last sailing before Christmas" means the last ship that leaves before December 25. It does not mean the barrel will be cleared and delivered by Christmas: the trip, port handling and customs clearance take extra time. Ask your shipper for their holiday cutoff, and ship as early as you can. When a shipper publishes a Christmas cutoff, we add it here.</div>
<section class="card" id="submit-cutoff"><h2>Shippers: add your Christmas cutoff</h2>
<p>Send us your published holiday cutoff and a link to where you posted it. We check every submission before it appears.</p>
<form class="js-form" data-table="shipping_cutoffs">
  <input type="hidden" name="kind" value="published_cutoff">
  <label>Shipping company<input name="shipper" required minlength="2" maxlength="120"></label>
  <label>Destination<input name="destination" required maxlength="80" placeholder="e.g. Jamaica (Kingston)"></label>
  <label>Last drop-off date for Christmas delivery<input name="cutoff_date" type="date" required></label>
  <label>Where is it published? (link)<input name="source_url" type="url" required maxlength="300"></label>
  <label>Details<textarea name="note" maxlength="600" rows="2" placeholder="e.g. last sailing Dec 5; pickups must be booked by Nov 28"></textarea></label>
  <label>Your email (not published)<input name="submitter_email" type="email" required></label>
  <button type="submit">Send cutoff</button>
  <p class="form-msg" role="status"></p>
</form></section>
${shippers.length ? `<h2>Barrel shippers in the directory</h2><ul class="biz-list">${shippers.map((b) => `<li class="biz-card"><a class="biz-link" href="/business/${esc(b.slug)}/"><h3>${esc(b.name)}</h3><p class="meta">${esc(b.neighborhood || '')}${b.region && b.region !== b.neighborhood ? ', ' + esc(b.region) : ''}</p></a></li>`).join('')}</ul>` : ''}
<p>Packing tips, what to put in the barrel and customs rules: read <a href="/guides/sending-a-barrel-home-for-christmas/">Sending a barrel home for Christmas</a>.</p>
</div>`;
    await page('barrels/index.html', { title: 'Christmas Barrel Countdown 2026: Last Sailings to Jamaica, Guyana, Trinidad & More | CaribNY', description: 'How many days are left to ship a Christmas barrel from New York to Jamaica, Guyana, Trinidad, Barbados and the Eastern Caribbean, from shippers’ published schedules and cutoffs.', canonical: '/barrels/', body, schema: [crumbSchema(crumbItems)], prio: 0.9 });
  }

  // ---------- /fares/ ----------
  {
    const crumbItems = bc('Fare spotted board', '/fares/');
    const months = []; const d0 = new Date(BUILD_DATE); d0.setDate(1);
    for (let i = 0; i < 13; i++) { const d = new Date(d0.getFullYear(), d0.getMonth() + i, 1); months.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })]); }
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/fares/')}
<h1>Fare spotted: flights home</h1>
<p class="lede">Airfares from New York to the Caribbean that readers actually saw, with averages by route. Spotted a price? Add it in 20 seconds and help everybody time their trip home.</p>
<div id="fare-board" data-airports='${esc(JSON.stringify(AIRPORTS))}'>${noscript}</div>
<section class="card" id="add-fare"><h2>I spotted a fare</h2>
<form class="js-form" data-table="fare_reports" data-after="fares">
  <div class="row2">
    <label>From<select name="origin" required><option>JFK</option><option>EWR</option><option>LGA</option></select></label>
    <label>To<select name="destination" required>${Object.entries(AIRPORTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  </div>
  <div class="row2">
    <label>Price per person (US$)<input name="price_usd" type="number" min="40" max="5000" required inputmode="numeric"></label>
    <label>Trip<select name="trip_type"><option value="round-trip">Round trip</option><option value="one-way">One way</option></select></label>
  </div>
  <div class="row2">
    <label>Travel month<select name="travel_month" required>${months.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
    <label>Airline (optional)<input name="airline" maxlength="40" placeholder="e.g. JetBlue, Caribbean Airlines"></label>
  </div>
  <label>Where you saw it (optional)<input name="where_seen" maxlength="60" placeholder="e.g. airline website, travel agent"></label>
  <button type="submit">Add fare</button>
  <p class="form-msg" role="status"></p>
</form>
<p class="muted small">No names or contact details needed. Prices are what readers report and are not checked against airline systems. Fares change by the hour, so always confirm with the airline or your travel agent.</p></section>
<p>Prefer a person to book it? Find <a href="/directory/?cat=travel">Caribbean travel agents</a> in the directory.</p>
</div>`;
    await page('fares/index.html', { title: 'Cheap Flights NYC to Jamaica, Trinidad, Guyana, Haiti: Fares Readers Spotted | CaribNY', description: 'Community fare board: real prices New Yorkers saw for flights from JFK, Newark and LaGuardia to Kingston, Montego Bay, Port of Spain, Georgetown, Port-au-Prince, Barbados and more.', canonical: '/fares/', body, schema: [crumbSchema(crumbItems)] });
  }

  // ---------- /notices/ ----------
  {
    const crumbItems = bc('Death notices & Nine Nights', '/notices/');
    const all = (data.memorial_notices || []).filter((n) => n.status === 'published');
    const now = BUILD_DATE.getTime();
    const upcoming = all.filter((n) => n.service_at && new Date(n.service_at).getTime() > now - 6 * 3600e3).sort((a, b) => new Date(a.service_at) - new Date(b.service_at));
    const recent = all.filter((n) => !upcoming.includes(n) && new Date(n.created_at).getTime() > now - 120 * 864e5).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const card = (n) => `<li class="notice">
  <p class="notice-type">${esc(NOTICE_TYPES[n.notice_type] || 'Notice')}</p>
  <h3>${esc(n.deceased_name)}${n.age ? `, ${n.age}` : ''}</h3>
  <p class="meta">${[n.hometown, n.island].filter(Boolean).map(esc).join(', ')}${n.ny_area ? ` · of ${esc(n.ny_area)}` : ''}${n.passed_on ? ` · passed ${esc(fmtDate(n.passed_on + 'T12:00:00', { month: 'long', day: 'numeric', year: 'numeric' }))}` : ''}</p>
  ${n.service_at ? `<p><strong>${esc(fmtDate(n.service_at, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</strong>${n.service_location ? ` · ${esc(n.service_location)}` : ''}</p>` : ''}
  ${n.details ? `<p>${esc(n.details)}</p>` : ''}
  <p class="muted small">Shared by ${esc(n.posted_by)}${n.relationship ? ` (${esc(n.relationship)})` : ''}</p>
</li>`;
    const body = `<div class="wrap narrow">
${crumbs(crumbItems)}
${toolNav('/notices/')}
<h1>Death notices, Nine Nights &amp; memorials</h1>
<p class="lede">Death announcements, funerals and homegoings, Nine Nights, set-ups, wakes and thanksgiving services for Caribbean families in New York. Free to post.</p>
${upcoming.length ? `<h2>Upcoming services</h2><ul class="notice-list">${upcoming.map(card).join('')}</ul>` : ''}
${recent.length ? `<h2>Recent notices</h2><ul class="notice-list">${recent.map(card).join('')}</ul>` : ''}
${!upcoming.length && !recent.length ? '<p class="note">No notices right now. Families can post one below.</p>' : ''}
<section class="card" id="post"><h2>Post a notice</h2>
<p>Every notice is checked by a person before it appears, usually within a day. Please post only for someone in your own family or circle, and only details the family is happy to share.</p>
<form class="js-form" data-table="memorial_notices">
  <label>Name of the person who passed<input name="deceased_name" required minlength="3" maxlength="120"></label>
  <div class="row2"><label>Age (optional)<input name="age" type="number" min="0" max="120"></label>
  <label>Date of passing (optional)<input name="passed_on" type="date"></label></div>
  <div class="row2"><label>From (island)<select name="island"><option value="">Choose…</option>${ISLAND_OPTS.map((i) => `<option>${esc(i)}</option>`).join('')}</select></label>
  <label>Hometown / district back home (optional)<input name="hometown" maxlength="120" placeholder="e.g. May Pen, Clarendon"></label></div>
  <label>Lived in (optional)<input name="ny_area" maxlength="120" placeholder="e.g. East Flatbush, Brooklyn"></label>
  <label>Type of notice<select name="notice_type">${Object.entries(NOTICE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  <div class="row2"><label>Service date and time (optional)<input name="service_at" type="datetime-local"></label>
  <label>Service place (optional)<input name="service_location" maxlength="200" placeholder="Church or funeral home and address"></label></div>
  <label>Details (optional)<textarea name="details" maxlength="2000" rows="4" placeholder="Survived by…, viewing times, repast, where to send flowers"></textarea></label>
  <div class="row2"><label>Your name<input name="posted_by" required minlength="2" maxlength="120"></label>
  <label>Relationship (optional)<input name="relationship" maxlength="60" placeholder="e.g. daughter, nephew, church family"></label></div>
  <label>Your email (not published, only used if we have a question)<input name="contact_email" type="email" required></label>
  <button type="submit">Send for review</button>
  <p class="form-msg" role="status"></p>
</form></section>
<p class="muted small">To correct or remove a notice, reply to the email we send you or use the report link on any listing.</p>
</div>`;
    await page('notices/index.html', { title: 'Caribbean Death Notices, Nine Nights & Funerals in New York | CaribNY', description: 'Death announcements, funerals, Nine Nights and thanksgiving services for Jamaican, Trinidadian, Guyanese, Haitian and other Caribbean families in New York.', canonical: '/notices/', body, schema: [crumbSchema(crumbItems)] });
  }

  // ---------- /linkup/ ----------
  {
    const crumbItems = bc('Link-up board', '/linkup/');
    const groups = (data.linkup_groups || []).filter((g) => g.status === 'published');
    const orgs = biz.filter((b) => ['community', 'churches'].includes(catById[b.category_id]?.slug));
    const gCard = (g) => `<li class="biz-card" data-text="${esc([g.name, g.island, g.region, g.neighborhood, g.description, GROUP_KINDS[g.kind]].join(' ').toLowerCase())}" data-kind="${esc(g.kind)}">
  <div class="biz-link"><h3>${g.website ? `<a href="${esc(g.website)}" rel="noopener" target="_blank">${esc(g.name)}</a>` : esc(g.name)}</h3>
  <p class="meta">${esc(GROUP_KINDS[g.kind] || '')}${g.island ? ' · ' + esc(g.island) : ''}${g.neighborhood || g.region ? ' · ' + esc([g.neighborhood, g.region].filter(Boolean).join(', ')) : ''}</p>
  ${g.description ? `<p>${esc(g.description)}</p>` : ''}${g.meets ? `<p class="small"><strong>Meets:</strong> ${esc(g.meets)}</p>` : ''}${g.public_contact ? `<p class="small"><strong>Contact:</strong> ${esc(g.public_contact)}</p>` : ''}</div></li>`;
    const oCard = (b) => `<li class="biz-card" data-text="${esc([b.name, b.neighborhood, b.region, b.description, ...(b.islands || [])].join(' ').toLowerCase())}" data-kind="${catById[b.category_id]?.slug === 'churches' ? 'church' : 'cultural'}"><a class="biz-link" href="/business/${esc(b.slug)}/"><h3>${esc(b.name)}</h3><p class="meta">${esc(catById[b.category_id]?.name || '')}${b.neighborhood ? ' · ' + esc(b.neighborhood) : ''}</p>${b.description ? `<p>${esc(b.description)}</p>` : ''}</a></li>`;
    const body = `<div class="wrap">
${crumbs(crumbItems)}
${toolNav('/linkup/')}
<h1>Link-up board</h1>
<p class="lede">Find your people: island associations, old-school alumni groups, church groups, mentoring and cultural organizations across Caribbean New York.</p>
<form class="filters" onsubmit="return false"><label class="grow"><span class="sr">Search</span><input id="lu-q" type="search" placeholder="Search: Kingston College, Grenada, mentoring, Queens…"></label>
<label><span class="sr">Type</span><select id="lu-kind"><option value="">All types</option>${Object.entries(GROUP_KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label></form>
<p class="muted" id="lu-count" aria-live="polite"></p>
${groups.length ? `<h2>Groups</h2><ul class="biz-list lu-list">${groups.map(gCard).join('')}</ul>` : ''}
${orgs.length ? `<h2>Community organizations and churches in the directory</h2><ul class="biz-list lu-list">${orgs.map(oCard).join('')}</ul>` : ''}
<section class="card narrow" id="add-group"><h2>Add your group</h2>
<p>Run an island association, past students' association, church group, mentoring program or club? Add it free. We check each listing before it appears.</p>
<form class="js-form" data-table="linkup_groups">
  <label>Group name<input name="name" required minlength="3" maxlength="140" placeholder="e.g. … Past Students Association, New York Chapter"></label>
  <div class="row2"><label>Type<select name="kind" required>${Object.entries(GROUP_KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  <label>Island<select name="island"><option value="">Any / several</option>${ISLAND_OPTS.map((i) => `<option>${esc(i)}</option>`).join('')}</select></label></div>
  <div class="row2"><label>Area<select name="region"><option value="">Choose…</option>${['Brooklyn', 'Queens', 'Bronx', 'Manhattan', 'Staten Island', 'Long Island', 'Westchester', 'Online'].map((r) => `<option>${r}</option>`).join('')}</select></label>
  <label>Neighborhood (optional)<input name="neighborhood" maxlength="80"></label></div>
  <label>When and where you meet (optional)<input name="meets" maxlength="200" placeholder="e.g. 2nd Saturday monthly, Flatbush"></label>
  <label>About the group<textarea name="description" maxlength="1000" rows="3"></textarea></label>
  <div class="row2"><label>Website or social link (optional)<input name="website" type="url" maxlength="300"></label>
  <label>Public contact (optional)<input name="public_contact" maxlength="160" placeholder="Group email or page, shown publicly"></label></div>
  <label>Your email (not published)<input name="submitter_email" type="email" required></label>
  <button type="submit">Send for review</button>
  <p class="form-msg" role="status"></p>
</form></section>
</div>`;
    await page('linkup/index.html', { title: 'Caribbean Associations, Alumni Groups, Churches & Mentoring in New York | CaribNY', description: 'Find Jamaican, Trinidadian, Guyanese, Haitian, Bajan and Eastern Caribbean associations, past students’ associations, church groups and mentoring programs in New York.', canonical: '/linkup/', body, schema: [crumbSchema(crumbItems)] });
  }
}
