# Data Dictionary

The shared data layer lives in `data/*.js`. Each file assigns onto a single global,
`window.ZTZ_DATA`, so the shell and any report can read it with no fetch and no build step.

## `ZTZ_DATA.bookings` — Booking (confirmed move) · live
Source: **Booked Jobs** Google Calendar → parsed by `data/build_bookings.py`. One object per event.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Calendar event id |
| `date` | YYYY-MM-DD | Move (job) date |
| `time` | HH:MM | Start time |
| `customer` | string | Customer name |
| `from_state` / `to_state` | string | Origin / destination state (parsed from address) |
| `route` | string | `FROM→TO` (e.g. `NJ→NJ`) |
| `interstate` | bool | true when origin state ≠ destination state |
| `rep` | string | Sales Rep 1, normalized to canonical name |
| `source` | string | Lead source, normalized (Google, Yelp, AI Search, …) |
| `move_type` | string | e.g. Local Moving |
| `job_type` | string | e.g. Standard, Labor Work |
| `cf` | number | Total cubic feet |
| `crew` | number | Crew size |
| `cash_total` / `card_total` | number | Grand total by cash / card ($) |
| `deposit` | number | Deposit ($) |
| `job_code` / `request_id` | string | Move-board job code / request number |
| `status` | string | Calendar status (confirmed, …) |

## `ZTZ_DATA.bookingsMeta` — pre-computed aggregates
`generated`, `window_start`, `window_end`, `jobs`, `cf_total`, `cash_total`, `card_total`,
`avg_cf`, `avg_cash`, `interstate_pct`, `by_source{}`, `by_rep{jobs,cf,cash,card}`, `by_route{}`,
`by_movetype{}`, `by_day{date:{jobs,cf,cash,card}}`, and `today_*` (jobs/cf/cash/card for the current day).

## `ZTZ_DATA.summary` — module headline metrics
The latest values published by each analytical module, each with its own source window. Used by the
Executive Overview so no figure is shown without provenance. Groups: `leads`, `quality`, `calls`, `comms`.
Replace these with live joins as each module migrates onto the shared model.

## `ZTZ_DATA.sources` — data-source registry
One row per connected source: `id, name, type, system, feeds[], grain, status` (+ `sheetId`/`calendarId`).
Drives the Data Sources panel. Add a row when you connect something new.

---

## Target unified model (roadmap)
The Booking entity above is fully implemented. The Lead and Communication entities are the next to
move onto the shared layer; their intended shape:

**Lead** (from Moveboard Data): `lead_id, rep, source, status, flag, service, size, cf, from_state, to_state, create_date, move_date, quote_lo, quote_mid, quote_hi, lead_score`.

**Communication** (from CallLog, SMS Log, Email Tracker): `type(call|sms|email), direction(in|out), rep, customer_key(phone/email), timestamp, duration_or_segments, status, cost`. Joined to Lead by phone / customer / rep.

**Shared dimensions:** `reps[]` (11 sales reps), `sources[]`, `statuses[]`, `states[]`, `months[]`.
