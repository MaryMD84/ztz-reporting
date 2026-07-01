/* ============================================================================
   LIVE BOOKED JOBS — full-year, from the bridge `moveboard` table
   ----------------------------------------------------------------------------
   The Operations + Executive Overview native views read window.ZTZ_DATA.bookings.
   This loader pulls every CONFIRMED moveboard job for 2026 live (the #booking
   Slack channel can't supply a whole year programmatically), transforms it to the
   bookings shape via ZTZ.buildBookings, and pushes it into the shell through the
   existing ZTZ_SHELL.setBookings + rerender hooks — so nothing about the layout
   changes, only the data + reporting period.

   Because a full year of days makes the daily column chart unreadable, the
   by_day buckets are rolled up to MONTHS for this view (12 bars, not ~365).
   ========================================================================== */
(function () {
  "use strict";
  var YEAR = 2026;
  function ready() {
    return window.ZTZ_BRIDGE && window.ZTZ_BRIDGE.onReady && window.ZTZ_SHELL &&
      window.ZTZ && window.ZTZ.buildBookings && window.ZTZ_LIVE && window.ZTZ_LIVE._agg;
  }
  var tries = 0;
  function start() {
    if (!ready()) { if (tries++ > 300) return; return setTimeout(start, 100); }
    window.ZTZ_BRIDGE.onReady(load);
  }
  function load() {
    window.ZTZ_BRIDGE.get("moveboard", { since: YEAR + "-01-01", since_col: "Move Date", limit: 60000 })
      .then(function (d) {
        var rows = (d && d.rows) || [];
        var bookings = window.ZTZ.buildBookings(rows, { year: YEAR });
        if (!bookings.length) { console.warn("[live-bookings] no confirmed " + YEAR + " jobs returned"); return; }
        var meta = window.ZTZ_LIVE._agg(bookings); // same meta shape as the snapshot
        // roll the daily buckets up to months so a full year stays readable
        var bm = {};
        bookings.forEach(function (r) {
          if (!r.date) return;
          var m = r.date.slice(0, 7) + "-01";
          var b = bm[m] || (bm[m] = { jobs: 0, cf: 0, cash: 0, card: 0 });
          b.jobs++; b.cf += r.cf || 0; b.cash += r.cash_total || 0; b.card += r.card_total || 0;
        });
        meta.by_day = bm;
        meta.reporting_period = YEAR + " (live · MoveBoard)";
        meta.source_feed = "moveboard (live)";
        if (d.truncated) console.warn("[live-bookings] moveboard hit the 100k row cap — some jobs may be missing");
        window.ZTZ_SHELL.setBookings(bookings, meta);
        window.ZTZ_SHELL.rerender();
      })
      .catch(function (e) { console.warn("[live-bookings] load failed:", e && e.message); });
  }
  start();
})();
