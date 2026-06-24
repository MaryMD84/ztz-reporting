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
  // Paste your OAuth Client ID here, e.g. "123456789-abcd.apps.googleusercontent.com"
  clientId: "",

  // Live source (already identified in your Drive/Calendar)
  calendarId: "contact@ziptozipmoving.com",

  // Rolling window pulled live from the Booked Jobs calendar
  windowDaysBack: 3,
  windowDaysFwd: 21,
  maxResults: 250,

  // Sheets are pre-wired for the next step (calendar is live now).
  // Enabling them later only requires switching their flag to true in live-data.js.
  sheets: {
    moveboard: { id:"1-5L8cU8sDdIXGW5mmrnjQTb3uf5f99eNoTxcHJxKLlw", tab:"Sheet1" },
    calllog:   { id:"1ygBu7a7ffOP83XfbtG-8dCGotwzBkaAKtSESp1ODk0o", tab:"Sheet1" },
    sms:       { id:"1J_W1qMpiXr5lK1UQ4KaCG9lq8j-e9Dcn6fkVm5Ul7cg", tab:"Sheet1" },
    email:     { id:"1-2WuPa767SwfuzKHCBzv2uK1LdnvmV64qJ9V_5fZ4Gk", tab:"Sheet1" }
  }
};
