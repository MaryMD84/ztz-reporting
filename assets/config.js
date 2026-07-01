/* ============================================================================
   ZipToZip Reporting Platform — CONFIGURATION REGISTRY
   ----------------------------------------------------------------------------
   This is the ONLY file you edit to grow the platform.

   • Add a report  -> push a new object into ZTZ_CONFIG.sections
   • Native page   -> type:"native"  (rendered by the shell, reads data/*.js)
   • Existing HTML -> type:"iframe"   (drop the file in modules/ and point to it)
   • New nav group -> just use a new `group` string; the sidebar builds itself.

   Nothing else in the shell needs to change. Navigation, routing, and the
   sidebar are all generated from this list at load time.
   ========================================================================== */
window.ZTZ_CONFIG = {
  brand: {
    name: "Zip To Zip Moving",
    product: "Reporting Platform",
    tagline: "Single source of truth for management & operations"
  },

  // Order here = order in the sidebar. `group` headers are rendered automatically.
  sections: [
    { id:"overview", title:"Executive Overview", icon:"▦", group:"Command Center",
      type:"native", desc:"Cross-source KPIs and health at a glance" },

    { id:"operations", title:"Operations · Booked Jobs", icon:"🚚", group:"Command Center",
      type:"native", live:true, source:"Calendar + Slack",
      desc:"Booked moves, revenue pipeline, CF load & crew" },

    { id:"lead-distribution", title:"Lead Distribution", icon:"📥", group:"Sales & Leads",
      type:"iframe", file:"modules/lead-distribution.html", source:"Moveboard Data",
      desc:"Daily flow, rep performance, sources, capacity & scheduling" },

    { id:"mvd-analysis", title:"MVD Analysis", icon:"📊", group:"Sales & Leads",
      type:"iframe", file:"modules/mvd-analysis.html", source:"Moveboard + RingCentral",
      desc:"Leads, MoM, source, flag/CF, calls, SMS, combined" },

    { id:"bad-leads", title:"Bad-Lead Intelligence", icon:"🚩", group:"Quality & Risk",
      type:"iframe", file:"modules/bad-leads.html", source:"Moveboard Data",
      desc:"Why leads go bad, by status/source/rep/state, price & CF" },

    { id:"communication", title:"Communication", icon:"📨", group:"Quality & Risk",
      type:"iframe", file:"modules/communication.html", source:"Email Tracker",
      desc:"Coverage, response time, at-risk bookings, follow-ups" },

    { id:"hatch-crm", title:"Hatch ↔ CRM", icon:"🔁", group:"Quality & Risk",
      type:"iframe", file:"modules/hatch-crm.html", live:true, source:"Hatch + Moveboard + Angi",
      desc:"Hatch outreach reconciled against the CRM; Angi lead-source audit" },

    { id:"logic", title:"Report Logic", icon:"📐", group:"System",
      type:"iframe", file:"modules/logic.html",
      desc:"Every rule, mapping & calculation each report uses — for review" },

    { id:"sources", title:"Data Sources", icon:"🔌", group:"System",
      type:"native", desc:"Connected sheets, calendar & refresh status" }
  ]
};
