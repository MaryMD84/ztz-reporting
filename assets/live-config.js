/* ============================================================================
   LIVE DATA CONFIG (Google OAuth)
   ----------------------------------------------------------------------------
   Fill in `clientId` after creating an OAuth Client ID in Google Cloud Console.
   Full walkthrough: docs/DEPLOY-GITHUB-OAUTH.md

   • Until `clientId` is set, OR when the page is opened as a local file,
     the platform runs on the bundled snapshot in data/bookings.js.
   • Once set and published to https (GitHub Pages), users sign in with Google
     and the Operations / Executive pages read the live calendar in-browser.
   Your sheets/calendar stay private — only authorized Google users see data.
   ========================================================================== */
window.ZTZ_LIVE_CONFIG = {
  // Reuse the bridge's Google Web client for the in-browser Calendar/Sheets read.
  // (Works if this client is authorized for Calendar API + Sheets API scopes; if not,
  //  the calendar fetch fails gracefully and Operations shows the bundled snapshot.)
  clientId: "32168089642-fkk3rglncf6hl5ikq7pi6jbornug1kbb.apps.googleusercontent.com",

  // Live source (the "Booked Jobs" calendar)
  calendarId: "contact@ziptozipmoving.com",

  // Full-year window pulled live from the Booked Jobs calendar (Operations = Calendar + Slack).
  timeMin: "2026-01-01T00:00:00Z",
  timeMax: "2027-01-01T00:00:00Z",
  windowDaysBack: 3,
  windowDaysFwd: 21,
  maxResults: 2500,

  // Sheets are pre-wired for the next step (calendar is live now).
  // Enabling them later only requires switching their flag to true in live-data.js.
  sheets: {
    moveboard: { id:"1-5L8cU8sDdIXGW5mmrnjQTb3uf5f99eNoTxcHJxKLlw", tab:"Sheet1" },
    calllog:   { id:"1ygBu7a7ffOP83XfbtG-8dCGotwzBkaAKtSESp1ODk0o", tab:"Sheet1" },
    sms:       { id:"1J_W1qMpiXr5lK1UQ4KaCG9lq8j-e9Dcn6fkVm5Ul7cg", tab:"Sheet1" },
    email:     { id:"1-2WuPa767SwfuzKHCBzv2uK1LdnvmV64qJ9V_5fZ4Gk", tab:"Sheet1" }
  }
};
