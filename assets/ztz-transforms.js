/* ============================================================================
   ZTZ TRANSFORMS — raw bridge rows  ->  the shapes the dashboards already use
   ----------------------------------------------------------------------------
   The bridge serves RAW table rows keyed by the original sheet column names
   (e.g. "Create Date", "Service Type", "#", "Action Result"). The deep-dive
   dashboards were built from offline-precomputed arrays. These pure functions
   reproduce those arrays FROM the raw rows so each module's render code is
   untouched — only the data-loading layer changes.

   Loaded as a normal <script> in each module (exposes window.ZTZ) and also
   require()-able in Node for the test harness.

   ── WHERE TO ADJUST IF A FIELD COMES BACK EMPTY LIVE ──────────────────────
   Column-name guesses live in COLS / CALL_COLS / SMS_COLS below. The resolver
   is space/case/punctuation-insensitive and tries several aliases, so most
   real headers match automatically. If a field is blank after the first live
   sign-in, add the real header (lowercased, spaces/dots/slashes removed) to the
   relevant alias list — that's the only change needed.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ZTZ = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---- official mapping/translator tables (loaded from the bridge) ---------
     setTranslators() is called by each report with the sales_translator,
     source_correction and status_translator datasets. Once set, canonRep()/
     srcNorm() prefer the official mapping and fall back to the built-in rules. */
  var _TR = { rep: null, source: null, status: null };
  function trKey(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function cleanNick(s) { return String(s || "").replace(/^-?\d+\.\s*/, "").trim(); } // "2. Alex K." -> "Alex K."

  /* ---- column aliases (normalized: lowercased, [\s._/#-] stripped) --------- */
  var COLS = {
    id: ["", "id", "leadid", "leadnumber"], // "#" normalizes to ""
    status: ["status", "leadstatus"],
    flag: ["flag", "leadflag"],
    lead_score: ["leadscore", "score"],
    service: ["servicetype", "service"],
    size: ["sizeofmove", "size", "movesize"],
    move_date: ["movedate"],
    create_date: ["createdate", "created", "datecreated", "leaddate"],
    booked_date: ["bookeddate"],
    customer: ["customer", "customername", "name"],
    moving_from: ["movingfrom", "from", "origin"],
    moving_to: ["movingto", "to", "destination"],
    source: ["source", "leadsource"],
    rep: ["assigned", "salesrep", "salesrep1", "rep", "assignedto", "agent"],
    phone: ["phone", "phonenumber", "customerphone", "cell"],
    email: ["email"],
    quote: ["estquote", "estimatedquote", "quote"],
    closing: ["closingtotal", "closing", "grandtotal"],
    invoice: ["invoicetotal"],
    payment: ["paymenttotal"],
  };
  var CALL_COLS = {
    from: ["from", "fromnumber"],
    to: ["to", "tonumber"],
    direction: ["direction"],
    name: ["name"],
    date: ["date"],
    time: ["time"],
    action: ["action"],
    result: ["actionresult", "result"],
    duration: ["duration", "durationseconds"],
  };
  var SMS_COLS = {
    direction: ["direction"],
    type: ["type"],
    sender: ["sendernumber", "sender"],
    senderName: ["sendername"],
    recipient: ["recipientnumber", "recipient"],
    recipientName: ["recipientname"],
    datetime: ["datetime", "date"], // "Date / Time" -> "datetime"
    segments: ["segmentcount", "segments"],
    cost: ["cost"],
  };

  /* ---- generic column resolver -------------------------------------------- */
  function normKey(k) {
    return String(k).toLowerCase().replace(/[\s\n._/#-]/g, "");
  }
  function pick(row, aliases) {
    for (var k in row) {
      if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
      var kn = normKey(k);
      for (var i = 0; i < aliases.length; i++)
        if (kn === aliases[i]) {
          var v = row[k];
          if (v !== null && v !== undefined && v !== "") return v;
        }
    }
    return "";
  }
  function pickLoose(row, frag) {
    for (var k in row) {
      if (normKey(k).indexOf(frag) >= 0) {
        var v = row[k];
        if (v !== null && v !== undefined && v !== "") return v;
      }
    }
    return "";
  }
  function col(row, name) {
    return pick(row, COLS[name] || [name]);
  }

  /* ---- scalar parsers ------------------------------------------------------ */
  function money(s) {
    if (s === null || s === undefined || s === "") return null;
    var m = String(s).replace(/\$/g, "").match(/-?[\d,]*\.?\d+/);
    return m ? parseFloat(m[0].replace(/,/g, "")) : null;
  }
  function numv(s) {
    if (s === null || s === undefined || s === "") return null;
    var m = String(s).match(/-?\d[\d,]*\.?\d*/);
    return m ? parseFloat(m[0].replace(/,/g, "")) : null;
  }
  function intv(s) {
    var n = numv(s);
    return n === null ? null : Math.round(n);
  }
  function digits10(s) {
    var d = String(s == null ? "" : s).replace(/\D/g, "");
    return d.length >= 10 ? d.slice(-10) : d;
  }
  function parseCF(row) {
    // CF lives under a header containing "cf"/"c.f"/"cubic"/"lbs" in the export
    var v =
      pickLoose(row, "totalcf") ||
      pickLoose(row, "cubic") ||
      pickLoose(row, "cf") ||
      pickLoose(row, "lbs");
    return intv(v);
  }
  function quoteMid(row) {
    // "Est Quote" may be a range "1094 - 1221"; mid of the range
    var raw = col(row, "quote");
    if (raw === "") return null;
    var nums = (String(raw).match(/[\d,]+\.?\d*/g) || []).map(function (x) {
      return parseFloat(x.replace(/,/g, ""));
    });
    if (!nums.length) return null;
    if (nums.length >= 2) return Math.round(((nums[0] + nums[1]) / 2) * 100) / 100;
    return nums[0];
  }

  var US_STATES = ("AL AK AZ AR CA CO CT DC DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(
    " "
  );
  function parseState(addr) {
    if (!addr) return "Unknown";
    var toks = String(addr).match(/\b[A-Z]{2}\b/g) || [];
    for (var i = toks.length - 1; i >= 0; i--)
      if (US_STATES.indexOf(toks[i]) >= 0) return toks[i];
    return "Unknown";
  }

  /* ---- dates --------------------------------------------------------------- */
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function toDate(v) {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v).trim();
    // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }
    // "M/D/YYYY [h:mm[:ss] AM/PM]"
    var d = new Date(s);
    if (!isNaN(d)) return d;
    var m2 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m2) {
      var y = m2[3].length === 2 ? +("20" + m2[3]) : +m2[3];
      return new Date(y, +m2[1] - 1, +m2[2]);
    }
    return null;
  }
  function iso(d) {
    if (!d) return null;
    return (
      d.getFullYear() +
      "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + d.getDate()).slice(-2)
    );
  }
  function isoMin(d) {
    if (!d) return null;
    return (
      iso(d) + "T" + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)
    );
  }
  function ym(d) {
    return d ? d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) : null;
  }
  function monthLabel(d) {
    return d ? MON[d.getMonth()] + " " + d.getFullYear() : null;
  }
  function shiftOf(h) {
    if (h == null) return "Unknown";
    if (h >= 6 && h <= 11) return "Morning";
    if (h >= 12 && h <= 16) return "Afternoon";
    if (h >= 17 && h <= 21) return "Evening";
    return "Night"; // 22-23, 0-5
  }

  /* ---- categorical normalizers (derived empirically from the snapshots) ---- */
  var REPMAP = {
    george: "George Davis", goglik: "George Davis", alanna: "Alanna Brown",
    alex: "Alex Koval", amy: "Amy Olsson", daniella: "Daniella Pelowski",
    david: "David Barta", eli: "Eli Kane", lisa: "Lisa Leman",
    lucas: "Lucas Ruiz Estapé", maya: "Maya Zoric", nick: "Nick Haas",
    mary: "Mary Della Russo",
  };
  function titleCase(s) {
    return String(s).replace(/\w\S*/g, function (t) {
      return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();
    });
  }
  function canonRep(raw) {
    if (!raw) return "Unassigned";
    if (_TR.rep) { var tv = _TR.rep[trKey(raw)]; if (tv) return tv; } // official Sales Translator
    var r = String(raw).replace(/<[^>]+>/g, "").trim().toLowerCase();
    r = r.split("/")[0].split("&")[0].split(",")[0].trim();
    for (var k in REPMAP) if (r.indexOf(k) === 0) return REPMAP[k];
    return raw.trim() ? titleCase(raw.trim()) : "Unassigned";
  }

  // exact srcRaw -> src map captured from the Lead-Distribution snapshot
  var SRC_MAP = {
    "angi ads":"Angi","angie's list":"Angi","angi(angi's list)":"Angi","google":"Google",
    "google search":"Google","google local":"Google","promo-google1":"Google","bing":"Google",
    "yelp":"Yelp","yelp1":"Yelp","yelp a":"Yelp","thumbtack":"Thumbtack","thumbtack a":"Thumbtack",
    "reddit":"Reddit","chatgpt":"AI Search","gemini":"AI Search","perplexity":"AI Search",
    "moveboard":"Moveboard","return customer":"Referral","returned costumer":"Referral",
    "returned customer":"Referral","recommended":"Referral","post card":"Postcard","postcard":"Postcard",
    "facebook":"Facebook/Social","instagram":"Facebook/Social","nextdoor":"Facebook/Social",
    "website":"Website","movers development":"Website","other":"Other","groupon":"Other",
    "movebuddha":"Other","movematcher.com":"Other","craiglist":"Other","bark":"Other","bbb":"Other",
    "moving.com":"Other","movers.com":"Other","birdeye":"Other","trustpilot":"Other",
    "my move advisor":"Other","my move adviser":"Other","zillow":"Other","hire a helper":"Other",
  };
  function srcNorm(raw) {
    if (!raw) return "Unknown";
    if (_TR.source) { var tv = _TR.source[trKey(raw)]; if (tv) return tv; } // official Source Correction
    var s = String(raw).trim();
    var key = s.toLowerCase();
    if (SRC_MAP[key]) return SRC_MAP[key];
    if (/zip to zip/.test(key)) return "Other";
    if (key.indexOf("angi") >= 0) return "Angi";
    if (key.indexOf("yelp") >= 0) return "Yelp";
    if (key.indexOf("thumbtack") >= 0) return "Thumbtack";
    if (key.indexOf("reddit") >= 0) return "Reddit";
    if (/google|bing|promo-google/.test(key)) return "Google";
    if (/chatgpt|gemini|perplexity|openai|ai search/.test(key)) return "AI Search";
    if (key.indexOf("moveboard") >= 0) return "Moveboard";
    if (/facebook|instagram|nextdoor|social/.test(key)) return "Facebook/Social";
    if (/post ?card/.test(key)) return "Postcard";
    if (/return|recommend|referr|friend/.test(key)) return "Referral";
    if (/website|movers development/.test(key)) return "Website";
    return "Other";
  }

  var SG_MAP = {
    "Confirmed":"Won","Dead Lead":"Dead","Archive":"Archived",
    "Expired":"Lost","Cancelled":"Lost","We are not available":"Lost","Spam":"Lost",
    "Not Confirmed":"Open","Pending":"Open","Video Estimate":"Open",
    "In-home Estimate":"Open","Date Pending":"Open",
  };
  function statusGroup(st) { return SG_MAP[st] || "Open"; }

  var SIZE_MAP = {
    "Studio":"Small","1 Bedroom condo/aprt.":"Small","Single Item":"Small","Storage":"Small",
    "2 Bedroom condo/aprt.":"Medium","2 bedroom house/townhouse":"Medium","Office Move":"Medium",
    "3 Bedroom condo/aprt.":"Medium",
    "3 bedroom house/townhouse":"Large","4 bedroom house and more":"Large",
  };
  function sizeBucket(raw) {
    if (!raw) return "Unknown";
    if (SIZE_MAP[raw]) return SIZE_MAP[raw];
    var s = String(raw).toLowerCase();
    if (/4 bedroom|and more|3 bedroom house/.test(s)) return "Large";
    if (/2 bedroom|3 bedroom|office/.test(s)) return "Medium";
    return "Small";
  }

  function cfBucket(cf) {
    if (cf == null || cf <= 0) return "Not Set";
    if (cf < 200) return "< 200 CF";
    if (cf < 400) return "200-399 CF";
    if (cf < 600) return "400-599 CF";
    if (cf < 800) return "600-799 CF";
    if (cf < 1000) return "800-999 CF";
    if (cf < 1500) return "1000-1499 CF";
    if (cf < 2000) return "1500-1999 CF";
    return "2000+ CF";
  }
  function callBucket(n) {
    if (!n) return "0 calls";
    if (n === 1) return "1 call";
    if (n <= 3) return "2-3 calls";
    if (n <= 5) return "4-5 calls";
    if (n <= 10) return "6-10 calls";
    return "10+ calls";
  }
  function smsBucket(n) {
    if (!n) return "0 SMS";
    if (n === 1) return "1 SMS";
    if (n <= 3) return "2-3 SMS";
    if (n <= 5) return "4-5 SMS";
    if (n <= 10) return "6-10 SMS";
    return "10+ SMS";
  }
  function respBucket(hours, kind) {
    var none = kind === "sms" ? "No outbound SMS" : "No outbound call";
    if (hours == null) return none;
    if (hours < 1) return "< 1 hr";
    if (hours < 4) return "1-4 hrs";
    if (hours < 24) return "4-24 hrs";
    if (hours < 72) return "1-3 days";
    return "3+ days";
  }

  /* ---- call/SMS classification (transparent, documented definitions) ------- */
  function isOutbound(dir) { return /out/i.test(dir || ""); }
  function callConnected(result, action) {
    var s = ((result || "") + " " + (action || "")).toLowerCase();
    return /connect|accept|answer|reply|completed/.test(s) &&
      !/missed|no answer|voicemail|busy|failed|hang/.test(s);
  }
  function callMissed(result, action) {
    var s = ((result || "") + " " + (action || "")).toLowerCase();
    return /missed|no answer|busy|failed|hang ?up|wrong number/.test(s);
  }
  function callVoicemail(result, action) {
    return /voice ?mail/i.test((result || "") + " " + (action || ""));
  }
  function durSec(v) {
    if (v == null || v === "") return 0;
    var s = String(v);
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s)); // already seconds
    var p = s.split(":").map(Number); // mm:ss or hh:mm:ss
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return Math.round(parseFloat(s) || 0);
  }

  /* ==========================================================================
     BUILDERS
     ========================================================================== */

  // shared base lead record from one moveboard row
  function baseLead(r) {
    var cd = toDate(col(r, "create_date"));
    var md = toDate(col(r, "move_date"));
    var status = String(col(r, "status") || "Unknown").trim();
    var srcRaw = String(col(r, "source") || "").trim();
    var sizeRaw = String(col(r, "size") || "").trim();
    return {
      id: String(col(r, "id") || ""),
      status: status,
      flag: String(col(r, "flag") || "").trim(),
      lead_score: intv(col(r, "lead_score")),
      service: String(col(r, "service") || "").trim(),
      sizeRaw: sizeRaw,
      customer: String(col(r, "customer") || "").trim(),
      moving_from: String(col(r, "moving_from") || "").trim(),
      moving_to: String(col(r, "moving_to") || "").trim(),
      phone: digits10(col(r, "phone")),
      source: srcNorm(srcRaw),
      srcRaw: srcRaw,
      rep: canonRep(col(r, "rep")),
      state: parseState(col(r, "moving_from")),
      cf: parseCF(r),
      quote_mid: quoteMid(r),
      closing: money(col(r, "closing")),
      _cd: cd,
      _md: md,
    };
  }

  // ---- Bad-Lead Intelligence (Moveboard) ----
  // Statuses the CRM treats as "bad" (matches the bad-lead snapshot universe).
  var BAD_STATUSES = ["Dead Lead", "Archive", "Spam", "We are not available"];
  function buildBadLeads(moveRows) {
    return (moveRows || [])
      .map(function (r) {
        var b = baseLead(r);
        var q = b.quote_mid;
        return {
          id: b.id,
          status: b.status || "Unknown",
          flag: b.flag || "No Flag",
          lead_score: b.lead_score,
          service: b.service || "Unknown",
          size: b.sizeRaw || "Unknown",
          move_date: iso(b._md),
          create_date: iso(b._cd),
          customer: b.customer,
          moving_from: b.moving_from,
          moving_to: b.moving_to,
          state: b.state,
          source: b.srcRaw ? b.srcRaw : "Unknown", // bad-leads shows raw-ish source
          rep: b.rep,
          cf: b.cf,
          quote_lo: q, quote_hi: q, quote_mid: q,
        };
      })
      .filter(function (x) {
        return (x.id || x.customer) && BAD_STATUSES.indexOf(x.status) >= 0;
      });
  }

  // ---- Lead Distribution (Moveboard) ----
  function buildLeadDist(moveRows) {
    var leads = (moveRows || [])
      .map(function (r) {
        var b = baseLead(r);
        if (!b.id && !b.customer) return null;
        var cd = b._cd;
        var h = cd ? cd.getHours() : null;
        return {
          id: b.id,
          cd: iso(cd),
          cdt: isoMin(cd),
          hour: h,
          shift: shiftOf(h),
          dow: cd ? DOW[cd.getDay()] : null,
          rep: b.rep,
          src: b.source,
          srcRaw: b.srcRaw,
          status: b.status,
          sg: statusGroup(b.status),
          size: sizeBucket(b.sizeRaw),
          sizeRaw: b.sizeRaw,
          state: b.state,
          svc: b.service,
          qmid: b.quote_mid,
          quoted: b.quote_mid != null,
          ct: b.closing || 0.0,
          cf: b.cf,
          md: iso(b._md),
        };
      })
      .filter(Boolean);
    var ds = leads.map(function (l) { return l.cd; }).filter(Boolean).sort();
    function uniqSort(key) {
      var s = {};
      leads.forEach(function (l) { if (l[key]) s[l[key]] = 1; });
      return Object.keys(s).sort();
    }
    return {
      meta: {
        generated: new Date().toISOString().slice(0, 16).replace("T", " "),
        sourceFile: "live bridge · moveboard",
        totalLeads: leads.length,
        dateMin: ds[0] || null,
        dateMax: ds[ds.length - 1] || null,
        reps: uniqSort("rep"),
        sources: uniqSort("src"),
        states: uniqSort("state"),
        sizes: ["Small", "Medium", "Large"],
        services: uniqSort("svc"),
      },
      leads: leads,
    };
  }

  // ---- MVD leads (Moveboard) ----
  function buildMvdLeads(moveRows) {
    return (moveRows || [])
      .map(function (r) {
        var b = baseLead(r);
        if (!b.id && !b.customer) return null;
        return {
          id: intv(b.id) != null ? intv(b.id) : b.id,
          status: b.status,
          flag: b.flag || "No Flag",
          source: b.srcRaw || "Unknown", // MVD groups by the raw lead source
          rep: b.rep,
          move_type: b.service,
          cf: b.cf || 0,
          cf_bucket: cfBucket(b.cf),
          size: b.sizeRaw,
          create_ym: ym(b._cd),
          create_month: monthLabel(b._cd),
          move_month: monthLabel(b._md),
          quote: b.quote_mid || 0,
          closing: b.closing || 0,
        };
      })
      .filter(Boolean);
  }

  // index calls / sms by customer phone (last 10 digits, either party)
  function indexComms(rows, cols, getParties) {
    var byPhone = {};
    (rows || []).forEach(function (r) {
      var parties = getParties(r, cols);
      var dt = toDate(parties.dt);
      var rec = { dir: parties.dir, dt: dt, raw: r };
      parties.phones.forEach(function (p) {
        if (!p) return;
        (byPhone[p] = byPhone[p] || []).push(rec);
      });
    });
    return byPhone;
  }
  function callParties(r) {
    return {
      phones: [digits10(pick(r, CALL_COLS.from)), digits10(pick(r, CALL_COLS.to))],
      dir: pick(r, CALL_COLS.direction),
      dt: (pick(r, CALL_COLS.date) + " " + pick(r, CALL_COLS.time)).trim(),
    };
  }
  function smsParties(r) {
    return {
      phones: [digits10(pick(r, SMS_COLS.sender)), digits10(pick(r, SMS_COLS.recipient))],
      dir: pick(r, SMS_COLS.direction),
      dt: pick(r, SMS_COLS.datetime),
    };
  }

  function aggCallsFor(recs, createDt) {
    var a = { total:0, connected:0, missed:0, voicemail:0, outgoing:0, incoming:0, dur:0, firstOut:null };
    (recs || []).forEach(function (c) {
      a.total++;
      var res = pick(c.raw, CALL_COLS.result), act = pick(c.raw, CALL_COLS.action);
      if (callConnected(res, act)) a.connected++;
      else if (callVoicemail(res, act)) a.voicemail++;
      else if (callMissed(res, act)) a.missed++;
      if (isOutbound(c.dir)) {
        a.outgoing++;
        if (c.dt && (!a.firstOut || c.dt < a.firstOut)) a.firstOut = c.dt;
      } else a.incoming++;
      a.dur += durSec(pick(c.raw, CALL_COLS.duration));
    });
    a.resp = a.firstOut && createDt ? (a.firstOut - createDt) / 3600000 : null;
    return a;
  }
  function aggSmsFor(recs, createDt) {
    var a = { total:0, outbound:0, inbound:0, firstOut:null };
    (recs || []).forEach(function (s) {
      a.total++;
      if (isOutbound(s.dir)) {
        a.outbound++;
        if (s.dt && (!a.firstOut || s.dt < a.firstOut)) a.firstOut = s.dt;
      } else a.inbound++;
    });
    a.resp = a.firstOut && createDt ? (a.firstOut - createDt) / 3600000 : null;
    return a;
  }

  // ---- CALL_LEADS (one row per lead, joined to calls + sms by phone) ----
  function buildCallLeads(moveRows, callRows, smsRows) {
    var callIdx = indexComms(callRows, CALL_COLS, callParties);
    var smsIdx = indexComms(smsRows, SMS_COLS, smsParties);
    return (moveRows || [])
      .map(function (r) {
        var b = baseLead(r);
        if (!b.phone) return null;
        var c = aggCallsFor(callIdx[b.phone], b._cd);
        var s = aggSmsFor(smsIdx[b.phone], b._cd);
        var hasCall = c.total > 0 ? 1 : 0, hasSms = s.total > 0 ? 1 : 0;
        return {
          phone: b.phone, status: b.status, rep: b.rep, source: b.srcRaw || "Unknown",
          move_type: b.service, create_month: monthLabel(b._cd), create_ym: ym(b._cd),
          quote: b.quote_mid || 0, closing: b.closing || 0,
          total_calls: c.total, connected: c.connected, missed: c.missed,
          voicemail: c.voicemail, outgoing: c.outgoing, incoming: c.incoming,
          dur_sec: c.dur, has_call: hasCall,
          call_bucket: callBucket(c.total), call_resp: respBucket(c.resp, "call"),
          total_sms: s.total, outbound_sms: s.outbound, inbound_sms: s.inbound,
          has_sms: hasSms, sms_bucket: smsBucket(s.total), sms_resp: respBucket(s.resp, "sms"),
          has_both: hasCall && hasSms ? 1 : 0,
          no_contact: !hasCall && !hasSms ? 1 : 0,
        };
      })
      .filter(Boolean);
  }

  // ---- CALL_META (aggregate dashboards) ----
  function buildCallMeta(moveRows, callRows, smsRows) {
    var callLeads = buildCallLeads(moveRows, callRows, smsRows);
    var monthly_calls = {}, result_counts = {}, rep_calls = {},
        call_bucket_counts = {}, call_resp_buckets = {}, status_call = {},
        monthly_sms = {}, rep_sms = {}, sms_bucket_counts = {},
        sms_resp_buckets = {}, status_sms = {};

    function mc(m) { return (monthly_calls[m] = monthly_calls[m] || { total:0, connected:0, missed:0, voicemail:0, outgoing:0, incoming:0, _cust:{} }); }
    function ms(m) { return (monthly_sms[m] = monthly_sms[m] || { total:0, outbound:0, inbound:0, delivered:0, _cust:{} }); }

    // raw call rows -> monthly + result_counts
    (callRows || []).forEach(function (c) {
      var dt = toDate((pick(c, CALL_COLS.date) + " " + pick(c, CALL_COLS.time)).trim());
      var m = monthLabel(dt) || "Unknown";
      var res = String(pick(c, CALL_COLS.result) || pick(c, CALL_COLS.action) || "Unknown").trim();
      result_counts[res] = (result_counts[res] || 0) + 1;
      var b = mc(m); b.total++;
      var act = pick(c, CALL_COLS.action);
      if (callConnected(res, act)) b.connected++;
      else if (callVoicemail(res, act)) b.voicemail++;
      else if (callMissed(res, act)) b.missed++;
      if (isOutbound(pick(c, CALL_COLS.direction))) b.outgoing++; else b.incoming++;
      var cust = digits10(pick(c, CALL_COLS.to)) || digits10(pick(c, CALL_COLS.from));
      if (cust) b._cust[cust] = 1;
    });
    (smsRows || []).forEach(function (s) {
      var dt = toDate(pick(s, SMS_COLS.datetime));
      var m = monthLabel(dt) || "Unknown";
      var b = ms(m); b.total++; b.delivered++;
      if (isOutbound(pick(s, SMS_COLS.direction))) b.outbound++; else b.inbound++;
      var cust = digits10(pick(s, SMS_COLS.recipient)) || digits10(pick(s, SMS_COLS.sender));
      if (cust) b._cust[cust] = 1;
    });
    Object.keys(monthly_calls).forEach(function (m) {
      var b = monthly_calls[m]; b.unique_customers = Object.keys(b._cust).length; delete b._cust;
    });
    Object.keys(monthly_sms).forEach(function (m) {
      var b = monthly_sms[m]; b.unique_customers = Object.keys(b._cust).length; delete b._cust;
    });

    // per-lead derived -> rep/bucket/status aggregates
    callLeads.forEach(function (l) {
      call_bucket_counts[l.call_bucket] = (call_bucket_counts[l.call_bucket] || 0) + 1;
      call_resp_buckets[l.call_resp] = (call_resp_buckets[l.call_resp] || 0) + 1;
      sms_bucket_counts[l.sms_bucket] = (sms_bucket_counts[l.sms_bucket] || 0) + 1;
      sms_resp_buckets[l.sms_resp] = (sms_resp_buckets[l.sms_resp] || 0) + 1;
      var sc = (status_call[l.status] = status_call[l.status] || { with_call:0, no_call:0 });
      l.has_call ? sc.with_call++ : sc.no_call++;
      var ss = (status_sms[l.status] = status_sms[l.status] || { with_sms:0, no_sms:0 });
      l.has_sms ? ss.with_sms++ : ss.no_sms++;
      if (l.total_calls) {
        var rc = (rep_calls[l.rep] = rep_calls[l.rep] || { total:0, connected:0, missed:0, voicemail:0, by_month:{} });
        rc.total += l.total_calls; rc.connected += l.connected; rc.missed += l.missed; rc.voicemail += l.voicemail;
        if (l.create_month) rc.by_month[l.create_month] = (rc.by_month[l.create_month] || 0) + l.total_calls;
      }
      if (l.total_sms) {
        var rs = (rep_sms[l.rep] = rep_sms[l.rep] || { total:0, outbound:0, inbound:0, unique_customers:0, by_month:{} });
        rs.total += l.total_sms; rs.outbound += l.outbound_sms; rs.inbound += l.inbound_sms; rs.unique_customers++;
        if (l.create_month) rs.by_month[l.create_month] = (rs.by_month[l.create_month] || 0) + l.total_sms;
      }
    });

    var totals_calls = {
      total_matched: (callRows || []).length,
      leads_with_calls: callLeads.filter(function (l) { return l.has_call; }).length,
      leads_no_calls: callLeads.filter(function (l) { return !l.has_call; }).length,
      connected: sum(callLeads, "connected"), missed: sum(callLeads, "missed"),
      voicemail: sum(callLeads, "voicemail"),
    };
    var totals_sms = {
      total_matched: (smsRows || []).length,
      leads_with_sms: callLeads.filter(function (l) { return l.has_sms; }).length,
      leads_no_sms: callLeads.filter(function (l) { return !l.has_sms; }).length,
      outbound: sum(callLeads, "outbound_sms"), inbound: sum(callLeads, "inbound_sms"),
      delivered: sum(callLeads, "total_sms"),
    };
    var totals_combined = {
      has_both: callLeads.filter(function (l) { return l.has_both; }).length,
      call_only: callLeads.filter(function (l) { return l.has_call && !l.has_sms; }).length,
      sms_only: callLeads.filter(function (l) { return l.has_sms && !l.has_call; }).length,
      no_contact: callLeads.filter(function (l) { return l.no_contact; }).length,
    };
    return {
      monthly_calls: monthly_calls, result_counts: sortObj(result_counts), rep_calls: rep_calls,
      call_bucket_counts: call_bucket_counts, call_resp_buckets: call_resp_buckets, status_call: status_call,
      monthly_sms: monthly_sms, rep_sms: rep_sms, sms_bucket_counts: sms_bucket_counts,
      sms_resp_buckets: sms_resp_buckets, status_sms: status_sms,
      totals_calls: totals_calls, totals_sms: totals_sms, totals_combined: totals_combined,
    };
  }
  function sum(arr, k) { return arr.reduce(function (a, x) { return a + (x[k] || 0); }, 0); }
  function sortObj(o) {
    return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })
      .reduce(function (n, k) { n[k] = o[k]; return n; }, {});
  }

  /* ==========================================================================
     HATCH ↔ CRM RECONCILIATION  (hatch + moveboard + angi_leads)
     Two-stage match: exact name (stage 1), then phone last-10 on the leftovers.
     Column names below are best-effort aliases for the bridge's hatch/angi
     tables — adjust here if a field is empty after the first live load.
     ========================================================================== */
  var HATCH_COLS = {
    name: ["contactname", "name"],
    phone: ["phone", "phonenumber", "mobile", "cell"],
    source: ["currentoppsource", "oppsource", "leadsource", "source", "provider"],
    status: ["campaigncurrentstatus", "currentstatus", "campaignstatus", "status"],
    launched: ["launchedatminute", "launchedat", "launched"],
    org: ["organizationname", "organization"],
    campaign: ["campaignname", "campaign"],
  };
  var ANGI_COLS = {
    lead: ["leadnumber", "lead", "leadid"],
    status: ["leadstatus", "status"],
    first: ["customerfirstname", "firstname"],
    last: ["customerlastname", "lastname"],
    phone: ["phone", "phonenumber"],
    email: ["email"],
    city: ["city"],
    state: ["state"],
    date: ["leaddate", "date"],
  };
  function provNorm(raw) {
    var s = String(raw || "").toLowerCase();
    if (s.indexOf("yelp") >= 0) return "Yelp";
    if (s.indexOf("angi") >= 0) return "Angi";
    if (s.indexOf("thumbtack") >= 0) return "Thumbtack";
    if (/meta|facebook|instagram|\bfb\b/.test(s)) return "Meta";
    if (s.indexOf("google") >= 0) return "Google";
    return raw ? String(raw).trim() : "Unknown";
  }
  function nameKey(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  var CRM_STATUS_ORDER = ["Confirmed", "Pending", "Not Confirmed", "Date Pending",
    "We are not available", "Archive", "Expired", "Dead Lead"];

  function buildHatchRecon(hatchRows, moveRows, angiRows) {
    // ---- CRM (moveboard) indexes by normalized name and phone last-10 ----
    var crmByName = {}, crmByPhone = {};
    (moveRows || []).forEach(function (r) {
      var rec = { name: String(col(r, "customer") || "").trim(),
        status: String(col(r, "status") || "").trim(),
        src: String(col(r, "source") || "").trim() };
      var nm = nameKey(rec.name), ph = digits10(col(r, "phone"));
      if (nm) (crmByName[nm] = crmByName[nm] || []).push(rec);
      if (ph) (crmByPhone[ph] = crmByPhone[ph] || []).push(rec);
    });
    // ---- Hatch contacts (+ indexes for the Angi audit) ----
    var hatchByName = {}, hatchByPhone = {};
    var contacts = (hatchRows || []).map(function (r) {
      var nm = String(pick(r, HATCH_COLS.name) || "").trim();
      var ph = digits10(pick(r, HATCH_COLS.phone));
      var c = { name: nm, phone: String(pick(r, HATCH_COLS.phone) || "").trim(), phoneKey: ph,
        prov: provNorm(pick(r, HATCH_COLS.source)),
        hatch: String(pick(r, HATCH_COLS.status) || "").trim().toLowerCase(),
        launched: String(pick(r, HATCH_COLS.launched) || "").trim() };
      if (nameKey(nm)) (hatchByName[nameKey(nm)] = hatchByName[nameKey(nm)] || []).push(c);
      if (ph) (hatchByPhone[ph] = hatchByPhone[ph] || []).push(c);
      return c;
    });

    // ---- two-stage match ----
    var matched = [], found = [], still = [];
    contacts.forEach(function (c) {
      var nk = nameKey(c.name);
      var nh = nk ? crmByName[nk] : null;
      if (nh && nh.length) {
        var m = nh[0];
        matched.push({ name: c.name, prov: c.prov, phone: c.phone, hatch: c.hatch, by: "Name",
          crmName: m.name, crm: m.status, src: m.src, leads: String(nh.length) });
        return;
      }
      var ph = c.phoneKey ? crmByPhone[c.phoneKey] : null;
      if (ph && ph.length) {
        var p = ph[0];
        matched.push({ name: c.name, prov: c.prov, phone: c.phone, hatch: c.hatch, by: "Phone",
          crmName: p.name, crm: p.status, src: p.src, leads: String(ph.length) });
        found.push({ name: c.name, prov: c.prov, phone: c.phone, hatch: c.hatch,
          crmName: p.name, diff: "Yes", crm: p.status, src: p.src });
        return;
      }
      still.push({ name: c.name, prov: c.prov, phone: c.phone, hatch: c.hatch,
        reason: c.phoneKey ? "Phone not in CRM" : "No phone in Hatch", launched: c.launched });
    });

    // ---- provider rollup ----
    var pa = {};
    contacts.forEach(function (c) {
      var a = pa[c.prov] = pa[c.prov] || { prov: c.prov, contacts: 0, replied: 0, byname: 0, byphone: 0, incrm: 0, still: 0 };
      a.contacts++;
      if (/^repl/.test(c.hatch)) a.replied++; // "replied" but not "no reply"
    });
    matched.forEach(function (m) { var a = pa[m.prov]; if (!a) return; if (m.by === "Name") a.byname++; else a.byphone++; a.incrm++; });
    still.forEach(function (s) { var a = pa[s.prov]; if (a) a.still++; });
    var provider = Object.keys(pa).map(function (k) { return pa[k]; }).sort(function (a, b) { return b.contacts - a.contacts; });

    // ---- CRM-status breakdown of matched (v = count, ph = matched-by-phone) ----
    var bd = {};
    matched.forEach(function (m) { var b = bd[m.crm] = bd[m.crm] || { k: m.crm, v: 0, ph: 0 }; b.v++; if (m.by === "Phone") b.ph++; });
    var crmbd = Object.keys(bd).sort(function (a, b) {
      var ia = CRM_STATUS_ORDER.indexOf(a), ib = CRM_STATUS_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).map(function (k) { return bd[k]; });

    // ---- reasons + confirmed ----
    var rc = { "No phone in Hatch": 0, "Phone not in CRM": 0 };
    still.forEach(function (s) { rc[s.reason] = (rc[s.reason] || 0) + 1; });
    var reasons = [{ k: "No phone in Hatch", v: rc["No phone in Hatch"] }, { k: "Phone not in CRM", v: rc["Phone not in CRM"] }];
    var confirmed = matched.filter(function (m) { return m.crm === "Confirmed"; }).length;

    // ---- Angi audit: Angi leads NOT in CRM, flagged by Hatch presence ----
    var angiRowsOut = [], inCrm = 0;
    (angiRows || []).forEach(function (r) {
      var nm = (String(pick(r, ANGI_COLS.first) || "").trim() + " " + String(pick(r, ANGI_COLS.last) || "").trim()).trim();
      var ph = digits10(pick(r, ANGI_COLS.phone));
      var isInCrm = (ph && crmByPhone[ph]) || (nameKey(nm) && crmByName[nameKey(nm)]);
      if (isInCrm) { inCrm++; return; }
      var inHatch = (ph && hatchByPhone[ph]) || (nameKey(nm) && hatchByName[nameKey(nm)]);
      var city = String(pick(r, ANGI_COLS.city) || "").trim(), st = String(pick(r, ANGI_COLS.state) || "").trim();
      angiRowsOut.push({ lead: String(pick(r, ANGI_COLS.lead) || ""), name: nm,
        phone: String(pick(r, ANGI_COLS.phone) || "").trim(), email: String(pick(r, ANGI_COLS.email) || "").trim(),
        loc: (city && st) ? (city + ", " + st) : (city || st || ""), status: String(pick(r, ANGI_COLS.status) || "").trim(),
        hatch: inHatch ? "In Hatch" : "In neither", neither: !inHatch });
    });
    var total = (angiRows || []).length;
    var angi = { total: total, in_crm: inCrm, not_in_crm: total - inCrm,
      in_hatch_of_notin: angiRowsOut.filter(function (r) { return !r.neither; }).length,
      neither: angiRowsOut.filter(function (r) { return r.neither; }).length, rows: angiRowsOut };

    return { matched: matched, found: found, still: still, provider: provider,
      crmbd: crmbd, reasons: reasons, confirmed: confirmed, angi: angi };
  }

  /* ==========================================================================
     BOOKED JOBS from moveboard (full-year, live)  ->  the bookings[] shape the
     Operations + Executive Overview native views already render.
     "Booked" = CRM Status starts with "Conf" (Confirmed). Filter by move-date year.
     ========================================================================== */
  function buildBookings(moveRows, opts) {
    opts = opts || {};
    var year = opts.year || null; // e.g. 2026 to keep only that year's move dates
    var out = [];
    (moveRows || []).forEach(function (r) {
      var status = String(col(r, "status") || "").trim();
      if (!/^conf/i.test(status)) return; // booked jobs only
      var md = toDate(col(r, "move_date"));
      if (!md) return;
      if (year && md.getFullYear() !== year) return;
      var frm = parseState(col(r, "moving_from")); if (frm === "Unknown") frm = "";
      var to = parseState(col(r, "moving_to")); if (to === "Unknown") to = "";
      var cash = money(col(r, "closing"));
      if (cash == null) cash = money(pick(r, ["grandtotalbycash", "cashtotal", "cash"]));
      var card = money(pick(r, ["grandtotalbycard", "cardtotal", "card"]));
      out.push({
        id: String(col(r, "id") || ""), date: iso(md), time: "",
        customer: String(col(r, "customer") || "").trim(),
        from_state: frm, to_state: to,
        route: (frm && to) ? (frm + "→" + to) : (frm || to || "—"),
        interstate: !!(frm && to && frm !== to),
        rep: canonRep(col(r, "rep")), source: srcNorm(col(r, "source")),
        move_type: String(col(r, "service") || "").trim() || "Local Moving", job_type: "",
        cf: parseCF(r), crew: intv(pick(r, ["crewsize", "crew"])),
        cash_total: cash, card_total: card, deposit: money(pick(r, ["deposit"])),
        job_code: "", request_id: String(col(r, "id") || ""), status: "confirmed",
      });
    });
    out.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    return out;
  }

  /* ---- load the official translator tables into _TR ------------------------
     sales_translator: ORIGINAL SALES NAME -> SALES NICKNAME (rep)
     source_correction: Original Source -> Source (lead source)
     status_translator: STATUS -> TYPE CATEGORY (Confirmed / Bad Lead / Incoming Lead) */
  function _buildTr(rows, rawAliases, valAliases, cleanNum) {
    var m = {};
    (rows || []).forEach(function (r) {
      var raw = String(pick(r, rawAliases) || "").trim();
      var val = String(pick(r, valAliases) || "").trim();
      if (cleanNum) val = cleanNick(val);
      if (raw && val) m[trKey(raw)] = val;
    });
    return Object.keys(m).length ? m : null;
  }
  function setTranslators(t) {
    t = t || {};
    if (t.sales) _TR.rep = _buildTr(t.sales, ["originalsalesname"], ["salesnickname"], true);
    if (t.source) _TR.source = _buildTr(t.source, ["originalsource"], ["source"], false);
    if (t.status) _TR.status = _buildTr(t.status, ["statustype", "status"], ["category", "typecategory"], false);
    return _TR;
  }
  // official status category (Confirmed / Bad Lead / Incoming Lead); null if unmapped/not loaded
  function statusCategory(raw) { if (_TR.status) { var v = _TR.status[trKey(raw)]; if (v) return v; } return null; }

  // month list + rep list derived from data (so the UI rolls forward)
  function monthsFrom(leads, key) {
    var seen = {};
    leads.forEach(function (l) { if (l[key]) seen[l[key]] = 1; });
    return Object.keys(seen).sort(function (a, b) {
      return new Date("1 " + a) - new Date("1 " + b);
    });
  }
  function repsFrom(map) {
    return Object.keys(map).sort(function (a, b) { return (map[b].total || 0) - (map[a].total || 0); });
  }

  return {
    COLS: COLS, CALL_COLS: CALL_COLS, SMS_COLS: SMS_COLS, BAD_STATUSES: BAD_STATUSES,
    pick: pick, pickLoose: pickLoose, col: col,
    money: money, numv: numv, intv: intv, digits10: digits10, parseCF: parseCF, quoteMid: quoteMid,
    parseState: parseState, toDate: toDate, iso: iso, isoMin: isoMin, ym: ym, monthLabel: monthLabel,
    shiftOf: shiftOf, canonRep: canonRep, srcNorm: srcNorm, statusGroup: statusGroup,
    sizeBucket: sizeBucket, cfBucket: cfBucket, callBucket: callBucket, smsBucket: smsBucket, respBucket: respBucket,
    baseLead: baseLead,
    buildBadLeads: buildBadLeads, buildLeadDist: buildLeadDist, buildMvdLeads: buildMvdLeads,
    buildCallLeads: buildCallLeads, buildCallMeta: buildCallMeta,
    monthsFrom: monthsFrom, repsFrom: repsFrom,
    HATCH_COLS: HATCH_COLS, ANGI_COLS: ANGI_COLS, provNorm: provNorm, nameKey: nameKey,
    buildHatchRecon: buildHatchRecon, buildBookings: buildBookings,
    setTranslators: setTranslators, statusCategory: statusCategory,
  };
});
