/* ============================================================================
   ZTZ LIVE BRIDGE — sign-in gate + read-only data client
   ----------------------------------------------------------------------------
   Repoints the platform's analytical modules from bundled snapshots to the live
   "bridge" API (one centralized DB, refreshed ~every 6h, read-only, sign-in
   gated). See the data owner's USE-THE-DATA-BRIDGE spec for the contract.

   HOW IT WORKS
     • This file runs at the TOP LEVEL (index.html). It puts a full-screen
       sign-in gate over the whole app: nothing renders until the viewer signs
       in with an @ziptozipmoving.com Google account (anyone else => the bridge
       returns 403). This satisfies "no data without sign-in".
     • After sign-in it exposes window.ZTZ_BRIDGE.get(table, params) which calls
         GET <BASE>/api/<table>   with  Authorization: Bearer <google_id_token>
       and returns the rows. The page never holds DB credentials; the bridge is
       read-only.
     • The deep-dive dashboards are same-origin iframes, so they fetch live data
       through  window.parent.ZTZ_BRIDGE.get(...)  — one sign-in covers them all.

   NOTHING IS CACHED to disk (live-only, and rows carry PII — don't persist).

   IF SIGN-IN FAILS WITH AN ORIGIN ERROR: the page's origin must be on the
   bridge's allow-list. This project publishes to https://marymd84.github.io,
   which is already allowed. A different origin must be added by the data owner.
   ========================================================================== */
(function () {
  "use strict";

  // ---- the two values from the bridge spec (section 2) ----------------------
  var BASE = "https://ztz-bridge-32168089642.us-east4.run.app";
  var CLIENT_ID =
    "32168089642-fkk3rglncf6hl5ikq7pi6jbornug1kbb.apps.googleusercontent.com";
  var ALLOWED_DOMAIN = "ziptozipmoving.com";

  var token = null; // Google ID token (JWT)
  var email = null;
  var readyCbs = [];

  // ---- tiny helpers ---------------------------------------------------------
  function decodeJwt(jwt) {
    try {
      var p = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) {
      return {};
    }
  }

  function buildQuery(params) {
    if (!params) return "";
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === "") return;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  /* --------------------------------------------------------------------------
     Public data call. Returns a Promise resolving to:
        { table, count, truncated, rows:[ {col:val,...}, ... ] }
     `params` may include: limit, since (YYYY-MM-DD), since_col (column name).
     Pull only what you need — some tables are large.
     -------------------------------------------------------------------------- */
  function get(table, params) {
    if (!token) return Promise.reject(new Error("Not signed in"));
    var url = BASE + "/api/" + table + buildQuery(params);
    return fetch(url, { headers: { Authorization: "Bearer " + token } }).then(
      function (r) {
        if (r.status === 401 || r.status === 403) {
          // token expired or wrong account — force a fresh sign-in
          token = null;
          showGate(
            r.status === 403
              ? "That account isn't a @" +
                  ALLOWED_DOMAIN +
                  " account. Sign in with your company account."
              : "Your session expired. Please sign in again."
          );
          throw new Error("HTTP " + r.status);
        }
        if (!r.ok)
          return r.text().then(function (t) {
            throw new Error("HTTP " + r.status + ": " + t);
          });
        return r.json();
      }
    );
  }

  // Convenience: resolve straight to the rows array.
  function rows(table, params) {
    return get(table, params).then(function (d) {
      if (d && d.truncated)
        console.warn(
          "[ZTZ_BRIDGE] /api/" +
            table +
            " hit the row ceiling (truncated). Consider a tighter `since`/`limit`."
        );
      return (d && d.rows) || [];
    });
  }

  function onReady(cb) {
    if (token) cb();
    else readyCbs.push(cb);
  }
  function fireReady() {
    var cbs = readyCbs.slice();
    readyCbs.length = 0;
    cbs.forEach(function (cb) {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  window.ZTZ_BRIDGE = {
    BASE: BASE,
    get: get,
    rows: rows,
    onReady: onReady,
    isReady: function () {
      return !!token;
    },
    email: function () {
      return email;
    },
  };

  /* ==========================================================================
     SIGN-IN GATE  (top-level page only)
     ========================================================================== */
  var gateEl = null;

  function ensureGate() {
    if (gateEl) return gateEl;
    var g = document.createElement("div");
    g.id = "ztzGate";
    g.innerHTML =
      '<div class="ztzGate-card">' +
      '<div class="ztzGate-mark">ZZ</div>' +
      '<div class="ztzGate-name">Zip To Zip Moving</div>' +
      '<div class="ztzGate-product">Reporting Platform</div>' +
      '<div class="ztzGate-msg" id="ztzGateMsg">Sign in with your <b>@' +
      ALLOWED_DOMAIN +
      "</b> Google account to view live reporting.</div>" +
      '<div id="ztzGateBtn" class="ztzGate-btn"></div>' +
      '<div class="ztzGate-foot">Read-only · company accounts only · data is live from the bridge</div>' +
      "</div>";
    var css = document.createElement("style");
    css.textContent =
      "#ztzGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "background:linear-gradient(135deg,#0f2742,#1a56a4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
      ".ztzGate-card{background:#fff;border-radius:16px;padding:40px 44px;max-width:380px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35)}" +
      ".ztzGate-mark{width:56px;height:56px;border-radius:14px;background:#1a56a4;color:#fff;font-weight:800;font-size:22px;" +
      "display:flex;align-items:center;justify-content:center;margin:0 auto 16px}" +
      ".ztzGate-name{font-size:20px;font-weight:700;color:#0f172a}" +
      ".ztzGate-product{font-size:13px;color:#64748b;margin-bottom:18px}" +
      ".ztzGate-msg{font-size:13.5px;color:#334155;line-height:1.6;margin-bottom:20px}" +
      ".ztzGate-btn{display:flex;justify-content:center;min-height:44px}" +
      ".ztzGate-foot{font-size:11px;color:#94a3b8;margin-top:18px}" +
      ".ztzGate-err{color:#b3261e;font-weight:600}" +
      "body.ztz-locked .app{visibility:hidden!important}";
    document.head.appendChild(css);
    document.body.appendChild(g);
    gateEl = g;
    return g;
  }

  function showGate(message) {
    var g = ensureGate();
    g.style.display = "flex";
    if (message) {
      var m = document.getElementById("ztzGateMsg");
      if (m) {
        m.classList.add("ztzGate-err");
        m.textContent = message;
      }
    }
    document.body.classList.add("ztz-locked");
    // (re)render the Google button
    renderButton();
  }

  function hideGate() {
    if (gateEl) gateEl.style.display = "none";
    document.body.classList.remove("ztz-locked");
  }

  function onCredential(resp) {
    var jwt = resp && resp.credential;
    if (!jwt) return;
    var claims = decodeJwt(jwt);
    // client-side domain check for a friendly message; the bridge enforces it too
    if (claims.hd !== ALLOWED_DOMAIN && !/@ziptozipmoving\.com$/i.test(claims.email || "")) {
      showGate(
        "That account isn't a @" +
          ALLOWED_DOMAIN +
          " account. Use your company Google account."
      );
      return;
    }
    token = jwt;
    email = claims.email || null;
    hideGate();
    fireReady();
  }

  var gisPolls = 0;
  function renderButton() {
    if (!(window.google && google.accounts && google.accounts.id)) {
      if (gisPolls++ < 100) return setTimeout(renderButton, 100);
      return;
    }
    try {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: onCredential,
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      var host = document.getElementById("ztzGateBtn");
      if (host) {
        host.innerHTML = "";
        google.accounts.id.renderButton(host, {
          theme: "filled_blue",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 260,
        });
      }
      // also offer One Tap for returning users
      google.accounts.id.prompt();
    } catch (e) {
      console.error("[ZTZ_BRIDGE] GIS init failed", e);
    }
  }

  function init() {
    // Only the top-level shell renders the gate. (Iframed modules reuse the
    // parent's token via window.parent.ZTZ_BRIDGE.)
    if (window.top !== window.self) return;
    showGate();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
