/* ============================================================================
   LIVE DATA LAYER — Google OAuth (Identity Services) + Calendar/Sheets REST
   ----------------------------------------------------------------------------
   Progressive enhancement on top of the bundled snapshot:
     • opened as a local file, or no clientId  -> snapshot (data/bookings.js)
     • published to https with a clientId       -> "Connect Google", then live
   After the first authorization the page re-authorizes silently on open, so it
   auto-updates. The booked-jobs parser here mirrors data/build_bookings.py so
   live data and the seed are identical in shape.
   ========================================================================== */
(function(){
  "use strict";
  var CFG = window.ZTZ_LIVE_CONFIG || {};
  var SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets.readonly";
  var tokenClient=null, accessToken=null, state="idle";
  var $=function(s){return document.querySelector(s)};
  var nf=new Intl.NumberFormat('en-US');

  /* ---------- parser (ported from build_bookings.py) ---------- */
  var US=("AL AK AZ AR CA CO CT DC DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" ");
  var REPMAP={george:"George Davis",goglik:"George Davis",alanna:"Alanna Brown",alex:"Alex Koval",
    amy:"Amy Olsson",daniella:"Daniella Pelowski",david:"David Barta",eli:"Eli Kane",lisa:"Lisa Leman",
    lucas:"Lucas Ruiz Estapé",maya:"Maya Zoric",nick:"Nick Haas"};
  function stripTags(s){return (s||"").replace(/<[^>]+>/g,"").trim();}
  function grab(desc,label){
    var re=new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*:\\s*([\\s\\S]*?)(?:<br\\s*/?>|</div>|</p>|\\n|$)","i");
    var m=re.exec(desc); return m?stripTags(m[1]):"";
  }
  function canonRep(raw){ if(!raw)return"Unassigned"; var r=stripTags(raw).toLowerCase().split("/")[0].split("&")[0].split(",")[0].trim();
    for(var k in REPMAP){if(r.indexOf(k)===0)return REPMAP[k];} return raw.trim()?(raw.trim().charAt(0).toUpperCase()+raw.trim().slice(1)):"Unassigned"; }
  function normSource(raw){ if(!raw)return"Unknown"; var s=raw.trim().toLowerCase();
    if(s.indexOf("request #")>=0||s.indexOf("job code")>=0)return"Unknown";
    if(s.indexOf("google")>=0)return"Google"; if(s.indexOf("yelp")>=0)return"Yelp"; if(s.indexOf("angi")>=0)return"Angi";
    if(s.indexOf("thumbtack")>=0)return"Thumbtack"; if(s.indexOf("facebook")>=0||s.indexOf("social")>=0)return"Facebook/Social";
    if(s.indexOf("reddit")>=0)return"Reddit"; if(s.indexOf("chatgpt")>=0||s.indexOf("ai search")>=0||s.indexOf("openai")>=0||s.indexOf("ai")===0)return"AI Search";
    if(s.indexOf("return")>=0||s.indexOf("repeat")>=0)return"Returning Customer";
    if(s.indexOf("recommend")>=0||s.indexOf("referr")>=0||s.indexOf("friend")>=0)return"Referral";
    if(s.indexOf("website")>=0||s.indexOf("web ")>=0||s==="web")return"Website";
    if(s.indexOf("moveboard")>=0)return"Moveboard"; if(s.indexOf("post card")>=0||s.indexOf("postcard")>=0)return"Postcard";
    if(s==="cl"||s.indexOf("craigslist")>=0)return"Craigslist"; if(s.indexOf("truck")>=0)return"Saw Our Truck";
    return raw.trim().charAt(0).toUpperCase()+raw.trim().slice(1); }
  function money(s){ if(!s)return null; var m=(""+s).replace(/\$/g,"").match(/-?[\d,]*\.?\d+/); return m?parseFloat(m[0].replace(/,/g,"")):null; }
  function num(s){ if(s==null||s==="")return null; var m=(""+s).match(/-?\d[\d,]*\.?\d*/); return m?parseFloat(m[0].replace(/,/g,"")):null; }
  function stateOf(addr){ if(!addr)return""; var toks=addr.match(/\b[A-Z]{2}\b/g)||[]; for(var i=toks.length-1;i>=0;i--){if(US.indexOf(toks[i])>=0)return toks[i];} return""; }
  function parseEvents(items){
    var out=[];
    (items||[]).forEach(function(e){
      var desc=e.description||""; var st=e.start||{}; var dt=st.dateTime||st.date||""; var day=dt.slice(0,10);
      var frm=grab(desc,"Moving From"), to=grab(desc,"Moving To"); var fs=stateOf(frm), ts=stateOf(to);
      out.push({ id:e.id||"", date:day, time:(dt.indexOf("T")>=0?dt.slice(11,16):""),
        customer:grab(desc,"Customer Name")||"", from_state:fs, to_state:ts,
        route:(fs&&ts)?(fs+"→"+ts):(fs||ts||"—"), interstate:!!(fs&&ts&&fs!==ts),
        rep:canonRep(grab(desc,"Sales Rep 1")), source:normSource(grab(desc,"Source")),
        move_type:grab(desc,"Moving Type")||"", job_type:grab(desc,"Job Type")||"",
        cf:num(grab(desc,"Total CF")), crew:num(grab(desc,"Crew Size")),
        cash_total:money(grab(desc,"Grand Total by Cash")), card_total:money(grab(desc,"Grand Total by Card")),
        deposit:money(grab(desc,"Deposit")), job_code:grab(desc,"Job Code")||"", request_id:grab(desc,"Request #")||"",
        status:e.status||"" });
    });
    out.sort(function(a,b){return (a.date+a.time)<(b.date+b.time)?-1:1;});
    return out;
  }
  function aggregate(rows){
    var cash=0,card=0,cf=0,inter=0; rows.forEach(function(r){cash+=r.cash_total||0;card+=r.card_total||0;cf+=r.cf||0;if(r.interstate)inter++;});
    function cnt(key){var m={};rows.forEach(function(r){var k=r[key]||"—";m[k]=(m[k]||0)+1;});
      return Object.keys(m).sort(function(a,b){return m[b]-m[a]}).reduce(function(o,k){o[k]=m[k];return o},{});}
    var by_day={};rows.forEach(function(r){var b=by_day[r.date]||(by_day[r.date]={jobs:0,cf:0,cash:0,card:0});b.jobs++;b.cf+=r.cf||0;b.cash+=r.cash_total||0;b.card+=r.card_total||0;});
    var by_rep={};var reps={};rows.forEach(function(r){reps[r.rep]=1});
    Object.keys(reps).forEach(function(rep){var rr=rows.filter(function(r){return r.rep===rep});var c=0,d=0,f=0;rr.forEach(function(r){c+=r.cash_total||0;d+=r.card_total||0;f+=r.cf||0;});by_rep[rep]={jobs:rr.length,cf:Math.round(f),cash:Math.round(c),card:Math.round(d)};});
    var n=rows.length||1; var today=new Date().toISOString().slice(0,10);
    var trows=rows.filter(function(r){return r.date===today}); if(!trows.length&&rows.length)trows=rows.filter(function(r){return r.date===rows[0].date});
    var tc=0,td=0,tf=0;trows.forEach(function(r){tc+=r.cash_total||0;td+=r.card_total||0;tf+=r.cf||0;});
    return { generated:new Date().toISOString().slice(0,16), window_start:rows.length?rows[0].date:"", window_end:rows.length?rows[rows.length-1].date:"",
      jobs:rows.length, cf_total:Math.round(cf), cash_total:Math.round(cash), card_total:Math.round(card),
      avg_cf:Math.round(cf/n), avg_cash:Math.round(cash/n), interstate_pct:Math.round(100*inter/n),
      by_source:cnt("source"), by_rep:by_rep, by_route:cnt("route"), by_movetype:cnt("move_type"), by_day:by_day,
      today_date:trows.length?trows[0].date:today, today_jobs:trows.length, today_cf:Math.round(tf), today_cash:Math.round(tc), today_card:Math.round(td) };
  }

  /* ---------- UI control in the topbar ---------- */
  function ctl(html){ var c=$('#livectl'); if(c)c.innerHTML=html; }
  function render(){
    var t;
    if(state==="live"){ t='<span class="badge live"><span class="pulse"></span> Live · '+(window.__ztzSync||'')+'</span> <button class="chip ghost" id="ztzRefresh">Refresh</button>'; }
    else if(state==="loading"){ t='<span class="badge snap">Syncing…</span>'; }
    else if(state==="ready"){ t='<button class="chip" id="ztzConnect">🔗 Connect Google</button>'; }
    else if(state==="cached"){ t='<span class="badge snap">Live cache · '+(window.__ztzSync||'')+'</span> <button class="chip" id="ztzConnect">Refresh live</button>'; }
    else if(state==="error"){ t='<span class="badge" style="background:#fbe9e9;color:#b3261e">Sync failed</span> <button class="chip ghost" id="ztzConnect">Retry</button>'; }
    else { t='<span class="badge snap" title="Open from GitHub Pages and add an OAuth client ID to go live">Snapshot</span>'; }
    ctl(t);
    var cn=$('#ztzConnect'); if(cn)cn.onclick=function(){connect();};
    var rf=$('#ztzRefresh'); if(rf)rf.onclick=function(){refresh();};
  }
  function setState(s){state=s;render();}

  /* ---------- cache ---------- */
  function saveCache(rows,meta){ try{localStorage.setItem('ztz_live',JSON.stringify({rows:rows,meta:meta,ts:Date.now()}));}catch(e){} }
  function loadCache(){ try{var j=JSON.parse(localStorage.getItem('ztz_live')||'null');
    if(j&&j.rows&&j.rows.length){ apply(j.rows,j.meta); window.__ztzSync=new Date(j.ts).toLocaleString(); return true; } }catch(e){} return false; }

  function apply(rows,meta){ if(window.ZTZ_SHELL){window.ZTZ_SHELL.setBookings(rows,meta);window.ZTZ_SHELL.rerender();} }

  /* ---------- Google Identity Services ---------- */
  function gisReady(cb){ var n=0; (function poll(){ if(window.google&&google.accounts&&google.accounts.oauth2)return cb(true);
    if(n++>50)return cb(false); setTimeout(poll,100); })(); }
  function initToken(){ if(tokenClient)return true;
    tokenClient=google.accounts.oauth2.initTokenClient({ client_id:CFG.clientId, scope:SCOPES, callback:onToken,
      error_callback:function(){ if(state==="loading")setState(loadCacheExists()?"cached":"ready"); } });
    return true; }
  function onToken(resp){ if(resp&&resp.access_token){ accessToken=resp.access_token; fetchCalendar(); }
    else { setState(loadCacheExists()?"cached":"ready"); } }
  function loadCacheExists(){ try{return !!JSON.parse(localStorage.getItem('ztz_live')||'null');}catch(e){return false;} }

  function connect(){ if(!CFG.clientId){setState("snapshot");return;} setState("loading");
    gisReady(function(ok){ if(!ok){setState("error");return;} initToken(); tokenClient.requestAccessToken({prompt:'consent'}); }); }
  function refresh(){ if(accessToken){fetchCalendar();} else {connect();} }
  function trySilent(){ gisReady(function(ok){ if(!ok){setState("ready");return;} initToken(); try{tokenClient.requestAccessToken({prompt:'none'});}catch(e){setState("ready");} }); }

  /* ---------- live fetch ---------- */
  function fetchCalendar(){
    setState("loading");
    var now=Date.now();
    var tmin=new Date(now-(CFG.windowDaysBack||3)*864e5).toISOString();
    var tmax=new Date(now+(CFG.windowDaysFwd||21)*864e5).toISOString();
    var url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(CFG.calendarId)+
      "/events?singleEvents=true&orderBy=startTime&maxResults="+(CFG.maxResults||250)+
      "&timeMin="+encodeURIComponent(tmin)+"&timeMax="+encodeURIComponent(tmax);
    fetch(url,{headers:{Authorization:"Bearer "+accessToken}})
      .then(function(r){ if(!r.ok)throw new Error("HTTP "+r.status); return r.json(); })
      .then(function(data){
        var rows=parseEvents(data.items||[]);
        if(!rows.length){ setState(loadCacheExists()?"cached":"ready"); return; }
        var meta=aggregate(rows);
        apply(rows,meta); saveCache(rows,meta);
        window.__ztzSync=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        setState("live");
      })
      .catch(function(){ setState(loadCacheExists()?"cached":"error"); });
  }

  /* ---------- init (called by the shell once it's ready) ---------- */
  function init(){
    var hadCache=loadCache();
    if(!CFG.clientId){ setState(hadCache?"cached":"snapshot"); return; }
    if(location.protocol==="file:"){ setState(hadCache?"cached":"snapshot"); return; }
    setState(hadCache?"cached":"ready");
    // auto-update: re-authorize silently on open; if not yet authorized the user clicks Connect once.
    trySilent();
  }

  window.ZTZ_LIVE={ init:init, connect:connect, refresh:refresh, _parse:parseEvents, _agg:aggregate };
})();
