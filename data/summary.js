// Cross-source headline metrics surfaced on the Executive Overview.
// Live booked-jobs figures come from bookings.js (calendar). The figures below are
// the latest values published by each analytical module; each carries its own source
// and as-of window so the Overview never presents a number without provenance.
// The scheduled refresh updates bookings.js continuously; module figures update when
// their source dashboard is refreshed from Google Sheets.
window.ZTZ_DATA = window.ZTZ_DATA || {};

ZTZ_DATA.summary = {
  // ---- Leads & CRM (Moveboard Data sheet) ----
  leads: {
    total_leads: 6946,            // Lead Distribution dashboard
    leads_window: "Dec 31, 2025 – Apr 30, 2026",
    crm_records: 20218,           // MVD Analysis (lead records, Jan–May 2026)
    crm_window: "Jan – May 2026",
    module: "lead-distribution"
  },
  // ---- Lead quality (CRM Bad Lead Intelligence) ----
  quality: {
    bad_leads: 3509,
    bad_window: "Jan – May 2026",
    bad_share_pct: 17.4,          // 3,509 of 20,218 CRM records
    top_reason: "Dead Lead",
    top_reason_count: 1436,
    reasons: { "Dead Lead": 1436, "Not Interested / Small Job": 238, "Duplicate / Copy Lead": 213, "Spam": 9 },
    module: "bad-leads"
  },
  // ---- Voice (CallLog sheet, RingCentral) ----
  calls: {
    total: 35197, connected: 30268, missed: 1701,
    connect_rate_pct: 86.0,
    window: "Jan – May 2026",
    monthly: { "Jan":5381, "Feb":5230, "Mar":7188, "Apr":7568, "May":9830 },
    module: "mvd-analysis"
  },
  // ---- Communication coverage (Email Tracker sheet) ----
  comms: {
    crm_records: 9755,
    confirmed_bookings: 1526,
    active_opportunities: 226,
    never_emailed: 9462,
    qualifying_emails: 351,
    customers_contacted: 115,
    avg_response_h: 2.6,
    unanswered_replies: 39,
    confirmed_at_risk: 5,
    quotes_no_followup: 29,
    june_moves_scheduled: 550,
    module: "communication"
  }
};
