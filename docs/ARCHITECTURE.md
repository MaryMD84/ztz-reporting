# Zip To Zip Moving — Reporting Platform Architecture

**Purpose.** Replace four separately maintained HTML dashboards with one centralized platform that is the single source of truth for management reporting and operational analysis, and that can grow — new reports, data sources, and analyses added without rebuilding the project.

This document is the blueprint: what exists, how the data fits together, how the platform is structured, and how to extend it.

---

## 1. What existed before

Four standalone dashboards, each built from a manual data export embedded directly in the HTML, each with its own styling, filters, and navigation:

| Dashboard | Scope | Records | Period | Key sections |
|---|---|---|---|---|
| Lead Distribution & Sales Operations | Lead flow & assignment | 6,946 leads | Dec 2025 – Apr 2026 | Daily flow, rep performance, sources, quality/size, capacity engine, shift schedule, what-if simulator, forecasting, loss trend, RingCentral coverage |
| MVD Analysis | Leads + communications | 20,218 records | Jan – May 2026 | MVD, MoM comparison, rep, source, flag & CF, **calls**, **SMS**, combined (8 tabs) |
| CRM Bad-Lead Intelligence | Lead quality | 3,509 bad leads | Jan – May 2026 | Why leads go bad, by status/source/rep/state/move-date, price comparison, CF distribution, lead detail |
| Communication Intelligence | Email & coverage | CRM coverage set | through Jun 2026 | Executive, reps, customer detail, opportunities, trends, recommendations, CRM coverage, email activity (8 tabs) |

They share the **same 11 sales reps**, the **same lead sources**, the **same status vocabulary**, and — critically — the **same underlying leads** (lead-ID ranges overlap across three of the four). They were effectively four views of one business, maintained four times.

## 2. Data sources

All four dashboards were snapshots. The live sources behind them, now connected, are:

| Source | System | Type | Feeds | Grain |
|---|---|---|---|---|
| **Moveboard Data** | Moveboard CRM | Google Sheet | Lead Distribution, MVD, Bad-Lead | one row per lead |
| **CallLog (Jan–May 2026)** | RingCentral | Google Sheet | MVD Call Analysis, Lead Dist coverage | one row per call |
| **SMS Log ("5 mm")** | RingCentral SMS | Google Sheet | MVD SMS Analysis | one row per message |
| **Email Tracker** | Email | Google Sheet | Communication Intelligence | one row per email event |
| **Booked Jobs** | Google Calendar | Calendar | **Operations, Executive Overview** | one event per confirmed move |
| Invoice | Billing | Google Sheet | (template, not yet a feed) | invoice template |

The **Booked Jobs calendar** was previously unused in reporting, yet it is the richest operational source in the business: every event is a confirmed move carrying route, customer, cubic feet, crew size, cash/card totals, source, sales rep, and job code. It is now the live spine of the Operations and Executive views.

## 3. Overlap — the consolidation opportunity

The four dashboards repeat the same primitives:

- **Reps** — performance is recomputed independently in all four.
- **Sources** — lead-source breakdowns appear in three.
- **Status / quality** — "bad lead" logic in the CRM dashboard overlaps MVD's flags and Lead Distribution's loss trend.
- **Communications** — calls (MVD, Lead Dist), SMS (MVD), and email (Communication) all describe the *same customers* but never meet.
- **Filters** — rep / source / status / state / month are rebuilt from scratch in each file.

Consolidation means modelling these once and letting every report read from the same shared structure.

## 4. Unified data model

Three core entities plus shared dimensions:

- **Lead** — the spine. `lead_id, rep, source, status, flag, state(from/to), service, size, cf, create_date, move_date, quote_lo/mid/hi, lead_score`. Sourced from Moveboard Data. Bad-lead, distribution, and MVD analyses are all filtered views of this.
- **Communication** — `type(call|sms|email), direction, rep, customer_phone/email, timestamp, duration/segments, status, cost`. Sourced from CallLog, SMS Log, Email Tracker; joined to Lead by phone / rep / customer. Speed-to-lead and coverage live here.
- **Booking (confirmed move)** — `date, route, customer, rep, source, move_type, cf, crew, cash_total, card_total, deposit, job_code, request_id, status`. Sourced live from the Booked Jobs calendar. Revenue, capacity, and operations live here.
- **Dimensions** — `reps[]`, `sources[]`, `statuses[]`, `states[]`, `months[]` — defined once, shared everywhere.

`data/bookings.js` is the first fully-implemented slice of this model (Booking entity, live). `data/summary.js` carries the published headline metrics for the Lead, Communication, and quality entities until those modules are migrated onto the shared layer. See `DATA_DICTIONARY.md` for field-level detail.

## 5. Platform architecture

A static, dependency-free site that opens by double-clicking `index.html` — no server, no build step, works offline. Two kinds of report live side by side:

- **Native views** rendered by the shell directly from the shared data layer (Executive Overview, Operations, Data Sources). These get the shared design system and shared filters.
- **Module views** — the four existing dashboards, preserved exactly, shown in lazy-loaded iframes so their full interactivity is untouched and there is zero risk of style/script collisions.

```
ZipToZip Reporting Platform/
├── index.html              ← app shell: sidebar, routing, native views
├── assets/
│   ├── config.js           ← THE REGISTRY — add reports/sources here
│   ├── theme.css           ← shared design system
│   └── (shell logic is inline in index.html)
├── data/                   ← the shared data layer (generated, not hand-edited)
│   ├── bookings.js         ← live, from Booked Jobs calendar
│   ├── summary.js          ← module headline metrics (with provenance)
│   ├── sources.js          ← data-source registry
│   └── build_bookings.py   ← calendar → bookings.js (seed + scheduled refresh)
├── modules/                ← existing dashboards, preserved
│   ├── lead-distribution.html
│   ├── mvd-analysis.html
│   ├── bad-leads.html
│   └── communication.html
└── docs/  ARCHITECTURE.md · DATA_DICTIONARY.md
```

The **registry (`config.js`)** is the scalability hinge: the sidebar, routing, and topbar are all generated from it. Nothing else in the shell knows the list of reports.

## 6. Navigation & shared filters

A fixed left sidebar groups reports into **Command Center** (Executive Overview, Operations), **Sales & Leads**, **Quality & Risk**, and **System** — groups are derived automatically from the registry. The topbar shows a live/snapshot badge per view. The Operations view carries a **shared filter bar** (rep · source · day) that recomputes every KPI, chart, and table from the underlying booking records; this is the pattern future native reports inherit. Legacy modules keep their own internal filters until they are migrated onto the shared layer.

## 7. Live data & refresh (GitHub Pages + Google OAuth)

A page opened as a local file cannot reach Google's private APIs — but a page served from a real
`https://` origin **can**. The platform is therefore published to **GitHub Pages**, where a Google
**OAuth** layer (`assets/live-data.js` + `assets/live-config.js`) lets an authorized user sign in and
read the private **Calendar** (and, next, Sheets) live in the browser. The booked-jobs parser there
mirrors `data/build_bookings.py` exactly, so live data and the bundled snapshot are identical in shape
(verified: both produce 200 jobs / \$395,042 cash for the seed window).

It is progressive enhancement with three modes, auto-detected:

1. **Live** — published to https with an OAuth client ID set → "Connect Google", then Operations &
   Overview read the calendar live and re-authorize silently on each open. Nothing is made public;
   data goes straight from Google to the viewer's browser under their own sign-in.
2. **Live cache** — last successful live pull is kept in `localStorage` and shown instantly on reopen.
3. **Snapshot** — local file or no client ID → the bundled `data/bookings.js` (regenerable offline via
   `build_bookings.py`).

Setup is documented in `DEPLOY-GITHUB-OAUTH.md`. The four deep-dive dashboards remain periodic
snapshots until their Sheets pulls are switched on (IDs already wired in `live-config.js`).

## 8. How to extend (designed to grow)

- **New report from existing data** — add a `render` block or a `modules/<name>.html`, then one entry in `config.js`. It appears in the sidebar automatically.
- **New data source** — add it to `data/sources.js`, drop its data into `data/<name>.js`, reference it from a report. Extend the scheduled task to pull it.
- **New nav group** — just use a new `group` string in the registry.

## 9. Reporting opportunities this unlocks

Now that the sources meet in one model, the high-value reports that no single legacy dashboard could produce:

1. **End-to-end funnel** — lead → contacted (call/SMS/email) → quoted → confirmed (booking) → completed / went bad. Joins Lead + Communication + Booking.
2. **Speed-to-lead vs. conversion** — first-contact latency (from CallLog/SMS) against booking rate; the single strongest lever on revenue.
3. **Unified rep scorecard** — one row per rep combining lead volume, contact effort, quality (bad-lead rate), booked jobs, CF, and revenue.
4. **Source ROI** — cost/volume by source against *booked revenue* by source (the Operations view already shows booked revenue by source; pairing it with spend closes the loop).
5. **Capacity & crew forecasting** — booked CF and crew demand per day from the calendar vs. available crews; surfaces over/under-booked days.
6. **Revenue & cash/card trend** — daily booked value, deposit collection, interstate mix — straight from the calendar.
7. **Data-hygiene monitor** — free-text sources and rep names in the calendar (e.g. "ChatGPT", nicknames) need light normalization; a small report can flag unmapped values for cleanup.
