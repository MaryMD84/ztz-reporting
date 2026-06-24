// Registry of every data source feeding the platform. Surfaced on the Data Sources
// panel and used to stamp "last refreshed" on the Executive Overview. Add a row here
// when you connect a new source so it shows up everywhere automatically.
window.ZTZ_DATA = window.ZTZ_DATA || {};

ZTZ_DATA.sources = [
  { id:"moveboard",  name:"Moveboard Data",        type:"Google Sheet", system:"Moveboard CRM",
    feeds:["Lead Distribution","MVD Analysis","Bad-Lead Intelligence"], grain:"one row per lead",
    sheetId:"1-5L8cU8sDdIXGW5mmrnjQTb3uf5f99eNoTxcHJxKLlw", status:"connected" },
  { id:"calllog",    name:"CallLog (Jan–May 2026)", type:"Google Sheet", system:"RingCentral",
    feeds:["MVD Call Analysis","Lead Distribution call coverage"], grain:"one row per call",
    sheetId:"1ygBu7a7ffOP83XfbtG-8dCGotwzBkaAKtSESp1ODk0o", status:"connected" },
  { id:"sms",        name:"SMS Log (\"5 mm\")",     type:"Google Sheet", system:"RingCentral SMS",
    feeds:["MVD SMS Analysis"], grain:"one row per message",
    sheetId:"1J_W1qMpiXr5lK1UQ4KaCG9lq8j-e9Dcn6fkVm5Ul7cg", status:"connected" },
  { id:"email",      name:"Email Tracker",          type:"Google Sheet", system:"Email",
    feeds:["Communication Intelligence"], grain:"one row per email event",
    sheetId:"1-2WuPa767SwfuzKHCBzv2uK1LdnvmV64qJ9V_5fZ4Gk", status:"connected" },
  { id:"bookings",   name:"Booked Jobs",            type:"Google Calendar", system:"Calendar",
    feeds:["Executive Overview","Operations / Booked Jobs"], grain:"one event per confirmed move",
    calendarId:"contact@ziptozipmoving.com", status:"live" },
  { id:"invoice",    name:"Invoice",                type:"Google Sheet", system:"Billing",
    feeds:["(template — not yet a reporting feed)"], grain:"invoice template",
    sheetId:"1JulDdR80d218dutXP-Pk91nqH8TxyUvvMiZ0bUWicBI", status:"available" }
];
