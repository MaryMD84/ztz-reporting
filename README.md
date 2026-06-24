# Zip To Zip Moving — Reporting Platform

One centralized platform that combines all reporting into a single navigable system, and is built
to grow. Source of truth for management reporting and operational analysis.

## Open it
Double-click **`index.html`**. No install, no server — it runs in any browser, offline.

Use the left sidebar to move between reports. The **Operations** and **Executive Overview** pages are
live from the Booked Jobs calendar; the four analytical dashboards (Lead Distribution, MVD Analysis,
Bad-Lead Intelligence, Communication) open inside the platform with all their original functionality.

## What's inside
| Section | What it shows | Data |
|---|---|---|
| Executive Overview | Cross-source KPIs and health at a glance | live + module snapshots |
| Operations · Booked Jobs | Confirmed moves, revenue pipeline, CF load, crew, routes — filterable | **live** (calendar) |
| Lead Distribution | Flow, rep performance, sources, capacity & scheduling | Moveboard |
| MVD Analysis | Leads, MoM, source, flag/CF, calls, SMS, combined | Moveboard + RingCentral |
| Bad-Lead Intelligence | Why leads go bad, by every dimension, price & CF | Moveboard |
| Communication | Coverage, response time, at-risk bookings, follow-ups | Email Tracker |
| Data Sources | Connected sheets & calendar, refresh status | registry |

## Add a new report (no rebuild)
1. Build it as a native view or drop an HTML file in `modules/`.
2. Add **one** entry to `assets/config.js`.
3. It appears in the sidebar automatically.

## Go live (GitHub Pages + Google OAuth)
Published to GitHub Pages, the platform reads your **private** Calendar/Sheets live in the browser via
Google sign-in — no schedule, nothing made public, only authorized users see data. Full walkthrough in
**`docs/DEPLOY-GITHUB-OAUTH.md`**: create the repo, enable Pages, make a Google OAuth client ID, and
paste it into `assets/live-config.js`. Until then (or opened locally) it runs on the bundled snapshot.

To regenerate the offline snapshot by hand from a calendar export:
```
python3 data/build_bookings.py <calendar_export.json>
```

## Structure
`index.html` (shell) · `assets/` (config + theme) · `data/` (shared data layer) · `modules/` (existing dashboards) · `docs/` (architecture & data dictionary).

See `docs/ARCHITECTURE.md` for the full design and `docs/DATA_DICTIONARY.md` for field-level schemas.
