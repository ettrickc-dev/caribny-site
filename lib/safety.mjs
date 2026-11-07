// Neighborhood safety trends from NYPD complaint data on NYC Open Data.
// Runs at build time (daily). Data is published quarterly, so we compare the
// same calendar window (Jan 1 to the latest date in the data) across years,
// counted by report date (rpt_dt), the way NYPD CompStat counts.
//
// Source of counts, in order:
//  1. public.nypd_counts in Supabase (filled from NYC Open Data by the database,
//     see nypd_refresh_step1/2/3), because NYC Open Data often refuses requests
//     from Netlify's build servers;
//  2. NYC Open Data directly, as a fallback.

const UA = 'CaribNY community guide (https://caribny.com)';
const SOCRATA = 'https://data.cityofnewyork.us/resource';
const YTD = '5uac-w243';      // NYPD Complaint Data Current (Year To Date)
const HISTORIC = 'qgea-i56i'; // NYPD Complaint Data Historic (2006 to last year)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wfrxpzbchmbvqkzkfepn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcnhwemJjaG1idnFremtmZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDIzMjAsImV4cCI6MjEwOTM3ODMyMH0.eYvkMWJ0Iqr8Uu11pmFNFp5tmQduBKkSXSaeq_sYjGY';

export const MAJOR = [
  ['MURDER & NON-NEGL. MANSLAUGHTER', 'Murder'],
  ['RAPE', 'Rape'],
  ['ROBBERY', 'Robbery'],
  ['FELONY ASSAULT', 'Felony assault'],
  ['BURGLARY', 'Burglary'],
  ['GRAND LARCENY', 'Grand larceny'],
  ['GRAND LARCENY OF MOTOR VEHICLE', 'Car theft']
];

const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
export const PRECINCTS = [
  { pct: 67, area: 'East Flatbush', borough: 'Brooklyn' },
  { pct: 70, area: 'Flatbush, Midwood & Ditmas Park', borough: 'Brooklyn' },
  { pct: 71, area: 'Crown Heights (south) & Prospect Lefferts Gardens', borough: 'Brooklyn' },
  { pct: 77, area: 'Crown Heights (north) & Prospect Heights', borough: 'Brooklyn' },
  { pct: 69, area: 'Canarsie', borough: 'Brooklyn' },
  { pct: 63, area: 'Flatlands, Marine Park & Bergen Beach', borough: 'Brooklyn' },
  { pct: 81, area: 'Bedford-Stuyvesant (east)', borough: 'Brooklyn' },
  { pct: 73, area: 'Brownsville & Ocean Hill', borough: 'Brooklyn' },
  { pct: 113, area: 'South Jamaica, St. Albans & Springfield Gardens', borough: 'Queens' },
  { pct: 105, pcts: [105, 116], label: '105th & 116th Pcts', area: 'Queens Village, Cambria Heights, Laurelton, Rosedale & Springfield Gardens', borough: 'Queens',
    note: 'The NYPD split the new 116th Precinct off the 105th in 2025, so both are counted together to keep years comparable.' },
  { pct: 103, area: 'Jamaica & Hollis', borough: 'Queens' },
  { pct: 102, area: 'Richmond Hill & Woodhaven', borough: 'Queens' },
  { pct: 106, area: 'Ozone Park & South Ozone Park', borough: 'Queens' },
  { pct: 47, area: 'Wakefield, Williamsbridge & Edenwald', borough: 'Bronx' },
  { pct: 43, area: 'Soundview, Castle Hill & Parkchester', borough: 'Bronx' },
  { pct: 52, area: 'Bedford Park, Norwood & Fordham', borough: 'Bronx' },
  { pct: 32, area: 'Central Harlem (north)', borough: 'Manhattan' },
  { pct: 28, area: 'Central Harlem (south)', borough: 'Manhattan' }
];

async function soql(dataset, params, tries = 3) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/'/g, '%27')}`).join('&');
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`${SOCRATA}/${dataset}.json?${qs}`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`${dataset}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 4000 * i)); // NYC Open Data sometimes answers 503 under load
    }
  }
}

const MAJOR_SET = new Set(MAJOR.map(([d]) => d));

async function countsFor(dataset, from, to) {
  const rows = await soql(dataset, {
    $select: 'addr_pct_cd, ofns_desc, count(*) as n',
    // Counted by report date (rpt_dt), like NYPD CompStat. Filtering the historic
    // dataset by occurrence date (cmplnt_fr_dt) times out on NYC Open Data.
    $where: `law_cat_cd='FELONY' and rpt_dt between '${from}T00:00:00' and '${to}T23:59:59'`,
    $group: 'addr_pct_cd, ofns_desc',
    $limit: '50000'
  });
  const out = {}; // pct -> { offense -> n }
  for (const r of rows) {
    if (!MAJOR_SET.has(r.ofns_desc)) continue;
    const p = Number(r.addr_pct_cd); if (!Number.isFinite(p)) continue;
    (out[p] ||= {})[r.ofns_desc] = Number(r.n) || 0;
  }
  return out;
}

const pctChange = (now, before) => before > 0 ? (now - before) / before * 100 : null;
const sum = (o) => Object.values(o || {}).reduce((s, n) => s + n, 0);

async function fromSupabase() {
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'User-Agent': UA };
  const latest = await fetch(`${SUPABASE_URL}/rest/v1/nypd_counts?select=window_end&order=window_end.desc&limit=1`, { headers: h, signal: AbortSignal.timeout(20000) }).then((r) => r.ok ? r.json() : []);
  const we = latest[0]?.window_end; if (!we) return null;
  const rows = [];
  for (let from = 0; ; from += 1000) { // PostgREST returns up to 1000 rows per request
    const page = await fetch(`${SUPABASE_URL}/rest/v1/nypd_counts?select=year,pct,offense,n&window_end=eq.${we}&order=year,pct,offense`, { headers: { ...h, Range: `${from}-${from + 999}` }, signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error(`nypd_counts HTTP ${r.status}`); return r.json(); });
    rows.push(...page); if (page.length < 1000) break;
  }
  const year = Number(we.slice(0, 4));
  const byYear = {};
  for (const r of rows) ((byYear[r.year] ||= {})[r.pct] ||= {})[r.offense] = r.n;
  if (!byYear[year] || Object.keys(byYear).length < 6) return null;
  return { through: we, byYear };
}

async function fromSocrata() {
  const [{ max_dt: maxRaw } = {}] = await soql(YTD, { $select: 'max(rpt_dt) as max_dt', $where: `rpt_dt <= '${new Date().toISOString().slice(0, 10)}T23:59:59'` });
  if (!maxRaw) throw new Error('no latest date');
  const through = maxRaw.slice(0, 10);
  const year = Number(through.slice(0, 4)); const md = through.slice(5);
  const years = [year, year - 1, year - 2, year - 3, year - 4, year - 5];
  const sets = [];
  for (const y of years) sets.push(await countsFor(y === year ? YTD : HISTORIC, `${y}-01-01`, `${y}-${md}`)); // one at a time, gentler on the API
  const byYear = Object.fromEntries(years.map((y, i) => [y, sets[i]]));
  return { through, byYear };
}

export async function loadSafety() {
  let src = null;
  try { src = await fromSupabase(); } catch (e) { console.warn(`[safety] Supabase counts: ${e.message}`); }
  if (!src) src = await fromSocrata();
  return compute(src);
}

function compute({ through, byYear }) {
  const year = Number(through.slice(0, 4));
  const years = [year, year - 1, year - 2, year - 3, year - 4, year - 5];
  for (const y of years) byYear[y] ||= {};
  const cityTotal = (y) => Object.values(byYear[y]).reduce((s, o) => s + sum(o), 0);
  const city = { now: cityTotal(year), last: cityTotal(year - 1), fiveYrAvg: years.slice(1).reduce((s, y) => s + cityTotal(y), 0) / 5 };
  city.changeVsLast = pctChange(city.now, city.last); city.changeVs5 = pctChange(city.now, city.fiveYrAvg);
  city.history = years.slice().reverse().map((y) => [y, cityTotal(y)]);

  const precincts = PRECINCTS.map((p) => {
    // counts for this area in year y, adding up every precinct that makes up the area
    const area = (y) => { const out = {}; for (const c of p.pcts || [p.pct]) for (const [k, v] of Object.entries(byYear[y][c] || {})) out[k] = (out[k] || 0) + v; return out; };
    const now = sum(area(year)), last = sum(area(year - 1));
    const hist = years.slice(1).map((y) => sum(area(y)));
    const fiveYrAvg = hist.reduce((s, n) => s + n, 0) / hist.length;
    const offenses = MAJOR.map(([d, label]) => {
      const n = area(year)[d] || 0, l = area(year - 1)[d] || 0;
      return { label, now: n, last: l, change: pctChange(n, l) };
    });
    const changeVsLast = pctChange(now, last), changeVs5 = pctChange(now, fiveYrAvg);
    // "vs city trend": how this area's year-over-year change compares with the citywide change
    const vsCity = changeVsLast != null && city.changeVsLast != null ? changeVsLast - city.changeVsLast : null;
    const history = years.slice().reverse().map((y) => [y, sum(area(y))]);
    p = { ...p, label: p.label || `${ordinal(p.pct)} Pct` };
    return { ...p, now, last, fiveYrAvg, changeVsLast, changeVs5, vsCity, offenses, history };
  });
  return { through, year, window: `January 1 to ${new Date(through + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`, city, precincts, built: new Date().toISOString() };
}
