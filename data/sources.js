// Registry of every data source feeding the platform. Surfaced on the Data Sources
// panel and used to stamp "last refreshed" on the Executive Overview.
//
// Moveboard + RingCentral (calls & SMS) are now read LIVE from the centralized
// "bridge" API (read-only, company sign-in gated, refreshed ~every 6h) instead of
// from bundled spreadsheet snapshots — see assets/bridge.js + assets/ztz-transforms.js.
window.ZTZ_DATA = window.ZTZ_DATA || {};

ZTZ_DATA.bridge = { baseUrl: "https://ztz-bridge-32168089642.us-east4.run.app" };

ZTZ_DATA.sources = [
  { id:"moveboard",  name:"Moveboard Data",         type:"Live bridge API", system:"ZTZ Bridge · /api/moveboard",
    feeds:["Lead Distribution","MVD Analysis","Bad-Lead Intelligence"], grain:"one row per lead",
    dataset:"moveboard", status:"live" },
  { id:"calllog",    name:"RingCentral Calls",       type:"Live bridge API", system:"ZTZ Bridge · /api/ringcentral_calls",
    feeds:["MVD Call Analysis","Lead Distribution call coverage"], grain:"one row per call",
    dataset:"ringcentral_calls", status:"live" },
  { id:"sms",        name:"RingCentral SMS",         type:"Live bridge API", system:"ZTZ Bridge · /api/ringcentral_sms",
    feeds:["MVD SMS Analysis"], grain:"one row per message",
    dataset:"ringcentral_sms", status:"live" },
  { id:"bookings",   name:"Booked Jobs",             type:"Google Calendar", system:"Calendar",
    feeds:["Executive Overview","Operations / Booked Jobs"], grain:"one event per confirmed move",
    calendarId:"contact@ziptozipmoving.com", status:"live" },
  { id:"email",      name:"Email Tracker",           type:"Google Sheet", system:"Email",
    feeds:["Communication Intelligence"], grain:"one row per email event",
    sheetId:"1-2WuPa767SwfuzKHCBzv2uK1LdnvmV64qJ9V_5fZ4Gk", status:"connected" },
  { id:"invoice",    name:"Invoice",                 type:"Google Sheet", system:"Billing",
    feeds:["(template — not yet a reporting feed)"], grain:"invoice template",
    sheetId:"1JulDdR80d218dutXP-Pk91nqH8TxyUvvMiZ0bUWicBI", status:"available" }
];
