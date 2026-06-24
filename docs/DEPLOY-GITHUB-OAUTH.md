# Publish to GitHub Pages + connect live Google data (OAuth)

This makes the platform read your **private** Google Calendar (and later Sheets) live, in the
browser, with no schedule and without making anything public. It works because a page served from
`https://...github.io` is a real web origin that Google OAuth will trust — a local file is not.

**How it behaves**
- Local file or no client ID → bundled snapshot (`data/bookings.js`).
- Published to GitHub Pages **with** a client ID → a "Connect Google" button appears; after the first
  sign-in it re-authorizes silently on each open, so Operations & Executive Overview stay live.
- Only people you authorize (who already have access to the calendar/sheets) ever see data.

---

## Step 1 — Put the files on GitHub Pages
1. Create a repository under **marymd84** (e.g. `ztz-reporting`). For a clean URL you can instead name it
   `marymd84.github.io`.
2. Upload the entire `ZipToZip Reporting Platform` folder contents to the repo root (so `index.html`
   is at the top level). The included `.nojekyll` file is required — keep it.
3. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
4. After a minute your site is at **`https://marymd84.github.io/ztz-reporting/`** (or `https://marymd84.github.io/` if you used the special repo name). Note this URL — its origin is `https://marymd84.github.io`.

## Step 2 — Create a Google OAuth Client ID
1. Go to **console.cloud.google.com** → create/select a project (e.g. "ZTZ Reporting").
2. **APIs & Services → Library** → enable **Google Calendar API** and **Google Sheets API**.
3. **APIs & Services → OAuth consent screen**:
   - If you sign in with a **ziptozipmoving.com** Google Workspace account, choose **Internal** — then
     only company accounts can use it, and no Google verification is needed. *(Recommended.)*
   - If you must use a personal Gmail, choose **External**, keep it in *Testing*, and add each user's
     email under **Test users**. (They'll see an "unverified app" notice they can click through.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `https://marymd84.github.io` (origin only — no path).
     Add `http://localhost:8000` too if you want to test locally with a web server.
   - Create, then **copy the Client ID** (looks like `1234567890-abcd.apps.googleusercontent.com`).

## Step 3 — Plug in the Client ID
1. Open `assets/live-config.js`.
2. Set `clientId: "PASTE_YOUR_CLIENT_ID_HERE"`.
3. Commit/push. (The calendar ID and sheet IDs are already filled in.)

## Step 4 — Go live
1. Open your GitHub Pages URL.
2. Click **Connect Google**, sign in, and approve the read-only Calendar/Sheets access.
3. Operations and the Executive Overview now show live booked-jobs data; the header shows **Live · synced …**.
   Reopen later and it refreshes automatically.

---

## Scope & privacy
- Requested scopes are **read-only**: `calendar.readonly`, `spreadsheets.readonly`. The site never writes.
- Data is fetched straight from Google to the viewer's browser using their own sign-in. Nothing is
  stored on GitHub, and the sheets/calendar are never made public.
- The four deep-dive dashboards (Lead Distribution, MVD, Bad-Lead, Communication) currently ship as
  periodic snapshots. To make them live too, enable the Sheets pulls (the IDs are already in
  `live-config.js`) and point each module's data at the Sheets API — that's the next milestone.

## Troubleshooting
- **"Connect Google" does nothing / popup blocked** → allow popups for the site.
- **`redirect_uri_mismatch` / `origin` error** → the Authorized JavaScript origin must exactly match
  your Pages origin (`https://marymd84.github.io`, no trailing path or slash).
- **403 / API not enabled** → enable Calendar API (and Sheets API) in the same Cloud project.
- **"Access blocked: app not verified"** → expected for External/Testing; add the user as a Test user,
  or use an Internal (Workspace) consent screen.
- **Still on "Snapshot"** → the page is a local file or `clientId` is empty; serve over https and set the ID.
