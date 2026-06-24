#!/usr/bin/env python3
"""
Build data/bookings.js from a raw Booked Jobs calendar export.

Input : a JSON file with shape {"events":[ ...Google Calendar events... ]}
Output: data/bookings.js  ->  window.ZTZ_DATA.bookings / .bookingsMeta

The Booked Jobs calendar is the operational source of truth: every event is a
confirmed move whose description carries structured fields (CF, crew, rates,
source, rep, route, job code). This script flattens that into compact records
plus pre-computed aggregates so the dashboard never has to parse HTML at runtime.

Used both for the initial seed and by the scheduled refresh task.
"""
import json, sys, re, datetime, collections, os

US_STATES = {"AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL",
"IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
"NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA",
"WV","WI","WY"}

# Sales-rep nickname / first-name -> canonical full name (team of 11 + ops)
REP_CANON = {
 "george":"George Davis","goglik":"George Davis","alanna":"Alanna Brown",
 "alex":"Alex Koval","amy":"Amy Olsson","daniella":"Daniella Pelowski",
 "david":"David Barta","eli":"Eli Kane","lisa":"Lisa Leman",
 "lucas":"Lucas Ruiz Estapé","maya":"Maya Zoric","nick":"Nick Haas",
}

def canon_rep(raw):
    if not raw: return "Unassigned"
    r = re.sub(r"<[^>]+>","",raw).strip().lower()
    r = r.split("/")[0].split("&")[0].split(",")[0].strip()
    for k,v in REP_CANON.items():
        if r.startswith(k): return v
    return raw.strip().title() if raw.strip() else "Unassigned"

def norm_source(raw):
    if not raw: return "Unknown"
    s = raw.strip().lower()
    if "request #" in s or "job code" in s: return "Unknown"
    if "google" in s: return "Google"
    if "yelp" in s: return "Yelp"
    if "angi" in s: return "Angi"
    if "thumbtack" in s: return "Thumbtack"
    if "facebook" in s or "social" in s: return "Facebook/Social"
    if "reddit" in s: return "Reddit"
    if "chatgpt" in s or "ai search" in s or s.startswith("ai") or "openai" in s: return "AI Search"
    if "return" in s or "repeat" in s: return "Returning Customer"
    if "recommend" in s or "referr" in s or "friend" in s: return "Referral"
    if "website" in s or "web " in s or s=="web": return "Website"
    if "moveboard" in s: return "Moveboard"
    if "post card" in s or "postcard" in s: return "Postcard"
    if s=="cl" or "craigslist" in s: return "Craigslist"
    if "truck" in s: return "Saw Our Truck"
    return raw.strip().title()

def grab(desc, label):
    # match "Label: value" up to the next <br>, </div> or newline; strip any inline tags
    m = re.search(re.escape(label)+r"\s*:\s*(.*?)(?:<br\s*/?>|</div>|</p>|\n|$)", desc, re.I|re.S)
    if not m: return ""
    return re.sub(r"<[^>]+>","",m.group(1)).strip()

def money(s):
    if not s: return None
    m = re.search(r"[-+]?[\d,]*\.?\d+", s.replace("$",""))
    return float(m.group(0).replace(",","")) if m else None

def num(s):
    if not s: return None
    m = re.search(r"-?\d[\d,]*\.?\d*", str(s))
    return float(m.group(0).replace(",","")) if m else None

def state_of(addr):
    if not addr: return ""
    toks = re.findall(r"\b([A-Z]{2})\b", addr)
    for t in reversed(toks):
        if t in US_STATES: return t
    return ""

def parse(path):
    d = json.load(open(path))
    out=[]
    for e in d.get("events",[]):
        desc = e.get("description","") or ""
        start = e.get("start",{})
        dt = start.get("dateTime") or start.get("date") or ""
        day = dt[:10]
        frm = grab(desc,"Moving From")
        to  = grab(desc,"Moving To")
        fs, ts = state_of(frm), state_of(to)
        cash = money(grab(desc,"Grand Total by Cash"))
        card = money(grab(desc,"Grand Total by Card"))
        rec = {
          "id": e.get("id",""),
          "date": day,
          "time": dt[11:16] if "T" in dt else "",
          "customer": grab(desc,"Customer Name") or "",
          "from_state": fs, "to_state": ts,
          "route": (fs+"→"+ts) if fs and ts else (fs or ts or "—"),
          "interstate": bool(fs and ts and fs!=ts),
          "rep": canon_rep(grab(desc,"Sales Rep 1")),
          "source": norm_source(grab(desc,"Source")),
          "move_type": grab(desc,"Moving Type") or "",
          "job_type": grab(desc,"Job Type") or "",
          "cf": num(grab(desc,"Total CF")),
          "crew": num(grab(desc,"Crew Size")),
          "cash_total": cash, "card_total": card,
          "deposit": money(grab(desc,"Deposit")),
          "job_code": grab(desc,"Job Code") or "",
          "request_id": grab(desc,"Request #") or "",
          "status": e.get("status",""),
        }
        out.append(rec)
    out.sort(key=lambda r:(r["date"], r["time"]))
    return out

def agg(rows):
    def s(key,rows):
        c=collections.Counter()
        for r in rows:
            k=r.get(key) or "—"; c[k]+=1
        return dict(c.most_common())
    def revs(rows):
        cash=sum(r["cash_total"] or 0 for r in rows)
        card=sum(r["card_total"] or 0 for r in rows)
        cf=sum(r["cf"] or 0 for r in rows)
        return cash,card,cf
    cash,card,cf=revs(rows)
    by_day=collections.OrderedDict()
    for r in rows:
        b=by_day.setdefault(r["date"],{"jobs":0,"cf":0,"cash":0,"card":0})
        b["jobs"]+=1; b["cf"]+=r["cf"] or 0; b["cash"]+=r["cash_total"] or 0; b["card"]+=r["card_total"] or 0
    by_rep={}
    reps=set(r["rep"] for r in rows)
    for rep in reps:
        rr=[r for r in rows if r["rep"]==rep]
        c2,d2,f2=revs(rr)
        by_rep[rep]={"jobs":len(rr),"cf":round(f2),"cash":round(c2),"card":round(d2)}
    n=len(rows)
    today=datetime.date.today().isoformat()
    today_rows=[r for r in rows if r["date"]==today] or [r for r in rows if r["date"]==rows[0]["date"]]
    tcash,tcard,tcf=revs(today_rows)
    return {
      "generated": datetime.datetime.now().isoformat(timespec="seconds"),
      "window_start": rows[0]["date"], "window_end": rows[-1]["date"],
      "jobs": n,
      "cf_total": round(cf), "cash_total": round(cash), "card_total": round(card),
      "avg_cf": round(cf/n) if n else 0, "avg_cash": round(cash/n) if n else 0,
      "interstate_pct": round(100*sum(1 for r in rows if r["interstate"])/n) if n else 0,
      "by_source": s("source",rows), "by_rep": by_rep, "by_route": s("route",rows),
      "by_movetype": s("move_type",rows),
      "by_day": by_day,
      "today_date": today_rows[0]["date"] if today_rows else today,
      "today_jobs": len(today_rows), "today_cf": round(tcf),
      "today_cash": round(tcash), "today_card": round(tcard),
    }

def main():
    raw = sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),"_raw_bookings_snapshot.json")
    rows = parse(raw)
    meta = agg(rows)
    js = ("// AUTO-GENERATED from the Booked Jobs calendar. Do not edit by hand.\n"
          "// Regenerated by data/build_bookings.py (initial seed + scheduled refresh).\n"
          "window.ZTZ_DATA = window.ZTZ_DATA || {};\n"
          "ZTZ_DATA.bookings = " + json.dumps(rows, ensure_ascii=False) + ";\n"
          "ZTZ_DATA.bookingsMeta = " + json.dumps(meta, ensure_ascii=False) + ";\n")
    out = os.path.join(os.path.dirname(raw) if os.path.dirname(raw) else ".","bookings.js")
    out = os.path.join(os.path.dirname(__file__),"bookings.js")
    open(out,"w").write(js)
    print("rows:",len(rows))
    print("window:",meta["window_start"],"->",meta["window_end"])
    print("jobs:",meta["jobs"],"cf_total:",meta["cf_total"],"cash_total:",meta["cash_total"],"card_total:",meta["card_total"])
    print("today:",meta["today_date"],"jobs",meta["today_jobs"],"cf",meta["today_cf"],"cash",meta["today_cash"])
    print("by_source:",meta["by_source"])
    print("by_rep:",json.dumps(meta["by_rep"]))
    print("by_route(top):",dict(list(meta["by_route"].items())[:8]))
    print("days:",list(meta["by_day"].keys()))

if __name__=="__main__":
    main()
