/**
 * Emit a single self-contained HTML file of the whole board.
 *
 * The real site is a multi-page Next export. This flattens it into one file
 * with the CSS and data inlined and vanilla-JS view switching, so it can be
 * opened offline, emailed, or dropped anywhere without a server.
 *
 * It reads the SAME globals.css and the SAME JSON as the app, so it cannot
 * drift into showing something the real site doesn't.
 *
 *   node scripts/build-preview.mjs   →  out/preview.html
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "..");

const css = readFileSync(join(webRoot, "app", "globals.css"), "utf8");
const board = JSON.parse(readFileSync(join(repoRoot, "data", "opportunities.json"), "utf8"));
const updates = JSON.parse(readFileSync(join(repoRoot, "data", "updates.json"), "utf8"));
const predictions = JSON.parse(readFileSync(join(repoRoot, "data", "predictions.json"), "utf8"));

const payload = JSON.stringify({ board, updates, predictions })
  .replace(/</g, "\\u003c"); // never let data close the script tag

const html = `<title>SONAR — opportunity board</title>
<style>
${css}
/* preview-only: the real app gets Geist from next/font, which needs a build step */
:root { --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.preview-note {
  background: var(--brand-soft); border: 1px solid var(--brand);
  color: var(--brand); border-radius: var(--radius);
  padding: 10px 14px; font-size: 13px; margin-bottom: 18px;
  display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap;
}
.preview-note b { font-weight: 650; }
.tab { cursor: pointer; border: 0; background: none; }
.row { cursor: pointer; }
[hidden] { display: none !important; }
</style>

<header class="hdr">
  <div class="hdr-in">
    <a class="wordmark" href="#" data-go="board"><span class="mark"></span>SONAR<span class="sub">· board</span></a>
    <nav class="tabs" aria-label="Sections">
      <button class="tab" data-go="board">Board <span class="cnt" id="c-board"></span></button>
      <button class="tab" data-go="radar">Radar <span class="cnt" id="c-radar"></span></button>
      <button class="tab" data-go="updates">Updates</button>
    </nav>
    <div class="hdr-next" id="hdr-next" hidden>
      <span class="lbl">Next</span><span class="val" id="hn-val"></span><span class="nm" id="hn-nm"></span>
    </div>
  </div>
</header>

<main class="page" id="app"></main>

<footer class="ft">
  <div>Static preview · every date traces to a source</div>
  <div><a href="https://github.com/Sibusiso-K/SONAR">github.com/Sibusiso-K/SONAR</a></div>
</footer>

<script>
const DATA = ${payload};
const OPPS = DATA.board.opportunities;
const PAST = DATA.board.past || [];
const SRCS = DATA.board.monitoring_sources || [];
const UPD  = (DATA.updates.updates || []).slice().sort((a,b)=>b.at.localeCompare(a.at));
const PRED = DATA.predictions.predictions || [];

const KIND = {hackathon:"Hackathon",datathon:"Datathon",ml_competition:"ML competition",
  build_competition:"Build & ship",challenge:"Challenge",competition:"Competition",
  grad_programme:"Grad programme",recruiting_event:"Recruiting event",
  accelerator:"Accelerator",bursary:"Bursary"};
const CONF = {confirmed:["Confirmed","stable"],corroborated:["Corroborated","brand"],
  reported:["Reported","warning"],unconfirmed:["Unverified",null],
  predicted:["Predicted",null],conflicted:["Conflicted","critical"]};

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today = new Date(); today.setHours(0,0,0,0);

function days(iso){
  if(!iso) return null;
  const d = new Date(iso.slice(0,10)+"T00:00:00");
  if(isNaN(d)) return null;
  return Math.round((d-today)/86400000);
}
function tone(d){ if(d===null) return "none"; if(d<=7) return "critical"; if(d<=21) return "warning"; return "stable"; }
function pretty(s){
  if(!s) return "";
  const fix={sast:"SAST",pdt:"PDT",african:"African",ai:"AI",ml:"ML",ibm:"IBM",gpu:"GPU",api:"API"};
  return String(s).replace(/_/g," ").split(" ").map((w,i)=>fix[w.toLowerCase()]||(i===0?w[0].toUpperCase()+w.slice(1):w)).join(" ");
}
function fmtDate(iso){
  if(!iso) return "—";
  const d=new Date(String(iso).slice(0,10)+"T00:00:00");
  return isNaN(d)?String(iso):d.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
}
function prize(o){
  const p=o.prize||{};
  if(typeof p.pool==="number"&&p.pool>0) return ((p.currency||"")+" "+p.pool.toLocaleString("en-ZA")).trim();
  return p.non_cash?"Non-cash":"TBA";
}
function chip(txt,t,dot){
  return '<span class="chip"'+(t?' data-tone="'+t+'"':'')+'>'+(dot?'<span class="dot"></span>':'')+esc(txt)+'</span>';
}

const live = OPPS.filter(o=>o.status!=="past"&&o.status!=="dropped")
  .map(o=>({...o, dr: days(o.next_date)}))
  .sort((a,b)=>{ if(a.dr!==null&&b.dr!==null) return a.dr-b.dr;
                 if(a.dr!==null) return -1; if(b.dr!==null) return 1;
                 return (b.score||0)-(a.score||0); });
const radar = OPPS.filter(o=>["unconfirmed","predicted","conflicted","reported"].includes(o.confidence))
  .map(o=>({...o, dr: days(o.next_date)})).sort((a,b)=>(b.score||0)-(a.score||0));

document.getElementById("c-board").textContent = live.length;
document.getElementById("c-radar").textContent = radar.length;

const next = live.find(o=>o.dr!==null&&o.dr>=0);
if(next){
  const h=document.getElementById("hdr-next"); h.hidden=false;
  const v=document.getElementById("hn-val"); v.textContent=next.dr+"d";
  v.style.color = tone(next.dr)==="critical"?"var(--critical)":tone(next.dr)==="warning"?"var(--warning)":"var(--text)";
  document.getElementById("hn-nm").textContent = next.name;
  h.onclick=()=>go("o:"+next.id);
}

function rows(list){
  if(!list.length) return '<div class="empty">Nothing here.</div>';
  return '<div class="board"><div class="board-hd"><div></div>'+
    '<div style="text-align:right">Closes</div><div>Opportunity</div><div>Type</div>'+
    '<div style="text-align:center">Tier</div><div style="text-align:right">Prize</div><div>Confidence</div></div>'+
    list.map(o=>{
      const t=tone(o.dr), c=CONF[o.confidence]||["?",null];
      const cd = o.dr===null?'—':(o.dr<0?'passed':o.dr+'<span class="d">d</span>');
      return '<div class="row" data-id="'+esc(o.id)+'">'+
        '<div class="stripe" data-t="'+t+'"></div>'+
        '<div class="cdcell"><div class="cd" data-t="'+t+'">'+cd+'</div></div>'+
        '<div class="nmcell"><div class="nm">'+esc(o.name)+'</div><div class="org">'+esc(o.organiser)+
          (o.next_date_label?' · <span class="dt">'+esc(pretty(o.next_date_label))+'</span>':'')+'</div></div>'+
        '<div class="kindcell"><span class="chip sq">'+esc(KIND[o.kind]||o.kind)+'</span>'+
          (o.career_track==="direct"?' '+chip("Hiring","brand"):'')+'</div>'+
        '<div class="tiercell"><span class="tierbadge" data-t="'+(o.tier||"?")+'">'+(o.tier||"–")+'</span></div>'+
        '<div class="prizecell"><div class="prize">'+esc(prize(o))+'</div></div>'+
        '<div class="confcell">'+chip(c[0],c[1],true)+'</div>'+
      '</div>';
    }).join('')+'</div>';
}

function tile(k,v,unit,m,tn){
  return '<div class="tile"'+(tn?' data-tone="'+tn+'"':'')+'><div class="k">'+esc(k)+'</div>'+
    '<div class="v">'+esc(v)+(unit?'<small>'+esc(unit)+'</small>':'')+'</div>'+
    (m?'<div class="m">'+esc(m)+'</div>':'')+'</div>';
}

function viewBoard(){
  const dated=live.filter(o=>o.dr!==null&&o.dr>=0);
  const soon=dated.filter(o=>o.dr<=21);
  const nv=live.filter(o=>o.confidence!=="confirmed").length;
  const hire=live.filter(o=>o.career_track==="direct").length;
  const fx={USD:1,ZAR:0.055,EUR:1.08,GBP:1.27};
  const total=live.reduce((s,o)=>s+((typeof o.prize?.pool==="number")?o.prize.pool*(fx[o.prize.currency]||1):0),0);
  const missed=PAST.filter(p=>p.missed)[0];

  return '<div class="preview-note"><b>Static preview.</b> The real site is a Next.js static export on Vercel — same data, same design, plus daily rebuilds so countdowns stay honest.</div>'+
    '<div class="page-head"><div><h1 class="title">Board</h1>'+
    '<p class="subtitle">Everything live, ranked by what closes first. '+live.length+' opportunities tracked.</p></div></div>'+
    (missed?'<div class="alert"><div class="ic">!!</div><div class="bd"><div class="hd">'+esc(missed.name)+' — missed</div>'+
      '<div class="tx">'+esc(missed.summary||"")+' Nothing was watching it.</div></div></div>':'')+
    (next&&next.dr<=7?'<div class="alert warn"><div class="ic">!</div><div class="bd"><div class="hd">'+
      esc(next.name)+' closes in '+next.dr+' days</div><div class="tx">'+esc(pretty(next.next_date_label||""))+'</div></div></div>':'')+
    '<div class="tiles">'+
      tile("Next deadline", next?next.dr:"—","d",next?next.name:"", next&&next.dr<=7?"critical":next&&next.dr<=21?"warning":null)+
      tile("Closing ≤ 21 days", soon.length,"", "of "+dated.length+" with a confirmed date", soon.length>2?"warning":null)+
      tile("Prize pool tracked", "$"+(total>=1e6?(total/1e6).toFixed(1)+"M":Math.round(total/1000)+"k"),"","cash only, converted to USD")+
      tile("Needs verification", nv,"","not yet calendar-safe")+
      tile("Direct hiring route", hire,"","the event is the interview")+
    '</div>'+ rows(live);
}

function viewRadar(){
  return '<div class="page-head"><div><h1 class="title">Radar</h1>'+
    '<p class="subtitle">Not yet safe for a committed calendar — unverified, single-source, or predicted.</p></div></div>'+
    '<div class="alert warn"><div class="ic">!</div><div class="bd"><div class="hd">Do not plan a weekend around anything here</div>'+
    '<div class="tx">These have not cleared the two-source rule. They move to the Board once an organiser page confirms, or two independent sources agree.</div></div></div>'+
    rows(radar)+
    '<h2 class="title" style="font-size:18px;margin-top:42px;margin-bottom:4px">Predicted windows</h2>'+
    '<p class="subtitle" style="margin-bottom:14px">Forecast from prior editions — when to start watching. Windows, not dates.</p>'+
    (PRED.length? '<div class="card" style="padding:0">'+PRED.map((p,i)=>
      '<div style="padding:13px 18px'+(i<PRED.length-1?';border-bottom:1px solid var(--rule)':'')+'">'+
      '<div style="font-weight:570;font-size:14.5px;margin-bottom:4px">'+esc(p.opportunity_slug)+' '+chip(Math.round(p.confidence*100)+"% · "+p.n_editions+" editions")+'</div>'+
      '<div class="dline" style="border:0;padding:3px 0"><span class="dk">Start watching</span><span class="dv">'+fmtDate(p.predicted_announce_start)+' – '+fmtDate(p.predicted_announce_end)+'</span></div>'+
      '<div class="dline" style="border:0;padding:3px 0"><span class="dk">Event likely</span><span class="dv">'+fmtDate(p.predicted_event_start)+' – '+fmtDate(p.predicted_event_end)+'</span></div>'+
      '<div style="font-size:12.5px;color:var(--faint);margin-top:5px">'+esc(p.basis)+'</div></div>').join('')+'</div>'
      : '<div class="card"><p style="margin:0;font-size:14px;color:var(--text-2)">No forecasts yet — needs two prior editions per opportunity. Backfill <code>editions</code>, then run <code>sonar_db.py forecast</code>.</p></div>')+
    '<h2 class="title" style="font-size:18px;margin-top:42px;margin-bottom:4px">Past &amp; missed</h2>'+
    '<div class="card" style="padding:0">'+PAST.map((p,i)=>
      '<div style="display:flex;gap:14px;padding:13px 18px;align-items:baseline'+(i<PAST.length-1?';border-bottom:1px solid var(--rule)':'')+'">'+
      chip(p.missed?"Missed":"Past", p.missed?"critical":null)+
      '<div><div style="font-weight:560;font-size:14.5px;margin-bottom:2px">'+esc(p.name)+'</div>'+
      '<div style="font-size:13.5px;color:var(--text-2);line-height:1.55">'+esc(p.reason)+'</div></div></div>').join('')+'</div>'+
    '<h2 class="title" style="font-size:18px;margin-top:42px;margin-bottom:4px">Monitored sources</h2>'+
    '<div class="card" style="padding:0">'+SRCS.map((s,i)=>
      '<div class="linkrow" style="padding:11px 18px'+(i<SRCS.length-1?'':';border-bottom:0')+'">'+
      '<span class="lk" style="color:var(--text);font-weight:540">'+esc(s.name)+'</span>'+
      '<span class="chip sq">'+esc(s.cadence)+'</span></div>').join('')+'</div>';
}

function viewUpdates(){
  const K={added:["New","stable"],changed:["Changed","warning"],verified:["Verified","brand"],
           missed:["Missed","critical"],system:["System",null]};
  const groups={};
  UPD.forEach(u=>{ const d=u.at.slice(0,10); (groups[d]=groups[d]||[]).push(u); });
  return '<div class="page-head"><div><h1 class="title">Updates</h1>'+
    '<p class="subtitle">Every change to the board, and what made it. An autonomous board is only trustworthy if you can see what it did.</p></div></div>'+
    '<div class="feed">'+Object.entries(groups).map(([d,items])=>
      '<div><div class="fday"><span class="fd">'+new Date(d+"T00:00:00").toLocaleDateString("en-ZA",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+'</span><span class="fr"></span></div>'+
      items.map(u=>{ const k=K[u.kind]||["?",null];
        return '<div class="fitem" data-k="'+esc(u.kind)+'"><div class="ft">'+u.at.slice(11,16)+'</div>'+
        '<div class="fi"><span></span></div><div class="fb">'+
        '<div style="margin-bottom:3px">'+chip(k[0],k[1])+'</div>'+
        '<div class="fh">'+esc(u.title)+'</div><div class="fx">'+esc(u.body)+'</div>'+
        '<div style="font-size:12px;color:var(--faint);margin-top:6px">by <code>'+esc(u.by)+'</code></div></div></div>';
      }).join('')+'</div>').join('')+'</div>';
}

function viewDetail(id){
  const o = live.concat(radar).find(x=>x.id===id) || OPPS.map(x=>({...x,dr:days(x.next_date)})).find(x=>x.id===id);
  if(!o) return viewBoard();
  const t=tone(o.dr), c=CONF[o.confidence]||["?",null];
  const w=DATA.board.meta.scoring_weights||{};
  const dts=Object.entries(o.dates||{}).filter(([k,v])=>k!=="confidence"&&k!=="note"&&typeof v==="string");
  const bd=o.prize?.breakdown;
  const brows = bd? (Array.isArray(bd)?bd.map(r=>[r.place||"—",r.amount]):Object.entries(bd)) : [];

  const card=(h,b)=>b?'<div class="card"><h3>'+h+'</h3>'+b+'</div>':'';
  return '<a class="back" href="#" data-go="board">← Board</a>'+
    '<div class="page-head" style="align-items:flex-start;margin-bottom:26px"><div>'+
    '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px">'+
      '<span class="chip sq">'+esc(KIND[o.kind]||o.kind)+'</span>'+
      '<span class="chip sq">'+esc(pretty(o.scope))+'</span>'+
      (o.format?'<span class="chip sq">'+esc(pretty(o.format))+'</span>':'')+
      (o.career_track==="direct"?chip("Direct hiring route","brand"):'')+
      chip(c[0],c[1],true)+'</div>'+
    '<h1 class="title" style="font-size:27px;line-height:1.2">'+esc(o.name)+'</h1>'+
    '<p class="subtitle">'+esc(o.organiser)+(o.location?' · '+esc(o.location):'')+'</p></div>'+
    '<div style="text-align:right"><div class="num" style="font-size:34px;font-weight:600;letter-spacing:-.03em;line-height:1;color:'+
      (t==="critical"?"var(--critical)":t==="warning"?"var(--warning)":"var(--text)")+'">'+
      (o.dr!==null&&o.dr>=0?o.dr+"d":"—")+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:3px">'+esc(o.next_date_label?pretty(o.next_date_label):"no confirmed date")+'</div></div>'+
    '</div><div class="detail"><div>'+
      card("What to build", o.what_to_build?'<p>'+esc(o.what_to_build)+'</p>':'')+
      card("Deliverables", (o.deliverables||[]).length?'<ul class="blist">'+o.deliverables.map(d=>'<li>'+esc(d)+'</li>').join('')+'</ul>':'')+
      card("How it's judged", o.scoring_formula?'<div class="formula">'+esc(o.scoring_formula)+'</div>':'')+
      card("Eligibility", o.eligibility?'<p>'+esc(o.eligibility)+'</p>':'')+
      card("Team fit", o.team_fit?'<p>'+esc(o.team_fit)+'</p>':'')+
      card("Notes", o.notes?'<p>'+esc(o.notes)+'</p>':'')+
    '</div><aside class="rail">'+
      card("Dates", dts.length?'<div class="dl">'+dts.map(([k,v])=>
        '<div class="dline"><span class="dk">'+esc(k.endsWith("_sast")?pretty(k.slice(0,-5))+" (SAST)":pretty(k))+'</span>'+
        '<span class="dv">'+fmtDate(v)+'</span></div>').join('')+'</div>'
        :'<p style="font-size:13.5px;color:var(--muted);margin:0">No dates confirmed. This is why it sits on Radar.</p>')+
      card("Prize", '<div class="kv"><span class="k">Total pool</span><span class="v num">'+esc(prize(o))+'</span></div>'+
        brows.map(([k,v])=>'<div class="kv"><span class="k">'+esc(pretty(k))+'</span><span class="v num">'+
          esc(typeof v==="number"?v.toLocaleString("en-ZA"):v)+'</span></div>').join('')+
        (typeof o.prize?.non_cash==="string"?'<div class="kv"><span class="k">Non-cash</span><span class="v" style="font-weight:450;font-size:13px">'+esc(o.prize.non_cash)+'</span></div>':''))+
      card("Score"+(o.score!=null?" · "+o.score:""), Object.entries(o.scores||{}).filter(([,v])=>typeof v==="number").map(([k,v])=>
        '<div class="sc"><span class="sl">'+esc(pretty(k))+(w[k]?' <span style="color:var(--faint);font-size:11.5px">'+Math.round(w[k]*100)+'%</span>':'')+'</span>'+
        '<span class="sb"><span class="sf" style="width:'+(v/10*100)+'%"></span></span><span class="sv">'+v+'</span></div>').join(''))+
      card("Sources", Object.entries(o.links||{}).map(([k,v])=>{
        let label=v, href=v, ext=true;
        if(/^[^\\s@]+@[^\\s@]+$/.test(v)){ href="mailto:"+v; ext=false; }
        else { try{ const u=new URL(v); label=u.hostname.replace(/^www\\./,"")+(u.pathname!=="/"?u.pathname:""); }catch(e){ ext=false; } }
        return '<div class="linkrow"><span class="lk">'+esc(pretty(k))+'</span>'+
          '<a href="'+esc(href)+'"'+(ext?' target="_blank" rel="noreferrer"':'')+'>'+esc(label)+(ext?' ↗':'')+'</a></div>';
      }).join(''))+
      card("Status", '<div class="kv"><span class="k">Competition</span><span class="v">'+esc(pretty(o.status))+'</span></div>'+
        '<div class="kv"><span class="k">Our stage</span><span class="v">'+esc(pretty(o.lifecycle))+'</span></div>')+
    '</aside></div>';
}

function go(v){
  const app=document.getElementById("app");
  app.innerHTML = v==="radar"?viewRadar() : v==="updates"?viewUpdates()
    : v.startsWith("o:")?viewDetail(v.slice(2)) : viewBoard();
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("data-active", String(t.dataset.go===v)));
  window.scrollTo(0,0);
  location.hash = v;
}

document.addEventListener("click", e => {
  const g=e.target.closest("[data-go]");
  if(g){ e.preventDefault(); go(g.dataset.go); return; }
  const r=e.target.closest(".row");
  if(r){ go("o:"+r.dataset.id); }
});

go((location.hash||"#board").slice(1) || "board");
</script>
`;

mkdirSync(join(webRoot, "out"), { recursive: true });
const dest = join(webRoot, "out", "preview.html");
writeFileSync(dest, html);
console.log(`[preview] ${dest}  (${(html.length / 1024).toFixed(0)} kB, self-contained)`);
