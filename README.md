# CaribNY site

Pre-rendered version of [caribny.com](https://caribny.com). Every page is plain HTML built from the Supabase database at deploy time, so Google can read it.

## What it builds

- `/business/<slug>/`: one page per listing, with schema.org LocalBusiness (Restaurant, Bakery, etc.) markup, a map, a Verified badge, and claim and report forms.
- `/<area>/` and `/<area>/<category>/`: area pages and area × category pages, such as `/brooklyn/shipping/`. Pages with fewer than 2 listings are set to noindex.
- `/island/<island>/`: Jamaican, Guyanese, Trinidadian, Haitian and Bajan listings, and any other island that has listings.
- `/directory/`: every listing, with search and filters by area, type, island and Verified status.
- `/events/`: upcoming events with schema.org Event markup and an event submission form.
- `/carnival/`: year-round Labor Day carnival hub.
- `/guides/` and `/guides/<slug>/`: published guides, with Article markup and the attorney CTA.
- `/recommend/`, `/about/`, `sitemap.xml`, `robots.txt` and `404.html`.

Forms write straight to Supabase with the public anon key. Row-level security only allows inserts.

## Commands

    npm install
    npm run build            # live data from Supabase
    npm run build:fixture    # offline build from fixtures/sample.json

Optional environment variables:

- `SITE_URL`: defaults to `https://caribny.com`.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NOINDEX=1`: use on preview sites so Google ignores them.

## Keeping it fresh

The pages are rebuilt on every deploy. To pick up new listings, events and guides automatically:

1. Create a Netlify build hook.
2. Call it on a schedule (for example, daily) or whenever an admin approves changes.
