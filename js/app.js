import {
  createStorage, makeId, intIn, textIn, validOutcome, normaliseState, freshState
} from "./storage.js";
import {
  planFor, nextBase, trailing, trailingStopped, minStep,
  nWarm, restLen, rng, hash, buildReps, routineLength, absOf
} from "./progression.js";
import { fmt } from "./timer.js";
import { el, esc, escAttr } from "./ui.js";
import {
  makeCandidateSession, previewPlanWithCandidate, sessionStatusText
} from "./sessions.js";
import {
  saveActiveRunState, clearActiveRunState, loadActiveRun, activeRunIsRecent
} from "./state.js";
import {
  bindNumberSetting, SETTING_LIMITS
} from "./settings.js";
import {
  dashboardStats, timelineItems, achievementSnapshot, newlyReachedAchievements
} from "./dashboard.js";

import { friendlyTargetReason } from "./target-reason.js";

/* ================= storage ================= */
var storage=createStorage();
var state=storage.boot();

function save(){
  storage.save(state);
  drawStorageWarning();
}
function drawStorageWarning(){
  var e=document.getElementById("storageWarn");
  if(!e) return;
  e.hidden=storage.canSave();
  e.textContent="This browser isn't letting the app save anything. Progress will vanish when you "+
    "close the tab. Private or incognito browsing is the usual cause — open the page in a normal window.";
}

function scen(){
  var s=state.scenarios.filter(function(x){return x.id===state.active;})[0];
  if(!s){ state.active=state.scenarios[0].id; s=state.scenarios[0]; }
  return s;
}

/* Progression and warm-up planning live in js/progression.js. */

/* ================= context tags ================= */
var TAGS=["Morning","Afternoon","Evening","Not walked yet","After a walk","Before food","After food","Radio or TV on"];

/* ================= door is a bore =================
   For dogs who aren't ready for any absence at all. The door itself has become
   the frightening part, so nothing is timed: you work through door cues until
   they predict nothing. This is a generic version of the idea — Julie Naismith's
   full protocol is in "Be Right Back!" and is worth reading properly. */
var CUES=[
  "Walk toward the door, then turn and come back",
  "Stand by the door a moment, then walk away",
  "Rest your hand on the handle, then let go",
  "Push the handle down, then release it",
  "Open the door a crack, then close it",
  "Open the door wide, then close it",
  "Step outside, then step straight back in",
  "Step outside, close the door, then open it again"
];
var DOOR_REPS=6;

function mode(s){ return s.mode==="door" ? "door" : "absence"; }
function doorLevel(s){ return Math.min(CUES.length-1, s.doorLevel==null?0:s.doorLevel); }

/* Only timed absences drive durations, charts and milestones. */

function buildCues(s,seed){
  var lvl=doorLevel(s), r=rng(seed), out=[], i;
  for(i=0;i<DOOR_REPS;i++){
    // weight toward the current level without ever only drilling it
    var pick = r()<0.45 ? lvl : Math.floor(r()*(lvl+1));
    out.push(pick);
  }
  if(out.indexOf(lvl)===-1) out[DOOR_REPS-1]=lvl;
  for(i=out.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)), t=out[i]; out[i]=out[j]; out[j]=t; }
  return out.map(function(c){ return { kind:"cue", cue:c }; });
}

/* ================= daily cap =================
   Two sessions is a ceiling, not a target. Separation anxiety work consolidates
   in the gaps between sessions, and cramming reliably sets dogs back. Counted
   across every scenario, because it's the same dog doing all of them. */
function dailyCap(){ return state.dailyCap==null?2:state.dailyCap; }
function dayStart(){ var t=new Date(); t.setHours(0,0,0,0); return t.getTime(); }
function todayCount(){
  var from=dayStart(), n=0;
  state.scenarios.forEach(function(sc){ sc.sessions.forEach(function(p){ if(p.at>=from) n++; }); });
  return n;
}
function capped(){ return todayCount()>=dailyCap(); }

/* ================= milestones ================= */
var MILESTONES=[
  {s:30,l:"30 sec"},{s:60,l:"1 min"},{s:120,l:"2 min"},{s:300,l:"5 min"},
  {s:600,l:"10 min"},{s:900,l:"15 min"},{s:1200,l:"20 min"},{s:1800,l:"30 min"},
  {s:2700,l:"45 min"},{s:3600,l:"1 hour"},{s:5400,l:"90 min"},{s:7200,l:"2 hours"},
  {s:10800,l:"3 hours"},{s:14400,l:"4 hours"}
];

/* Derived from the log rather than stored, so importing, editing or deleting
   sessions can never leave a badge sitting there unearned. */
function badges(){
  var out={};
  state.scenarios.forEach(function(sc){
    sc.sessions.forEach(function(p){
      if(p.kind==="door"||p.outcome!=="success"||p.stopped) return;
      MILESTONES.forEach(function(m){
        if(p.actual>=m.s && (!out[m.s]||p.at<out[m.s].at))
          out[m.s]={ at:p.at, scenario:sc.label, actual:p.actual };
      });
    });
  });
  return out;
}
function bestSuccess(){
  var best=0;
  state.scenarios.forEach(function(sc){ sc.sessions.forEach(function(p){
    if(p.kind!=="door"&&p.outcome==="success"&&!p.stopped&&p.actual>best) best=p.actual;
  }); });
  return best;
}

/* ================= helpers ================= */
function dogName(){ return (state.name||"").trim()||"your dog"; }
function dogNameHtml(){ return esc(dogName()); }
var COLOUR={ success:"var(--green)", ok:"var(--ochre)", bad:"var(--red)" };
var LABEL={ success:"Success", ok:"OK", bad:"Not good" };
var CLS={ success:"v-good", ok:"v-ok", bad:"v-bad" };
var LINES=["#4F7A6B","#4A6B84","#B58135","#7B6480","#96574B","#3F6B63"];

/* ================= state of play ================= */
/* phase: idle | running | rest | cue | doorVerdict | verdictMain
   Warm-ups aren't graded — you just do them. The one judgement call comes
   after the main absence, about the session as a whole. */
var phase="idle", startedAt=0, tick=null, restEnds=0;
var plan=null, pending=null, chartMode="one";
var reps=[], repIdx=0, repLog=[], retries=0, shuffle=0, justEarned=[];
var tags=[], note="", graduated=false, editingIndex=null;
var reviewCandidate=null, reviewPlan=null, milestoneTimer=null;
var achievementQueue=[], achievementTimer=null;

function activeRunSnapshot(){
  return {
    scenarioId:state.active,
    phase:phase,
    startedAt:startedAt,
    restEnds:restEnds,
    plan:plan,
    pending:pending,
    reps:reps,
    repIdx:repIdx,
    repLog:repLog,
    tags:tags,
    note:note,
    shuffle:shuffle,
    graduated:graduated,
    chimed:chimed,
    preChimed:preChimed
  };
}

function persistActiveRun(quiet){
  if(phase==="idle"){
    clearActiveRunState(state);
    if(quiet) storage.save(state); else save();
    return;
  }
  saveActiveRunState(state,activeRunSnapshot());
  if(quiet) storage.save(state); else save();
}

function clearActiveRun(){
  clearActiveRunState(state);
  save();
}

function restoreRun(run){
  if(!run||typeof run!=="object") return false;

  var scenario=state.scenarios.filter(function(item){
    return item.id===run.scenarioId;
  })[0];
  if(!scenario) return false;

  var allowed={
    running:true,
    rest:true,
    cue:true,
    doorVerdict:true,
    verdictMain:true
  };
  var restoredPhase=allowed[run.phase]?run.phase:null;
  if(!restoredPhase) return false;

  var restoredReps=Array.isArray(run.reps)?run.reps:[];
  var restoredIndex=Number.isFinite(Number(run.repIdx))
    ?Math.max(0,Math.floor(Number(run.repIdx))):0;

  if((restoredPhase==="running"||restoredPhase==="rest"||restoredPhase==="cue")&&
     (!restoredReps.length||restoredIndex>=restoredReps.length)){
    return false;
  }

  var restoredStartedAt=Number(run.startedAt)||0;
  if(restoredPhase==="running"&&restoredStartedAt<=0) return false;

  state.active=scenario.id;
  phase=restoredPhase;
  startedAt=restoredStartedAt;
  restEnds=Number(run.restEnds)||0;
  plan=run.plan&&typeof run.plan==="object"?run.plan:planFor(scenario);
  pending=run.pending&&typeof run.pending==="object"?run.pending:null;
  reps=restoredReps;
  repIdx=restoredIndex;
  repLog=Array.isArray(run.repLog)?run.repLog:[];
  tags=Array.isArray(run.tags)?run.tags.slice(0,20):[];
  note=typeof run.note==="string"?run.note.slice(0,140):"";
  shuffle=Number.isFinite(Number(run.shuffle))?Math.floor(Number(run.shuffle)):0;
  graduated=!!run.graduated;
  chimed=!!run.chimed;
  preChimed=!!run.preChimed;
  retries=0;
  reviewCandidate=null;
  reviewPlan=null;
  editingIndex=null;
  return true;
}

function restartRestoredRun(showMessage){
  clearInterval(tick);
  tick=null;
  render();

  if(phase==="running"){
    audioStart();
    runTicker();
  }else if(phase==="rest"){
    toRest(true);
  }

  persistActiveRun(true);
  if(showMessage){
    showToast(phase==="running"
      ?"Session restored — the timer kept its original start time."
      :"Unfinished session restored.");
  }
}

function autoRestoreActiveRun(){
  var run=loadActiveRun(state);
  if(!run||!activeRunIsRecent(run,24*60*60*1000)) return false;
  if(!restoreRun(run)) return false;
  restartRestoredRun(true);
  return true;
}

function render(){
  var s=scen();
  if(phase==="idle"){
    plan=planFor(s);
    reps = mode(s)==="door"
      ? buildCues(s,hash(s.id)+s.sessions.length*997+shuffle*31)
      : buildReps(plan.target,nWarm(s),hash(s.id)+absOf(s).length*997+shuffle*31);
    repIdx=0; repLog=[]; retries=0; tags=[]; note="";
  }
  el("counter").textContent=s.label+" · session "+(s.sessions.length+1);
  drawClock(); drawHeadline(); drawDelta(); drawTargetReason(); drawReps();

  var coach=el("coach");
  if(mode(s)==="door"&&phase==="idle"&&graduated){
    coach.innerHTML="<b>The door means nothing to "+dogNameHtml()+" now.</b> That's the whole ladder clean. "+
      "Time to start timed absences — this scenario will begin at 3 seconds.";
    coach.className="note"; coach.hidden=false;
  } else if(mode(s)==="door"&&phase==="idle"){
    coach.textContent="Door is a Bore is Julie Naismith's exercise from Be Right Back!, for dogs who "+
      "can't yet cope with any absence. Nothing is timed — you're just making door cues boring. "+
      "The steps here are a plain version of the idea; her book has the full protocol.";
    coach.className="note"; coach.hidden=false;
  } else if(phase==="idle"&&capped()){
    coach.textContent=dailyCap()===1
      ? "Today's session is done. The learning settles in the gap — the next one is tomorrow."
      : dailyCap()+" sessions logged today. That's the ceiling. Separation anxiety work consolidates "+
        "between sessions rather than during them, and stacking more on tends to undo progress.";
    coach.className="note"; coach.hidden=false;
  } else if(phase==="idle"){
    coach.hidden=true;
  } else if(phase==="wobble"){
    coach.textContent="Warm-ups are the tell. If the small ones are hard, the main absence won't go better.";
    coach.className="note warn"; coach.hidden=false;
  } else {
    coach.hidden=true;
  }

  drawTabs(); drawAdjust(); drawActions(); drawCheer(); drawDashboard(); drawTimeline(); drawBadges(); drawCharts(); drawLog();
  el("startDur").value=s.start;
  el("warmups").value=nWarm(s);
  el("dailyCap").value=dailyCap();
  el("soundToggle").textContent = soundOn() ? "Sound on — tap to mute" : "Muted — tap to turn sound on";
  el("modePrompt").textContent = mode(s)==="door"
    ? "Ready for timed departures?" : "Not ready for timed departures yet?";
  el("modeToggle").textContent = mode(s)==="door"
    ? "Switch to timed departures" : "Start with Door is a Bore instead";
  el("modeHelp").textContent = mode(s)==="door"
    ? "Move on when the door cues feel ordinary and your dog can settle. The first timed target will be a cautious 3 seconds, and this scenario's Door is a Bore history will be kept."
    : "Door is a Bore works on door cues instead of duration, for dogs who become worried before you've properly left. Switching keeps this scenario's history.";
  el("restLen").value=restLen(s);
  el("renameTo").value=s.label;
  el("scenLabel1").textContent=s.label;
  el("scenLabel2").textContent=s.label;
  el("data").value=JSON.stringify(state);
  backupWhen(); drawStorageWarning(); drawInstallBar(); storageStatus();
}

function current(){ return reps[repIdx]; }

function drawHeadline(){
  var s=scen(), h=el("headline");
  if(mode(s)==="door"){
    h.textContent = phase==="idle" ? (capped()?"Done for today":"Door is a bore")
      : phase==="doorVerdict" ? "Rate the session"
      : phase==="rest" ? "Pause" : "Step "+(repIdx+1)+" of "+reps.length;
    return;
  }
  if(phase==="rest"){ h.textContent="Settle break"; return; }
  if(phase!=="idle"){
    h.textContent = current().kind==="main" ? "The main absence"
      : "Warm-up "+(repIdx+1)+" of "+(reps.length-1);
    return;
  }
  h.textContent = capped() ? "Done for today"
    : plan.easy ? "A deliberately short one" : s.label+" absence";
}

function drawClock(){
  var c=el("clock"), s=scen(), cue=el("cue");
  if(mode(s)==="door"){
    c.hidden=true; cue.hidden=false;
    cue.textContent = phase==="idle"
      ? "Level "+(doorLevel(s)+1)+" of "+CUES.length+" — "+CUES[doorLevel(s)].toLowerCase()
      : phase==="doorVerdict" ? ((pending&&pending.stopped)?"Session ended early — record how it went.":"Session complete — record how it went.")
      : phase==="rest" ? "Give it a moment, then carry on."
      : CUES[reps[repIdx].cue];
    return;
  }
  c.hidden=false; cue.hidden=true;
  if(phase==="idle"){ c.className="clock"; c.textContent=fmt(plan.target); }
}

function drawDelta(){
  var s=scen(), d=el("delta");
  if(mode(s)==="door"){
    if(phase!=="idle") return;
    var done=s.sessions.filter(function(p){return p.kind==="door";}).length;
    d.innerHTML = done ? "<b>"+done+"</b> door sessions so far · "+DOOR_REPS+" steps, nothing timed"
                       : "<b>Nothing is timed here.</b> "+DOOR_REPS+" steps, then you're done";
    return;
  }
  if(phase!=="idle") return;
  var lead, abs=absOf(s);
  if(abs.length){
    var prev=abs[abs.length-1], diff=plan.target-prev.target;
    lead = diff===0 ? "<b>Same as last time</b> ("+fmt(prev.target)+" alone)"
                    : "<b>"+(diff>0?"+":"−")+fmt(Math.abs(diff))+"</b> on last time ("+fmt(prev.target)+" alone)";
  } else {
    lead="<b>Where this scenario starts.</b>";
  }
  d.innerHTML=lead;
}

function drawTargetReason(){
  var box=el("targetReason"), s=scen();
  if(mode(s)!=="absence"||phase!=="idle"||capped()){
    box.hidden=true; box.innerHTML=""; return;
  }

  var reason=friendlyTargetReason(s,plan);
  var detailRows=reason.details.map(function(row){
    return '<div class="reasonDetailRow"><span>'+esc(row[0])+'</span><b>'+esc(row[1])+'</b></div>';
  }).join("");

  box.className="targetReason"+(plan.reset?" warn":"");
  box.innerHTML=
    '<span class="why">Why this target?</span>'+
    '<span class="rule">'+esc(reason.summary)+'</span>'+
    '<details class="reasonDetails">'+
      '<summary>View details</summary>'+
      '<div class="reasonDetailGrid">'+detailRows+'</div>'+
    '</details>';
  box.hidden=false;
}

function drawReps(){
  var r=el("reps");
  if(!reps.length){ r.innerHTML=""; return; }
  var html=reps.map(function(rep,i){
    var cls="pip"+(rep.kind==="main"?" main":"");
    if(rep.kind==="cue"){
      var c2="pip";
      var dn=repLog[i];
      if(dn) c2+= dn.ok?" done":" wobble";
      else if(i===repIdx&&phase!=="idle") c2+=" now";
      return (i?'<span class="arrow">·</span>':'')+'<span class="'+c2+'">'+(rep.cue+1)+'</span>';
    }
    if(repLog[i]) cls+=" done";
    else if(i===repIdx && phase!=="idle") cls+=" now";
    var sep = i ? '<span class="arrow">→</span>' : '';
    return sep+'<span class="'+cls+'">'+fmt(rep.target)+'</span>';
  }).join("");
  if(phase==="idle"&&reps.length>1) html+='<button type="button" class="reshuffle" id="reshuffle">shuffle</button>';
  r.innerHTML=html;
  var cap=el("repsNote");
  if(mode(scen())==="door"){
    cap.hidden = phase!=="idle";
    cap.innerHTML="Steps are drawn from level 1 up to level "+(doorLevel(scen())+1)+
      " and shuffled, so the door stops predicting anything.";
    return;
  }
  if(phase==="idle"&&reps.length>1){
    cap.hidden=false;
    cap.innerHTML="Warm-ups first, then the one that counts — <b>"+fmt(reps[reps.length-1].target)+
      "</b> alone. You rate the session at the end. About "+fmt(routineLength(reps,restLen(scen())))+
      " start to finish, breaks included.";
  } else if(phase==="idle"){
    cap.hidden=false;
    cap.innerHTML="Time alone: <b>"+fmt(reps[0].target)+"</b>.";
  } else {
    cap.hidden=true;
  }
  if(el("reshuffle")) el("reshuffle").onclick=function(){ shuffle++; render(); };
}

/* ================= session flow ================= */
/* ---- context tags, attached to whatever gets logged ---- */
function tagPanel(parent){
  var box=document.createElement("div");
  box.className="tagbox";
  box.innerHTML='<div class="lab">What else was going on?</div><div class="chips">'+
    TAGS.map(function(t){
      return '<button type="button" class="chip" aria-pressed="'+(tags.indexOf(t)>-1)+'">'+t+'</button>';
    }).join("")+'</div>'+
    '<input class="noteIn" type="text" id="noteIn" maxlength="140" placeholder="Any other notes">';
  parent.appendChild(box);
  box.querySelectorAll(".chip").forEach(function(b){
    b.onclick=function(){
      var t=b.textContent, i=tags.indexOf(t);
      if(i>-1) tags.splice(i,1); else tags.push(t);
      b.setAttribute("aria-pressed", i>-1?"false":"true"); persistActiveRun();
    };
  });
  var input=box.querySelector("#noteIn");
  input.value=note;
  input.oninput=function(){ note=this.value; persistActiveRun(); };
}

var STOP_REASONS=["Dog showed concern","External interruption","Dog needed a break","The plan felt too difficult","Other"];
function stopReasonPanel(parent){
  var box=document.createElement("div"); box.className="stopReason";
  box.innerHTML='<div class="stopBanner"><b>Session ended before the planned target.</b> Rate how your dog coped up to that point. A Success rating will repeat the same target next time rather than increasing or reducing it.</div>'+ 
    '<label for="stopReasonSelect">Why did you stop?</label><select id="stopReasonSelect"><option value="">Choose a reason (optional)</option>'+ 
    STOP_REASONS.map(function(x){return '<option value="'+escAttr(x)+'">'+esc(x)+'</option>';}).join("")+'</select>'+ 
    '<input type="text" id="stopReasonOther" maxlength="80" placeholder="Add a little more detail" style="margin-top:8px" hidden>';
  parent.appendChild(box);
  var sel=box.querySelector("#stopReasonSelect"), other=box.querySelector("#stopReasonOther");
  var existing=pending&&pending.stopReason?pending.stopReason:"";
  if(STOP_REASONS.indexOf(existing)>-1){sel.value=existing;}else if(existing){sel.value="Other";other.hidden=false;other.value=existing;}
  sel.onchange=function(){
    other.hidden=this.value!=="Other";
    pending.stopReason=this.value==="Other"?(other.value.trim()||"Other"):this.value;
    persistActiveRun();
    if(!other.hidden) other.focus();
  };
  other.oninput=function(){pending.stopReason=this.value.trim()||"Other";persistActiveRun();};
}

/* ---- door is a bore: one cue at a time, nothing timed ---- */
function startCue(){
  if(phase==="idle"){
    startedAt=Date.now();
  }
  phase="cue"; clearInterval(tick); persistActiveRun();
  render();
}

function cueDone(){
  repLog[repIdx]={ done:true, cue:reps[repIdx].cue };
  repIdx++;
  if(repIdx>=reps.length){ finishDoor(false); return; }
  phase="rest";
  toRest();
}

function endDoorEarly(){ finishDoor(true); }

function finishDoor(stopped){
  audioStop();
  pending={ stopped:!!stopped, stopReason:"", steps:repLog.filter(Boolean).length, planned:reps.length };
  phase="doorVerdict"; persistActiveRun(); render();
}

function recordDoor(outcome){
  var s=scen(), lvl=doorLevel(s), stopped=!!(pending&&pending.stopped);
  var steps=pending?pending.steps:repLog.filter(Boolean).length;
  var planned=pending?pending.planned:reps.length;
  s.sessions.push({ id:makeId("p"), kind:"door", at:Date.now(), level:lvl, steps:steps,
                    planned:planned, wobbles:outcome==="bad"?1:0, outcome:outcome, stopped:stopped,
                    stopReason:stopped&&pending?textIn(pending.stopReason,80).trim():"",
                    tags:tags.slice(), note:note.trim() });
  graduated=false;
  if(outcome==="success"&&!stopped){
    if(lvl<CUES.length-1) s.doorLevel=lvl+1;
    else graduated=true;
  } else if(outcome==="bad"){
    s.doorLevel=Math.max(0,lvl-1);
  }
  var saved=s.sessions[s.sessions.length-1];
  phase="idle"; pending=null; repIdx=0; repLog=[]; tags=[]; note=""; shuffle=0; clearActiveRun();
  clearInterval(tick);
  save();
  render();
  showToast("Door session saved.","Undo",function(){ removeSessionById(s.id,saved.id); });
}

function graduate(){
  var s=scen();
  s.mode="absence"; s.start=Math.min(s.start||3,3); s.override=null;
  graduated=false; save(); render();
}

/* ---- adjusting today's target ----
   Whatever you set becomes the base this session is judged from, so tomorrow
   builds on the number you actually trained at, not the one the app proposed. */
function drawAdjust(){
  var s=scen(), box=el("adjust");
  if(mode(s)==="door"||phase!=="idle"||capped()){ box.hidden=true; return; }
  box.hidden=false;
  var open=!el("adjustRow").hidden;
  el("adjustOpen").hidden=open;
  el("adjustOpen").textContent = s.override ? "set by hand — adjust" : "adjust";
  if(!open) el("adjVal").value=plan.target;
  adjNote();
}

function adjStep(dir){
  var v=parseInt(el("adjVal").value,10)||plan.target;
  var inc = v<60 ? 1 : v<300 ? 5 : v<1800 ? 15 : 60;
  el("adjVal").value=Math.max(1,v+dir*inc);
  adjNote();
}

function adjNote(){
  var p=el("adjNote"), v=parseInt(el("adjVal").value,10);
  if(el("adjustRow").hidden||!v){ p.hidden=true; return; }
  var from=plan.base, pc=Math.round((v/from-1)*100);
  p.hidden=false;
  if(v>from*1.25){
    p.className="adjNote warn";
    p.textContent="That's "+pc+"% above the current plan. Big jumps can make training harder — "+
      "future sessions will continue from the time you choose.";
  } else if(v<from*0.5){
    p.className="adjNote";
    p.textContent="Well below the plan. Fine if you're rebuilding after a bad patch — tomorrow will build from here.";
  } else {
    p.className="adjNote";
    p.textContent="Tomorrow builds from this number rather than "+fmt(from)+".";
  }
}

function drawActions(){
  var a=el("actions"); a.innerHTML="";
  var sc=scen();
  document.body.classList.toggle("is-live", phase!=="idle");

  if(mode(sc)==="door"){
    if(phase==="cue"){
      btn(a,"Step done",cueDone);
      btn(a,"End session early",endDoorEarly,false,true);
      return;
    }
    if(phase==="rest"){
      btn(a,"Next step",startCue);
      btn(a,"End session early",endDoorEarly,false,true);
      return;
    }
    if(phase==="doorVerdict"){
      if(pending&&pending.stopped) stopReasonPanel(a);
      tagPanel(a);
      ask(a,"How was "+dogName()+" across the session?",[
        ["success","Relaxed","Calm overall. Following you or waiting by the door is fine if they could settle."],
        ["ok","Some unease","Alert or watchful and slower to settle, but no clear distress."],
        ["bad","Not settled","Could not relax, escalating vocalising, pacing, panting or clear distress."]
      ],recordDoor);
      return;
    }
    if(phase==="idle"&&graduated){
      btn(a,"Move on to timed departures",graduate);
      return;
    }
    if(phase==="idle"&&capped()){
      btn(a,"Done for today",null,true);
      btn(a,"Switch to timed departures",graduate,false,true);
      return;
    }
    if(phase==="idle"){
      btn(a,"Start the session",startCue);
      btn(a,"Switch to timed departures",graduate,false,true);
      return;
    }
  }

  if(phase==="verdictMain"){
    if(pending&&pending.stopped) stopReasonPanel(a);
    tagPanel(a);
    ask(a,"How was "+dogName()+"?",[
      ["success","Success","Settled quickly and stayed relaxed the whole time."],
      ["ok","OK","Held it together, but you saw unease — pacing, panting, a whine."],
      ["bad","Not good","Vocalising, panic, couldn't settle. You came back to a worried dog."]
    ],reviewSession);
    return;
  }

  if(phase==="rest"){
    var next=reps[repIdx];
    btn(a,(next.kind==="main"?"Start the main absence":"Start warm-up "+(repIdx+1)),startRep);
    btn(a,"End session early",endEarly,false,true);
    return;
  }

  if(phase==="running"){
    btn(a,"I'm back",stopRep);
    return;
  }

  if(phase==="idle"&&capped()){
    btn(a,"Done for today",null,true);
    return;
  }
  btn(a, reps.length>1 ? "Start warm-up 1" : "Start the absence", startRep);
}

function btn(parent,label,fn,disabled,ghost){
  var b=document.createElement("button");
  b.className="btn"+(ghost?" ghost":"");
  b.textContent=label; b.onclick=fn;
  if(disabled){ b.disabled=true; b.style.opacity=".45"; b.style.cursor="default"; b.onclick=null; }
  parent.appendChild(b);
}

function ask(parent,question,opts,fn){
  var q=document.createElement("p");
  q.style.cssText="margin:0 0 4px;font-size:15px";
  q.textContent=question;
  var wrap=document.createElement("div"); wrap.className="verdicts";
  opts.forEach(function(v){
    var b=document.createElement("button");
    b.className="verdict "+(CLS[v[0]]||(v[0]==="fine"?"v-good":"v-bad"));
    b.innerHTML='<span class="bar"></span><span class="txt"><span class="k">'+v[1]+
                '</span><span class="d">'+v[2]+'</span></span>';
    b.onclick=function(){ fn(v[0]); };
    wrap.appendChild(b);
  });
  parent.appendChild(q); parent.appendChild(wrap);
}

function startRep(){
  var beginsSession=phase==="idle"&&repIdx===0;
  phase="running"; startedAt=Date.now(); chimed=false; preChimed=false;
    persistActiveRun(); requestReturnNotificationPermission(); audioStart();
  drawActions(); drawTabs(); drawHeadline(); drawReps();
  el("coach").hidden=true; runTicker();
}

function runTicker(){
  clearInterval(tick);
  var c=el("clock"), target=current().target, lastMediaLeft=null, lastCheckpoint=0;
  var label=current().kind==="main"?"Main absence":"Warm-up "+(repIdx+1)+" of "+(reps.length-1);
  nowPlaying(label+" · "+fmt(target),dogName()+" · "+scen().label);
  setMediaCountdown(target,Math.max(0,(Date.now()-startedAt)/1000));
  function paint(){
    var now=Date.now();
    var elapsed=Math.max(0,(now-startedAt)/1000);
    var e=Math.round(elapsed), left=target-e;
    if(now-lastCheckpoint>=5000){
      lastCheckpoint=now;
      persistActiveRun(true);
    }
    var mediaLeft=Math.max(0,Math.ceil(target-elapsed));
    if(left>=0){ c.className="clock live"; c.textContent=fmt(left); }
    else { c.className="clock over"; c.textContent="+"+fmt(-left); }
    el("delta").textContent=left>=0?"Time out of the room.":"Target reached — come back whenever you like.";
    var early=target>5?5:0;
    if(early&&mediaLeft<=early&&mediaLeft>0&&!preChimed){
      preChimed=true;
      persistActiveRun(true);
      playPreChime();
      showReturnNotification(early);
    }
    if(mediaLeft!==lastMediaLeft){
      lastMediaLeft=mediaLeft;
      setMediaCountdown(target,Math.min(target,elapsed));
      if(mediaLeft>0){
        nowPlaying((preChimed?"Head back soon":label)+" · "+fmt(mediaLeft)+" left",dogName()+" · "+scen().label);
      }
    }
    if(left<=0&&!chimed){
      chimed=true;
      persistActiveRun(true);
      audioStop();
      playChime();
      setTimeout(clearMediaOwnership,1200);
    }
  }
  paint(); tick=setInterval(paint,250);
}

function stopRep(){
  clearInterval(tick);
  var actual=Math.max(1,Math.round((Date.now()-startedAt)/1000)), rep=current();
  if(actual<3){
    audioStop(); phase=repIdx===0?"idle":"rest";
    if(phase==="rest") restEnds=Date.now(); else clearActiveRun();
    el("clock").className="clock"; el("clock").textContent=fmt(rep.target);
    el("delta").textContent="That was under three seconds — nothing logged.";
    if(phase==="rest") persistActiveRun(); else save();
    drawActions(); drawTabs(); drawHeadline(); drawReps(); return;
  }
  audioStop(); el("clock").className="clock"; el("clock").textContent=fmt(actual);
  if(rep.kind==="warm"){
    repLog[repIdx]={target:rep.target,actual:actual,done:true}; repIdx++; toRest(false); return;
  }
  var returnedEarly=actual<rep.target;
  pending={base:plan.base,target:rep.target,actual:actual,easy:!!plan.easy,stopped:returnedEarly,stopReason:"",
    warmups:reps.length-1,warmDone:reps.length-1,warmTimes:repLog.map(function(x){return x?x.actual:0;})};
  phase="verdictMain";
  el("delta").textContent=returnedEarly
    ? "You returned after "+fmt(actual)+", before the "+fmt(rep.target)+" target."
    : "You were gone "+fmt(actual)+" of a "+fmt(rep.target)+" target.";
  persistActiveRun(); drawActions(); drawTabs(); drawHeadline(); drawReps();
}

function toRest(resume){
  var s=scen(), wait=Math.min(restLen(s),mode(s)==="door"?30:restLen(s));
  phase="rest"; if(!resume) restEnds=Date.now()+wait*1000;
  nowPlaying(mode(s)==="door"?"Settle break":"Settle break · next "+fmt(current().target),dogName()+" · "+s.label);
  persistActiveRun(); drawActions(); drawHeadline(); drawReps(); el("coach").hidden=true; clearInterval(tick);
  var c=el("clock");
  function paint(){
    var left=Math.round((restEnds-Date.now())/1000);
    if(left>0){
      if(mode(scen())!=="door"){ c.className="clock rest"; c.textContent=fmt(left); }
      el("delta").textContent=mode(scen())==="door"?"Let "+dogName()+" settle before the next step.":
        "Let "+dogName()+" come back down. Next up: "+fmt(current().target)+".";
    } else {
      clearInterval(tick);
      if(mode(scen())==="door"){ el("delta").textContent="Ready when "+dogName()+" is."; return; }
      c.className="clock"; c.textContent=fmt(current().target);
      el("delta").textContent="Ready when "+dogName()+" is. Next up: "+fmt(current().target)+".";
    }
  }
  paint(); if(restEnds>Date.now()) tick=setInterval(paint,250);
}

function endEarly(){
  clearInterval(tick); audioStop();
  var reached=repLog[repIdx]?repLog[repIdx].actual:(repLog[repIdx-1]?repLog[repIdx-1].actual:1);
  pending={base:plan.base,target:reps[reps.length-1].target,actual:reached,easy:!!plan.easy,
    warmups:reps.length-1,warmDone:repIdx,stopped:true,stopReason:"",warmTimes:repLog.map(function(x){return x?x.actual:0;})};
  phase="verdictMain"; persistActiveRun(); render();
}

function candidateFor(outcome){
  return makeCandidateSession({
    outcome:outcome,
    pending:pending,
    plan:plan,
    tags:tags,
    note:note
  });
}

function nextPlanWith(candidate){
  return previewPlanWithCandidate(scen(),candidate);
}

function reviewSession(outcome){
  reviewCandidate=candidateFor(outcome);
  reviewPlan=nextPlanWith(reviewCandidate);
  el("reviewTarget").textContent=fmt(reviewCandidate.target);
  el("reviewActual").textContent=fmt(reviewCandidate.actual);
  el("reviewStatus").textContent=sessionStatusText(reviewCandidate);
  el("reviewOutcome").textContent=LABEL[reviewCandidate.outcome];
  el("reviewNextTarget").textContent=fmt(reviewPlan.target);
  el("reviewNextReason").textContent=reviewPlan.reason;
  openModal("sessionReviewModal");
  el("reviewSave").focus();
}

function commitReviewedSession(){
  if(!reviewCandidate) return;
  var s=scen(), before=badges(), achievementBefore=achievementSnapshot(state.scenarios), saved=reviewCandidate;
  saved.id=makeId("p");
  saved.at=Date.now();
  audioStop();
  s.sessions.push(saved);
  var after=badges(), achievementAfter=achievementSnapshot(state.scenarios);
  justEarned=MILESTONES.filter(function(m){return after[m.s]&&!before[m.s];});
  achievementQueue=newlyReachedAchievements(achievementBefore,achievementAfter);
  s.override=null;
  reviewCandidate=null; reviewPlan=null;
  closeModal("sessionReviewModal");
  pending=null; phase="idle"; repLog=[]; repIdx=0; retries=0; shuffle=0; tags=[]; note="";
  clearActiveRun(); clearInterval(tick); save();
  render();

  clearTimeout(milestoneTimer);
  var earned=justEarned.length?justEarned[justEarned.length-1]:null;
  if(earned){
    milestoneTimer=setTimeout(function(){
      milestoneTimer=null;
      if(state.scenarios.some(function(x){return x.id===s.id&&x.sessions.some(function(p){return p.id===saved.id;});})){
        openMilestone(earned.s,true);
      }
    },12500);
  }
  clearTimeout(achievementTimer);
  if(achievementQueue.length){
    achievementTimer=setTimeout(function(){
      achievementTimer=null;
      if(state.scenarios.some(function(x){return x.id===s.id&&x.sessions.some(function(p){return p.id===saved.id;});})){
        if(!document.querySelector(".modal:not([hidden])")) showNextAchievement();
        else achievementTimer=setTimeout(showNextAchievement,1200);
      }
    },earned?14200:12500);
  }

  var next=planFor(s);
  showToast("Session saved · next target "+fmt(next.target)+".","Undo",function(){
    clearTimeout(milestoneTimer); milestoneTimer=null;
    clearTimeout(achievementTimer); achievementTimer=null; achievementQueue=[];
    removeSessionById(s.id,saved.id);
  },12000);
}

el("reviewSave").onclick=commitReviewedSession;
el("reviewBack").onclick=function(){
  reviewCandidate=null; reviewPlan=null;
  closeModal("sessionReviewModal");
};

/* ================= milestone board ================= */
function drawBadges(){
  var got=badges(), best=bestSuccess(), box=el("badges");
  var next=MILESTONES.filter(function(m){ return !got[m.s]; })[0];
  var count=Object.keys(got).length;

  el("badgeSub").textContent = count
    ? count+" of "+MILESTONES.length+" earned. A milestone lands when a main absence of that length goes well."
    : "Earned when a main absence of that length goes well. The first is 30 seconds.";

  var grid=MILESTONES.map(function(m){
    var g=got[m.s];
    var cls="badge"+(g?" on":(next&&next.s===m.s?" next":""));
    var sub = g ? new Date(g.at).toLocaleDateString(undefined,{day:"numeric",month:"short"})
                : (next&&next.s===m.s ? "next up" : "&nbsp;");
    if(g) return '<button type="button" class="'+cls+'" data-share-milestone="'+m.s+'" title="Celebrate and share '+escAttr(m.l)+' milestone"><div class="t">'+m.l+'</div><div class="w">'+sub+'</div></button>';
    return '<div class="'+cls+'"><div class="t">'+m.l+'</div><div class="w">'+sub+'</div></div>';
  }).join("");

  var bar="";
  if(next){
    var prev=MILESTONES[MILESTONES.indexOf(next)-1];
    var from=prev?prev.s:0;
    var pc=Math.max(0,Math.min(100,((best-from)/(next.s-from))*100));
    bar='<div class="toNext"><div class="row2"><span>Next: '+next.l+' alone</span><span class="num">'+
      (best>=next.s?"there":fmt(next.s-best)+" to go")+'</span></div>'+
      '<div class="track"><div class="fill" style="width:'+pc.toFixed(1)+'%"></div></div>'+
      '<p class="small" style="margin:6px 0 0">Longest relaxed absence so far: '+(best?fmt(best):"none yet")+'.</p></div>';
  } else {
    bar='<p class="small" style="margin:0 0 12px">Every milestone earned. That is a dog who can be left alone.</p>';
  }
  box.innerHTML=bar+'<div class="badges">'+grid+'</div>';
  box.querySelectorAll("[data-share-milestone]").forEach(function(b){
    b.onclick=function(){openMilestone(parseInt(this.getAttribute("data-share-milestone"),10),false);};
  });
}

function drawCheer(){
  var c=el("cheer"), got=badges();
  justEarned=justEarned.filter(function(m){return !!got[m.s];});
  if(!justEarned.length){ c.hidden=true; return; }
  c.hidden=false;
  var top=justEarned[justEarned.length-1], g=got[top.s];
  var text=justEarned.length>2
    ? '<b>'+justEarned.length+' milestones at once, up to '+top.l+' alone.</b> '+dogNameHtml()+' managed '+fmt(g.actual)+' in '+esc(g.scenario)+'.'
    : justEarned.map(function(m){var x=got[m.s]; return '<b>Milestone: '+m.l+' alone.</b> '+dogNameHtml()+' managed '+fmt(x.actual)+' in '+esc(x.scenario)+'.';}).join("<br>");
  c.innerHTML=text+' <button type="button" class="reshuffle" id="cheerOpen">celebrate &amp; share</button> · <button type="button" class="reshuffle" id="cheerX">dismiss</button>';
  el("cheerOpen").onclick=function(){var m=justEarned[justEarned.length-1];if(m)openMilestone(m.s,true);};
  el("cheerX").onclick=function(){justEarned=[];drawCheer();};
}


/* ================= dashboard and timeline ================= */
function outcomeClass(outcome){
  return outcome==="success"?"success":outcome==="ok"?"ok":"bad";
}
function drawDashboard(){
  var box=el("dashboardGrid"), sub=el("dashboardSub"), s=scen();
  if(mode(s)!=="absence"){
    box.innerHTML='<div class="dashboardCard"><span class="k">Current mode</span><span class="big">Door is a Bore</span><span class="detail">Timed-session statistics will appear after switching to timed departures.</span></div>';
    sub.textContent="A concise view of the current scenario.";
    return;
  }

  var stats=dashboardStats(s,plan), last=stats.last;
  sub.textContent="Current position in "+s.label+".";
  var lastCard=last
    ? '<div class="dashboardCard"><span class="k">Last session</span>'+
      '<span class="big">'+fmt(last.actual)+'</span>'+
      '<span class="detail">'+fmt(last.target)+' planned · '+(last.stopped?"ended early":"completed")+'</span>'+
      '<span class="outcome '+outcomeClass(last.outcome)+'">'+LABEL[last.outcome]+'</span></div>'
    : '<div class="dashboardCard"><span class="k">Last session</span><span class="big">—</span><span class="detail">No timed session logged in this scenario yet.</span></div>';

  var recentDetail=stats.recentCount
    ? stats.recentSuccess+' of the last '+stats.recentCount+' completed calmly'
    : "No recent timed sessions";

  box.innerHTML=lastCard+
    '<div class="dashboardCard"><span class="k">This week</span><span class="big">'+stats.weekCount+'</span>'+
      '<span class="detail">'+stats.weekSuccess+' marked Success</span></div>'+
    '<div class="dashboardCard"><span class="k">Longest calm absence</span><span class="big">'+
      (stats.longestCalmSeconds?fmt(stats.longestCalmSeconds):"—")+'</span>'+
      '<span class="detail">'+(stats.longestCalmSeconds
        ?"Longest completed session marked Success."
        :"No completed Success session yet.")+'</span></div>'+
    '<div class="dashboardCard"><span class="k">Recent consistency</span><span class="big">'+
      (stats.recentCount?stats.recentSuccess+'/'+stats.recentCount:"—")+'</span>'+
      '<span class="detail">'+recentDetail+'</span></div>';
}
function drawTimeline(){
  var box=el("timeline"), section=el("timelineSection"), s=scen();
  if(mode(s)!=="absence"){
    section.hidden=true;
    return;
  }
  section.hidden=false;
  var items=timelineItems(s,plan.target,5);
  box.innerHTML=items.map(function(item){
    if(item.type==="next"){
      return '<div class="timelineItem">'+
        '<span class="timelineDot next"></span>'+
        '<div class="timelineMain"><div class="timelineTitle"><b>Next planned session</b></div>'+
        '<div class="timelineMeta">'+esc(friendlyTargetReason(s,plan).summary)+'</div></div>'+
        '<div class="timelineValue">'+fmt(item.target)+'</div></div>';
    }
    var date=new Date(item.at).toLocaleDateString(undefined,{day:"numeric",month:"short"});
    return '<div class="timelineItem">'+
      '<span class="timelineDot '+outcomeClass(item.outcome)+'"></span>'+
      '<div class="timelineMain"><div class="timelineTitle">'+LABEL[item.outcome]+
        ' · '+(item.stopped?"ended early":"completed")+'</div>'+
      '<div class="timelineMeta">'+date+' · '+fmt(item.target)+' planned</div></div>'+
      '<div class="timelineValue">'+fmt(item.actual)+'</div></div>';
  }).join("");
}
function showNextAchievement(){
  if(!achievementQueue.length) return;
  var achievement=achievementQueue.shift();
  el("achievementTitle").textContent=achievement.title;
  el("achievementDetail").textContent=achievement.detail;
  openModal("achievementModal");
}
el("closeAchievement").onclick=function(){
  closeModal("achievementModal");
  if(achievementQueue.length) setTimeout(showNextAchievement,250);
};

/* ================= tabs ================= */
function drawTabs(){
  var t=el("tabs"); t.innerHTML="";
  state.scenarios.forEach(function(s){
    var b=document.createElement("button"); b.className="tab"; b.type="button";
    b.setAttribute("aria-pressed",s.id===state.active?"true":"false"); b.textContent=s.label;
    b.disabled=phase!=="idle"&&s.id!==state.active;
    if(b.disabled) b.style.opacity=".4";
    b.onclick=function(){if(phase!=="idle")return;state.active=s.id;pending=null;save();render();};
    t.appendChild(b);
  });
  var add=document.createElement("button"); add.className="tab add"; add.type="button"; add.textContent="+";
  add.setAttribute("aria-label","Add a scenario"); if(phase!=="idle"){add.disabled=true;add.style.opacity=".4";}
  add.onclick=function(){el("newrow").classList.add("on");el("newName").focus();}; t.appendChild(add);
}

/* ================= charts ================= */
function drawCharts(){
  var box=el("charts"), s=scen();
  var any=state.scenarios.some(function(x){return x.sessions.length;});
  if(mode(s)==="door"&&!absOf(s).length&&!any){ box.innerHTML=""; }
  el("chartsSub").textContent = any
    ? "Saved on this device, so it's all still here next time you open the app."
    : "Charts appear once you've logged a session or two.";
  if(!any){ box.innerHTML=""; return; }
  box.innerHTML = chartDuration() + chartStreak() + chartScenarios() + chartTags();
}

/* 1 — duration over sessions */
function chartDuration(){
  var s=scen();
  var series = chartMode==="all"
    ? state.scenarios.filter(function(x){return absOf(x).length>1;})
    : [s];
  if(chartMode==="one"&&absOf(s).length<2)
    return card("Duration per session","<p class='empty'>Two sessions in "+esc(s.label)+" and this fills in.</p>",modeToggle());
  if(!series.length)
    return card("Duration per session","<p class='empty'>No scenario has two sessions yet.</p>",modeToggle());

  var W=600,H=210,PL=46,PR=10,PT=12,PB=26;
  var maxLen=Math.max.apply(null,series.map(function(x){return Math.min(absOf(x).length,30);}));
  var vals=[]; series.forEach(function(x){ absOf(x).slice(-30).forEach(function(p){ vals.push(p.target); }); });
  if(chartMode==="one") vals.push(plan.target);
  var max=Math.max.apply(null,vals)*1.12, min=0;
  var X=function(i){ return maxLen<2?PL:PL+(i/(maxLen-1))*(W-PL-PR); };
  var Y=function(v){ return PT+(1-(v-min)/(max-min))*(H-PT-PB); };

  var g="";
  [0,.25,.5,.75,1].forEach(function(f){
    var v=max*f, y=Y(v);
    g+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/>';
    g+='<text x="'+(PL-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="var(--muted)" '+
       'font-family="IBM Plex Mono, monospace">'+(f===0?"0":fmt(v))+'</text>';
  });

  series.forEach(function(x,si){
    var pts=absOf(x).slice(-30);
    var stroke = chartMode==="all" ? LINES[si%LINES.length] : "var(--muted)";
    var path=pts.map(function(p,i){ return (i?"L":"M")+X(i).toFixed(1)+" "+Y(p.target).toFixed(1); }).join(" ");
    g+='<path d="'+path+'" fill="none" stroke="'+stroke+'" stroke-width="1.6" stroke-linejoin="round"/>';
    if(chartMode==="one"){
      pts.forEach(function(p,i){
        g+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.target).toFixed(1)+'" r="4" fill="'+COLOUR[p.outcome]+'"/>';
      });
    }
  });

  if(chartMode==="one"){
    var y=Y(plan.target);
    g+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+y.toFixed(1)+
       '" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4"/>';
    g+='<text x="'+(W-PR)+'" y="'+(y-7).toFixed(1)+'" text-anchor="end" font-size="10" fill="var(--ink)" '+
       'font-family="IBM Plex Mono, monospace">today '+fmt(plan.target)+'</text>';
  }
  g+='<text x="'+PL+'" y="'+(H-6)+'" font-size="10" fill="var(--muted)" font-family="IBM Plex Mono, monospace">earliest</text>';
  g+='<text x="'+(W-PR)+'" y="'+(H-6)+'" text-anchor="end" font-size="10" fill="var(--muted)" font-family="IBM Plex Mono, monospace">latest</text>';

  var legend = chartMode==="all"
    ? '<div class="legend">'+series.map(function(x,i){
        return '<span><i class="swatch" style="background:'+LINES[i%LINES.length]+'"></i>'+esc(x.label)+'</span>';
      }).join("")+'</div>'
    : '<div class="legend">'+["success","ok","bad"].map(function(k){
        return '<span><i class="dot" style="background:'+COLOUR[k]+'"></i>'+LABEL[k]+'</span>';
      }).join("")+'</div>';

  return card("Duration per session",
    '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Absence duration over time">'+g+'</svg>'+legend,
    modeToggle());
}

function modeToggle(){
  return '<div class="toggle">'+
    '<button type="button" data-mode="one" aria-pressed="'+(chartMode==="one")+'">This scenario</button>'+
    '<button type="button" data-mode="all" aria-pressed="'+(chartMode==="all")+'">All scenarios</button></div>';
}

/* 2 — recent outcomes and headline numbers */
function chartStreak(){
  var s=scen(), abs=absOf(s), pts=abs.slice(-14);
  if(!pts.length) return "";
  var blocks=pts.map(function(p){
    return '<i class="blk" style="background:'+COLOUR[p.outcome]+'" title="'+fmt(p.target)+' — '+LABEL[p.outcome]+'"></i>';
  }).join("");
  var last10=abs.slice(-10);
  var good=last10.filter(function(p){return p.outcome==="success";}).length;
  var rate=Math.round(good/last10.length*100);
  var best=Math.max.apply(null, abs.filter(function(p){ return p.outcome==="success"&&!p.stopped; })
    .map(function(p){ return p.actual; }).concat([0]));
  var first=abs[0].target;
  var growth=Math.round((plan.base/first-1)*100);
  var stats='<div class="stat">'+
    '<div><div class="n">'+rate+'%</div><div class="l">relaxed, last '+last10.length+'</div></div>'+
    '<div><div class="n">'+(best?fmt(best):"—")+'</div><div class="l">longest alone</div></div>'+
    '<div><div class="n">'+(growth>=0?"+":"")+growth+'%</div><div class="l">since session one</div></div>'+
    '<div><div class="n">'+abs.length+'</div><div class="l">absences logged</div></div></div>';
  return card("Recent sessions in "+esc(s.label),'<div class="streak">'+blocks+'</div>'+stats);
}

/* 3 — where each scenario stands */
function chartScenarios(){
  var live=state.scenarios.filter(function(x){return absOf(x).length&&mode(x)==="absence";});
  if(live.length<2) return "";
  var max=Math.max.apply(null,live.map(function(x){return planFor(x).base;}));
  var rows=live.map(function(x){
    var b=planFor(x).base, w=Math.max(2,(b/max)*100);
    var la=absOf(x); var lastOut=la[la.length-1].outcome;
    return '<div style="margin-bottom:12px">'+
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'+
        '<span>'+esc(x.label)+(x.id===state.active?' <span style="color:var(--muted)">· showing</span>':'')+'</span>'+
        '<span class="num" style="font-family:ui-monospace,monospace">'+fmt(b)+'</span></div>'+
      '<div style="height:8px;background:var(--line-soft);border-radius:2px;overflow:hidden">'+
        '<div style="height:100%;width:'+w.toFixed(1)+'%;background:'+COLOUR[lastOut]+'"></div></div></div>';
  }).join("");
  return card("Where each scenario has got to", rows+
    '<p class="small" style="margin:2px 0 8px">Bar colour is how the last session in that scenario went.</p>');
}

/* 4 — does context make a difference? */
function chartTags(){
  var all=[];
  state.scenarios.forEach(function(sc){ sc.sessions.forEach(function(p){
    if(p.tags&&p.tags.length) all.push(p);
  }); });
  if(all.length<4) return "";
  var by={};
  all.forEach(function(p){ p.tags.forEach(function(t){
    if(!by[t]) by[t]={n:0,good:0};
    by[t].n++; if(p.outcome==="success") by[t].good++;
  }); });
  var keys=Object.keys(by).filter(function(t){ return by[t].n>=2; })
    .sort(function(a,b){ return (by[b].good/by[b].n)-(by[a].good/by[a].n); });
  if(!keys.length) return "";
  var rows=keys.map(function(t){
    var r=Math.round(by[t].good/by[t].n*100);
    var col = r>=67?"var(--green)":r>=34?"var(--ochre)":"var(--red)";
    return '<div style="margin-bottom:11px">'+
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'+
      '<span>'+esc(t)+'</span><span style="font-family:ui-monospace,monospace;color:var(--muted)">'+
      r+'% · '+by[t].n+'</span></div>'+
      '<div style="height:8px;background:var(--line-soft);border-radius:2px;overflow:hidden">'+
      '<div style="height:100%;width:'+r+'%;background:'+col+'"></div></div></div>';
  }).join("");
  return card("How it goes, by context", rows+
    '<p class="small" style="margin:2px 0 8px">Share of sessions marked Success, and how many carried that tag. '+
    'Small numbers are a hint, not a verdict.</p>');
}

function card(title, body, pre){
  return '<div class="chart"><h3>'+title+'</h3>'+(pre||"")+body+'</div>';
}

/* ================= log ================= */
function drawLog(){
  var s=scen(), b=el("logBody"); el("logSub").textContent=s.label;
  if(!s.sessions.length){b.innerHTML='<p class="empty">Nothing logged in '+esc(s.label)+' yet. Your first session will appear here.</p>';return;}
  var rows=s.sessions.slice().reverse().map(function(p,idx){
    var original=s.sessions.length-1-idx, n=original+1, d=new Date(p.at), extra="";
    if((p.tags&&p.tags.length)||p.note||p.stopReason){
      extra="<tr><td colspan='7' class='logNote'>"+(p.stopReason?'<span class="chip">Stopped: '+esc(p.stopReason)+'</span> ':"")+
        (p.tags||[]).map(function(t){return '<span class="chip">'+esc(t)+'</span>';}).join("")+
        (p.note?" "+esc(p.note):"")+"</td></tr>";
    }
    var edit="<button type='button' class='sessionAction' data-edit-index='"+original+"'>Edit</button>";
    if(p.kind==="door"){
      return "<tr><td class='num'>"+n+"</td><td class='num'>"+d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+
        "</td><td class='num' title='Door is a Bore, level "+(p.level+1)+"'>L"+(p.level+1)+"</td><td class='num'>"+
        p.steps+"/"+(p.planned||p.steps)+" steps</td><td class='num'>—</td><td class='tag "+CLS[p.outcome]+"'>"+
        (p.stopped?"Stopped":LABEL[p.outcome])+"</td><td>"+edit+"</td></tr>"+extra;
    }
    var w=p.warmups==null?"—":(p.stopped?p.warmDone+"/"+p.warmups:String(p.warmups));
    var wt=p.warmTimes&&p.warmTimes.length?" title='Warm-ups: "+p.warmTimes.map(fmt).join(", ")+" — not counted as time alone'":"";
    return "<tr><td class='num'>"+n+"</td><td class='num'>"+d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+
      "</td><td class='num'"+wt+">"+w+"</td><td class='num'>"+fmt(p.target)+(p.easy?" ·":"")+"</td><td class='num'>"+
      (p.stopped?"—":fmt(p.actual))+"</td><td class='tag "+CLS[p.outcome]+"'>"+(p.stopped?"Stopped":LABEL[p.outcome])+"</td><td>"+edit+"</td></tr>"+extra;
  }).join("");
  b.innerHTML='<div class="tableWrap"><table><thead><tr><th>#</th><th>Date</th><th title="Warm-ups completed">W/up</th><th>Target</th><th>Actual</th><th>How it went</th><th></th></tr></thead><tbody>'+rows+
    '</tbody></table></div><button class="undo" id="undo">Delete the last session in '+esc(s.label)+'</button>';
  b.querySelectorAll("[data-edit-index]").forEach(function(x){x.onclick=function(){openSessionEditor(parseInt(this.getAttribute("data-edit-index"),10));};});
  el("undo").onclick=function(){
    if(confirm("Delete the most recent "+s.label+" session?")){
      var removed=s.sessions.pop(); justEarned=[]; save(); render();
      showToast("Last session deleted.","Undo",function(){s.sessions.push(removed);save();render();});
    }
  };
}

/* ================= editing, export and notices ================= */
var toastTimer=null, toastUndo=null;
function showToast(message,action,fn,duration){
  clearTimeout(toastTimer); var t=el("toast"); el("toastText").textContent=message; toastUndo=fn||null;
  var b=el("toastAction"); b.hidden=!action; b.textContent=action||""; t.hidden=false;
  toastTimer=setTimeout(function(){t.hidden=true;toastUndo=null;},duration||6000);
}
el("toastAction").onclick=function(){var fn=toastUndo;el("toast").hidden=true;toastUndo=null;if(fn)fn();};
function removeSessionById(scenarioId,id){
  var s=state.scenarios.filter(function(x){return x.id===scenarioId;})[0]; if(!s)return;
  var i=s.sessions.findIndex(function(p){return p.id===id;}); if(i<0)return;
  s.sessions.splice(i,1); justEarned=[]; save(); render();
}
function localDateValue(ms){
  var d=new Date(ms), z=d.getTimezoneOffset()*60000; return new Date(d.getTime()-z).toISOString().slice(0,16);
}
function closeModal(id){el(id).hidden=true;if(!document.querySelector(".modal:not([hidden])"))document.body.classList.remove("modalOpen");}
function openModal(id){el(id).hidden=false;document.body.classList.add("modalOpen");}
function openSessionEditor(index){
  editingIndex=index==null?null:index; var s=scen(), p=editingIndex==null?null:s.sessions[editingIndex];
  el("sessionTitle").textContent=p?"Edit session":"Add past absence";
  el("sessionSub").textContent=p?"Correct the saved details. Progress and milestones will recalculate automatically.":"Add an absence completed without running the timer.";
  el("sessionWhen").value=localDateValue(p?p.at:Date.now());
  var door=p&&p.kind==="door"; el("timedSessionFields").hidden=!!door;
  el("sessionTarget").required=!door; el("sessionActual").required=!door;
  var suggested=planFor(s).target;
  el("sessionTarget").value=p&&!door?p.target:suggested; el("sessionActual").value=p&&!door?p.actual:suggested;
  el("sessionOutcome").value=p?p.outcome:"success"; el("sessionStopped").checked=!!(p&&p.stopped);
  el("sessionStopReason").value=p?p.stopReason||"":""; el("sessionStopReasonField").hidden=!el("sessionStopped").checked;
  el("sessionTags").value=p&&p.tags?p.tags.join(", "):""; el("sessionNote").value=p?p.note||"":"";
  el("sessionDelete").hidden=!p; openModal("sessionModal"); el("sessionWhen").focus();
}
el("sessionCancel").onclick=function(){closeModal("sessionModal");};
el("sessionStopped").onchange=function(){el("sessionStopReasonField").hidden=!this.checked;if(!this.checked)el("sessionStopReason").value="";};
el("sessionForm").onsubmit=function(e){
  e.preventDefault(); var s=scen(), existing=editingIndex==null?null:s.sessions[editingIndex], door=existing&&existing.kind==="door";
  var at=new Date(el("sessionWhen").value).getTime(); if(!isFinite(at)){alert("Choose a valid date and time.");return;}
  var p=existing||{id:makeId("p"),kind:"absence",warmups:0,warmDone:0,warmTimes:[],easy:false};
  p.at=at; p.outcome=validOutcome(el("sessionOutcome").value); p.stopped=el("sessionStopped").checked;
  p.stopReason=p.stopped?el("sessionStopReason").value.trim().slice(0,80):"";
  p.tags=el("sessionTags").value.split(",").map(function(x){return x.trim().slice(0,40);}).filter(Boolean).slice(0,20);
  p.note=el("sessionNote").value.trim().slice(0,140);
  if(!door){
    var target=intIn(el("sessionTarget").value,1,14400,0), actual=intIn(el("sessionActual").value,1,14400,0);
    if(!target||!actual){alert("Enter valid target and actual times.");return;}
    p.target=target;p.actual=actual;p.base=target;p.kind="absence";
    if(actual<target) p.stopped=true;
    var floor=Math.max(1,Math.round(target*0.5));
    if(!p.stopped&&actual<target*0.75) p.base=Math.max(floor,actual);
    if(!p.stopped&&p.outcome==="bad"&&actual<p.base) p.base=Math.max(floor,actual);
  }
  if(existing){s.sessions[editingIndex]=p;}else{s.sessions.push(p);s.sessions.sort(function(a,b){return a.at-b.at;});}
  justEarned=[]; closeModal("sessionModal"); save(); render();
  if(!existing)showToast("Past absence added.","Undo",function(){removeSessionById(s.id,p.id);}); else showToast("Session updated.");
};
el("sessionDelete").onclick=function(){
  if(editingIndex==null)return; var s=scen(); if(!confirm("Delete this session?"))return;
  var removed=s.sessions.splice(editingIndex,1)[0], where=editingIndex; justEarned=[]; closeModal("sessionModal"); save(); render();
  showToast("Session deleted.","Undo",function(){s.sessions.splice(where,0,removed);save();render();});
};
function csvCell(v){v=String(v==null?"":v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function downloadBlob(name,type,content){
  var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function exportCsv(){
  var rows=[["scenario","type","date","target_seconds","actual_seconds","outcome","stopped_early","stop_reason","warmups_completed","tags","note"]];
  state.scenarios.forEach(function(s){s.sessions.forEach(function(p){rows.push([s.label,p.kind==="door"?"door exercise":"timed absence",new Date(p.at).toISOString(),
    p.kind==="door"?"":p.target,p.kind==="door"?"":p.actual,p.outcome,p.stopped?"yes":"no",p.stopReason||"",p.kind==="door"?p.steps:(p.warmDone==null?"":p.warmDone),
    (p.tags||[]).join(" | "),p.note||""]);});});
  downloadBlob("threshold-sessions-"+new Date().toISOString().slice(0,10)+".csv","text/csv;charset=utf-8","\ufeff"+rows.map(function(r){return r.map(csvCell).join(",");}).join("\r\n"));
}

/* ================= milestone certificates and sharing ================= */
var activeMilestone=null;
function milestoneBySeconds(seconds){return MILESTONES.filter(function(m){return m.s===seconds;})[0]||null;}
function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function fitCanvasText(ctx,text,maxWidth,startSize,minSize,weight,family){
  var size=startSize;
  family=family||"Georgia, Times New Roman, serif";
  while(size>minSize){
    ctx.font=(weight||"600")+" "+size+"px "+family;
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=2;
  }
  return size;
}
function confettiMark(ctx,x,y,angle,length,width,colour,shape){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=colour;
  if(shape==="diamond"){
    ctx.rotate(Math.PI/4);ctx.fillRect(-width/2,-width/2,width,width);
  }else if(shape==="dot"){
    ctx.beginPath();ctx.arc(0,0,width/2,0,Math.PI*2);ctx.fill();
  }else{
    roundedRect(ctx,-length/2,-width/2,length,width,width/2);ctx.fill();
  }
  ctx.restore();
}
function drawCertificate(m,g){
  var canvas=el("certificateCanvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
  var name=dogName(),date=new Date(g.at).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"});
  var scenario=String(g.scenario||"");

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#F5F1EA";ctx.fillRect(0,0,W,H);

  /* warm paper panel and understated double border */
  ctx.fillStyle="#FFFDFC";roundedRect(ctx,28,28,W-56,H-56,28);ctx.fill();
  ctx.strokeStyle="#D5C6B5";ctx.lineWidth=2;roundedRect(ctx,45,45,W-90,H-90,22);ctx.stroke();
  ctx.strokeStyle="#E8DED2";ctx.lineWidth=1;roundedRect(ctx,57,57,W-114,H-114,17);ctx.stroke();

  /* restrained confetti marks, kept to the corners */
  var amber="#E08A34",green="#4A9A72",ochre="#C8912A",ink="#6F665D";
  [
    [92,95,-0.7,24,6,amber,"line"],[124,79,0.25,18,5,green,"line"],[151,111,0,0,9,ochre,"diamond"],
    [1087,92,0.72,24,6,green,"line"],[1057,76,-0.2,18,5,amber,"line"],[1029,111,0,0,9,ochre,"diamond"],
    [95,574,0.65,23,6,green,"line"],[128,595,-0.25,18,5,amber,"line"],[158,565,0,0,8,ochre,"diamond"],
    [1086,578,-0.72,23,6,amber,"line"],[1054,598,0.25,18,5,green,"line"],[1025,565,0,0,8,ochre,"diamond"]
  ].forEach(function(x){confettiMark(ctx,x[0],x[1],x[2],x[3],x[4],x[5],x[6]);});

  ctx.textAlign="center";ctx.textBaseline="alphabetic";

  /* brand */
  ctx.fillStyle="#2E2A26";ctx.font="700 24px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("THRESHOLD",W/2,98);
  ctx.fillStyle="#8A8178";ctx.font="500 14px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("SEPARATION ANXIETY TRAINING",W/2,122);

  /* accolade */
  ctx.fillStyle=amber;ctx.font="700 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("MILESTONE ACHIEVED",W/2,170);
  ctx.fillStyle="#D8CFC5";ctx.fillRect(W/2-74,187,148,2);

  /* dog name */
  var nameSize=fitCanvasText(ctx,name,W-260,66,38,"600","Georgia, Times New Roman, serif");
  ctx.fillStyle="#2E2A26";ctx.font="600 "+nameSize+"px Georgia, Times New Roman, serif";
  ctx.fillText(name,W/2,257);

  ctx.fillStyle="#7C746B";ctx.font="400 22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("completed a calm absence of",W/2,300);

  /* milestone */
  var milestone=String(m.l).toUpperCase();
  var milestoneSize=fitCanvasText(ctx,milestone,W-250,112,74,"700","system-ui, -apple-system, Segoe UI, sans-serif");
  ctx.fillStyle=green;ctx.font="700 "+milestoneSize+"px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(milestone,W/2,408);
  ctx.fillStyle="#2E2A26";ctx.font="700 20px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("CALMLY ALONE",W/2,445);

  /* detail rule and record */
  ctx.fillStyle="#E8DED2";ctx.fillRect(275,475,W-550,2);
  var detail=date+"  ·  "+scenario;
  var detailSize=fitCanvasText(ctx,detail,W-240,22,16,"500","system-ui, -apple-system, Segoe UI, sans-serif");
  ctx.fillStyle="#746B62";ctx.font="500 "+detailSize+"px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(detail,W/2,516);

  /* simple seal */
  ctx.strokeStyle="#D9CEC1";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,551,24,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=green;ctx.font="700 22px system-ui, -apple-system, Segoe UI, sans-serif";ctx.fillText("✓",W/2,559);

  ctx.fillStyle=ink;ctx.font="600 23px Georgia, Times New Roman, serif";
  ctx.fillText("A new threshold reached.",W/2,594);
  ctx.fillStyle="#A79E93";ctx.font="500 14px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Recorded with Threshold",W/2,618);
}
function openMilestone(seconds,celebrating){
  var m=milestoneBySeconds(seconds),g=badges()[seconds];if(!m||!g)return;
  activeMilestone={m:m,g:g};
  el("milestoneTitle").textContent=celebrating?"A new Threshold milestone!":"Celebrate "+m.l+" alone";
  var extra=celebrating&&justEarned.length>1?" You unlocked "+justEarned.length+" milestones in this session.":"";
  el("milestoneSub").textContent=dogName()+" managed "+fmt(g.actual)+" relaxed in "+g.scenario+"."+extra;
  drawCertificate(m,g);openModal("milestoneModal");
}
function certificateName(){
  if(!activeMilestone)return "threshold-milestone.png";
  return "threshold-"+dogName().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+activeMilestone.m.l.replace(/\s+/g,"-")+".png";
}
function certificateBlob(){
  return new Promise(function(resolve,reject){el("certificateCanvas").toBlob(function(b){b?resolve(b):reject(new Error("Could not create certificate"));},"image/png");});
}
function saveBlob(blob,name){
  var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
async function shareCurrentMilestone(){
  if(!activeMilestone)return;
  var text=dogName()+" reached a new separation anxiety training milestone: "+activeMilestone.m.l+" relaxed alone!";
  try{
    var blob=await certificateBlob(),file=new File([blob],certificateName(),{type:"image/png"});
    if(navigator.share){
      if(!navigator.canShare||navigator.canShare({files:[file]})) await navigator.share({title:"Threshold milestone",text:text,files:[file]});
      else await navigator.share({title:"Threshold milestone",text:text});
      return;
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);showToast("Share text copied. Use Save certificate for the image.");return;}
    saveBlob(blob,certificateName());showToast("Certificate saved — share it from your photos or files.");
  }catch(e){if(e&&e.name==="AbortError")return;showToast("Sharing was not available. Try saving the certificate instead.");}
}
el("shareMilestone").onclick=shareCurrentMilestone;
el("downloadCertificate").onclick=async function(){try{saveBlob(await certificateBlob(),certificateName());showToast("Certificate saved.");}catch(e){showToast("The certificate could not be saved.");}};
el("closeMilestone").onclick=function(){closeModal("milestoneModal");};

/* ================= wiring ================= */
el("charts").addEventListener("click",function(e){
  var b=e.target.closest("button[data-mode]");
  if(b){ chartMode=b.getAttribute("data-mode"); drawCharts(); }
});
el("addGo").onclick=function(){
  var v=el("newName").value.trim();
  if(!v) return;
  var id="s"+Date.now();
  state.scenarios.push({ id:id, label:v, start:scen().start||5, warmups:4, rest:60, sessions:[], override:null });
  state.active=id; el("newName").value=""; el("newrow").classList.remove("on");
  save(); render();
};
el("newName").addEventListener("keydown",function(e){ if(e.key==="Enter") el("addGo").click(); });
el("addCancel").onclick=function(){ el("newrow").classList.remove("on"); el("newName").value=""; };
el("addPast").onclick=function(){openSessionEditor(null);};
el("exportCsv").onclick=exportCsv;
el("dogName").oninput=function(){ state.name=this.value; save(); };
el("dogName").onchange=function(){ markSettingsSaved(); render(); };
el("adjustOpen").onclick=function(){ el("adjustRow").hidden=false; drawAdjust(); el("adjVal").focus(); };
el("adjCancel").onclick=function(){ el("adjustRow").hidden=true; drawAdjust(); };
el("adjMinus").onclick=function(){ adjStep(-1); };
el("adjPlus").onclick=function(){ adjStep(1); };
el("adjVal").oninput=adjNote;
el("adjVal").addEventListener("keydown",function(e){ if(e.key==="Enter") el("adjSet").click(); });
el("adjSet").onclick=function(){
  var v=parseInt(el("adjVal").value,10);
  if(!(v>0)) return;
  scen().override=v; el("adjustRow").hidden=true; shuffle++; save(); render();
};
el("modeToggle").onclick=function(){
  var s=scen();
  if(phase!=="idle") return;
  if(mode(s)==="door"){
    graduate();
    return;
  }
  s.mode="door";
  if(s.doorLevel==null) s.doorLevel=0;
  graduated=false; save(); render();
};
el("soundToggle").onclick=function(){
  state.soundOff=!state.soundOff;
  if(state.soundOff) audioStop(); 
  save(); render();
};
var settingsSavedTimer=null;
function markSettingsSaved(){
  var status=el("settingsSaved");
  if(!status) return;
  clearTimeout(settingsSavedTimer);
  status.textContent="Saved on this device.";
  settingsSavedTimer=setTimeout(function(){
    status.textContent="Changes save when you leave a field or press Enter.";
  },2500);
}
var flushStartDur=bindNumberSetting({
  input:el("startDur"),limits:SETTING_LIMITS.startDuration,
  getValue:function(){return scen().start;},
  setValue:function(value){scen().start=value;},
  canEdit:function(){return phase==="idle";},
  save:save,confirm:markSettingsSaved,toast:showToast
});
var flushDailyCap=bindNumberSetting({
  input:el("dailyCap"),limits:SETTING_LIMITS.dailyCap,
  getValue:function(){return dailyCap();},
  setValue:function(value){state.dailyCap=value;},
  save:save,confirm:markSettingsSaved,toast:showToast
});
var flushWarmups=bindNumberSetting({
  input:el("warmups"),limits:SETTING_LIMITS.warmups,
  getValue:function(){return nWarm(scen());},
  setValue:function(value){scen().warmups=value;},
  canEdit:function(){return phase==="idle";},
  save:save,confirm:markSettingsSaved,toast:showToast
});
var flushRestLen=bindNumberSetting({
  input:el("restLen"),limits:SETTING_LIMITS.restLength,
  getValue:function(){return restLen(scen());},
  setValue:function(value){scen().rest=value;},
  save:save,confirm:markSettingsSaved,toast:showToast
});
function flushNumberSettings(){
  flushStartDur(); flushDailyCap(); flushWarmups(); flushRestLen(); save();
}
var backgroundedAt=0;

function checkpointBeforeBackground(){
  backgroundedAt=Date.now();
  flushNumberSettings();
  if(phase!=="idle") persistActiveRun(true);
}

function resumeAfterInterruption(){
  var wasAwayFor=backgroundedAt?Date.now()-backgroundedAt:0;
  backgroundedAt=0;

  if(phase==="idle"&&loadActiveRun(state)){
    var savedRun=loadActiveRun(state);
    if(activeRunIsRecent(savedRun,24*60*60*1000)&&restoreRun(savedRun)){
      restartRestoredRun(wasAwayFor>1500);
      return;
    }
  }

  if(phase==="running"){
    clearInterval(tick);
    tick=null;
    audioStart();
    runTicker();
    persistActiveRun(true);
    if(wasAwayFor>1500) showToast("Session still running — timer restored.");
  }else if(phase==="rest"){
    clearInterval(tick);
    tick=null;
    toRest(true);
    persistActiveRun(true);
  }else if(phase!=="idle"){
    persistActiveRun(true);
  }
}

window.addEventListener("pagehide",checkpointBeforeBackground);
window.addEventListener("pageshow",function(){
  setTimeout(resumeAfterInterruption,0);
});
document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="hidden"){
    checkpointBeforeBackground();
  }else{
    setTimeout(resumeAfterInterruption,0);
  }
});
document.addEventListener("freeze",checkpointBeforeBackground);
el("dlBackup").onclick=function(){
  downloadBlob("threshold-"+new Date().toISOString().slice(0,10)+".json","application/json",JSON.stringify(state,null,2));
  state.lastBackup=Date.now(); save(); backupWhen();
};
el("pickFile").onclick=function(){ el("restoreFile").click(); };
el("restoreFile").onchange=function(){
  var f=this.files&&this.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(){ applyImport(r.result); };
  r.readAsText(f);
  this.value="";
};
function applyImport(text){
  try{
    var imported=normaliseState(JSON.parse(text));
    if(!confirm("Replace the log on this device with the imported backup?")) return;
    audioStop(); phase="idle"; state=imported; clearActiveRun(); justEarned=[];
    save(); el("dogName").value=state.name||""; render(); showToast("Backup restored.");
  }catch(e){ alert("That file is not a valid Threshold backup, or it contains damaged session data."); }
}
function backupWhen(){
  var n=0; state.scenarios.forEach(function(s){ n+=s.sessions.length; });
  var p=el("backupWhen");
  if(!state.lastBackup){
    p.textContent = n>5
      ? "Never backed up, and there are "+n+" sessions here. Worth downloading one."
      : "A backup file is the only copy that survives clearing your browsing data.";
    return;
  }
  var days=Math.floor((Date.now()-state.lastBackup)/86400000);
  p.textContent="Last backup "+(days===0?"today":days===1?"yesterday":days+" days ago")+".";
}
/* ================= running in the background =================
   You'll be watching the camera, not this. Live Activities and Picture-in-
   Picture aren't available to web apps, so instead: a silent loop keeps the
   page alive once you've backgrounded it, a chime tells you the absence is up,
   and Media Session puts the current step on your lock screen. */
var keeper=null, toneContext=null, wakeLock=null, chimed=false, preChimed=false;

function makeWav(fill, secs, rate){
  rate=rate||8000;
  var n=Math.floor(secs*rate), buf=new ArrayBuffer(44+n*2), v=new DataView(buf), i;
  function str(o,t){ for(var j=0;j<t.length;j++) v.setUint8(o+j,t.charCodeAt(j)); }
  str(0,"RIFF"); v.setUint32(4,36+n*2,true); str(8,"WAVEfmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true); v.setUint16(32,2,true);
  v.setUint16(34,16,true); str(36,"data"); v.setUint32(40,n*2,true);
  for(i=0;i<n;i++) v.setInt16(44+i*2, Math.max(-1,Math.min(1,fill(i/rate)))*32767, true);
  var b=new Uint8Array(buf), s="";
  for(i=0;i<b.length;i++) s+=String.fromCharCode(b[i]);
  return "data:audio/wav;base64,"+btoa(s);
}

function ensureToneContext(){
  if(toneContext) return toneContext;
  var AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass) return null;
  try{ toneContext=new AudioContextClass(); }catch(e){ toneContext=null; }
  return toneContext;
}

function resumeToneContext(){
  var ctx=ensureToneContext();
  if(ctx&&ctx.state==="suspended"){
    try{
      var resumed=ctx.resume();
      if(resumed&&resumed.catch) resumed.catch(function(){});
    }catch(e){}
  }
  return ctx;
}

function scheduleTone(ctx,frequency,startOffset,duration,volume){
  if(!ctx) return;
  try{
    var start=ctx.currentTime+Math.max(0,startOffset||0);
    var end=start+Math.max(0.05,duration||0.2);
    var oscillator=ctx.createOscillator();
    var gain=ctx.createGain();
    oscillator.type="sine";
    oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001,volume||0.12),start+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,end);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end+0.03);
  }catch(e){}
}

function initAudio(){
  resumeToneContext();
  if(keeper||typeof Audio==="undefined") return;
  try{
    keeper=new Audio(makeWav(function(){ return 0; },2,8000));
    keeper.loop=true; keeper.volume=0.02;
    keeper.setAttribute("playsinline","");
    keeper.addEventListener("pause",function(){
      setTimeout(function(){
        if(phase!=="running"||chimed||!keeper||!keeper.paused) return;
        try{
          var resumed=keeper.play();
          if(resumed&&resumed.catch) resumed.catch(function(){});
        }catch(e){}
      },250);
    });
  }catch(e){ keeper=null; }
}

function soundOn(){ return !state.soundOff; }

function audioStart(){
  if(!soundOn()) return;
  initAudio();
  if(keeper){ keeper.currentTime=0; var p=keeper.play(); if(p&&p.catch) p.catch(function(){}); }
  if(navigator.mediaSession){
    try{
      navigator.mediaSession.playbackState="playing";
      // keep the page audible if the OS tries to pause us
      var keepRunning=function(){
        if(phase!=="running"||chimed||!keeper) return;
        try{
          var resumed=keeper.play();
          if(resumed&&resumed.catch) resumed.catch(function(){});
        }catch(e){}
        persistActiveRun(true);
      };
      navigator.mediaSession.setActionHandler("pause",keepRunning);
      navigator.mediaSession.setActionHandler("play",keepRunning);
      navigator.mediaSession.setActionHandler("stop",keepRunning);
    }catch(e){}
  }
  if(navigator.wakeLock&&navigator.wakeLock.request&&!wakeLock){
    navigator.wakeLock.request("screen").then(function(l){
      wakeLock=l; l.addEventListener("release",function(){ wakeLock=null; });
    }).catch(function(){});
  }
}

function clearMediaOwnership(){
  clearMediaCountdown();
  if(!navigator.mediaSession) return;
  try{ navigator.mediaSession.playbackState="none"; }catch(e){}
  try{ navigator.mediaSession.metadata=null; }catch(e){}
  ["play","pause","stop","seekbackward","seekforward","seekto","previoustrack","nexttrack"].forEach(function(action){
    try{ navigator.mediaSession.setActionHandler(action,null); }catch(e){}
  });
}

function audioStop(){
  if(keeper){
    try{ keeper.pause(); }catch(e){}
    try{ keeper.removeAttribute("src"); keeper.load(); }catch(e){}
    keeper=null;
  }
  clearMediaOwnership();
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock=null; }
}
function installedDisplayMode(){
  try{
    return !!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||
      !!navigator.standalone;
  }catch(e){
    return false;
  }
}

function requestReturnNotificationPermission(){
  if(typeof Notification==="undefined"||Notification.permission!=="default") return;
  if(!navigator.serviceWorker||!installedDisplayMode()) return;
  if(typeof ServiceWorkerRegistration!=="undefined"&&
     !("showNotification" in ServiceWorkerRegistration.prototype)) return;
  try{
    var request=Notification.requestPermission();
    if(request&&request.catch) request.catch(function(){});
  }catch(e){}
}

function showReturnNotification(secondsRemaining){
  if(typeof Notification==="undefined"||Notification.permission!=="granted"||!navigator.serviceWorker) return;
  var url=new URL("./",location.href).href;
  var icon=new URL("./assets/icons/icon-192.png",location.href).href;
  var remaining=Number.isFinite(Number(secondsRemaining))
    ?Math.max(1,Math.round(Number(secondsRemaining))):null;
  navigator.serviceWorker.ready.then(function(registration){
    return registration.showNotification("Time to head back",{
      body:(remaining?remaining+" seconds remaining · ":"")+dogName()+" · "+scen().label,
      icon:icon,
      badge:icon,
      tag:"threshold-return",
      renotify:true,
      requireInteraction:true,
      data:{url:url}
    });
  }).catch(function(){});
}


function playChime(){
  if(!soundOn()) return;

  var ctx=resumeToneContext();

  // A fuller two-strike completion chime, distinct from the warning melody.
  scheduleTone(ctx,660,0.00,0.85,0.14);
  scheduleTone(ctx,990,0.00,0.70,0.08);
  scheduleTone(ctx,880,0.42,1.05,0.13);
  scheduleTone(ctx,1320,0.42,0.90,0.07);
}
function playPreChime(){
  if(!soundOn()) return;

  var ctx=resumeToneContext();

  // A gentle rising melody: five seconds remain.
  scheduleTone(ctx,520,0.00,0.50,0.12);
  scheduleTone(ctx,660,0.22,0.55,0.11);
  scheduleTone(ctx,820,0.46,0.60,0.10);
}

function nowPlaying(line,sub){
  if(!navigator.mediaSession||typeof MediaMetadata==="undefined") return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:line, artist:sub, album:"Threshold",
      artwork:[{src:"./assets/icons/icon-192.png",sizes:"192x192",type:"image/png"},
               {src:"./assets/icons/icon-512.png",sizes:"512x512",type:"image/png"}]
    });
  }catch(e){}
}

/* Ask the operating system to render its own moving progress bar/countdown.
   The one-second metadata refresh in runTicker remains as a fallback for
   lock screens that ignore position state or redraw it inconsistently. */
function setMediaCountdown(duration,position){
  if(!navigator.mediaSession||typeof navigator.mediaSession.setPositionState!=="function") return;
  var d=Math.max(1,Number(duration)||1);
  var p=Math.max(0,Math.min(d,Number(position)||0));
  try{
    navigator.mediaSession.setPositionState({duration:d,playbackRate:1,position:p});
  }catch(e){}
}
function clearMediaCountdown(){
  if(!navigator.mediaSession||typeof navigator.mediaSession.setPositionState!=="function") return;
  try{ navigator.mediaSession.setPositionState(); }catch(e){}
}

/* ================= install and durability =================
   Home-screen installs are the single biggest protection against losing a log:
   iOS exempts them from its seven-day eviction of site data, and Chrome treats
   installed apps as important. navigator.storage.persist() asks outright. */
var deferredPrompt=null;

if("serviceWorker" in navigator && location.protocol!=="file:"){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(function(){});
  });
}

function standalone(){
  var mm = window.matchMedia && window.matchMedia("(display-mode: standalone)");
  return (mm && mm.matches) || navigator.standalone===true;
}
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}

window.addEventListener("beforeinstallprompt",function(e){
  e.preventDefault(); deferredPrompt=e; drawInstallBar(); if(!el("installGate").hidden) drawInstallGate();
});
window.addEventListener("appinstalled",function(){
  deferredPrompt=null; state.installDismissedAt=Date.now(); save(); drawInstallBar();
});

function askPersist(){
  if(navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(function(granted){
      state.persisted=!!granted; save(); storageStatus();
    }).catch(function(){});
  }
}

function storageStatus(){
  var p=el("storageStatus"); if(!p) return;
  if(!storage.canSave()){ p.textContent="Not saving at all in this window — see the warning at the top."; return; }
  var bits=[standalone() ? "Running as an installed app, which is the safest place for your log."
                         : "Running in the browser. Installing it to your home screen protects the log from being cleared."];
  if(state.persisted) bits.push("This browser has marked your data as protected from automatic clearing.");
  p.textContent=bits.join(" ");
}

function drawInstallBar(){
  var bar=el("installBar"); if(!bar) return;
  if(standalone()){ bar.hidden=true; return; }
  var msg, acts;
  if(deferredPrompt){
    msg="<b>Install Threshold for reliable timers and safer storage.</b> Your log exists only on this device.";
    acts='<button type="button" id="doInstall">Install</button>';
  } else if(isIOS()){
    msg="<b>Open Threshold from your Home Screen.</b> In Safari, tap Share → Add to Home Screen.";
    acts='<button type="button" id="showInstallHelp">Show me</button>';
  } else { bar.hidden=true; return; }
  bar.hidden=false; bar.innerHTML='<div>'+msg+'</div><div class="acts">'+acts+'</div>';
  if(el("doInstall")) el("doInstall").onclick=function(){ deferredPrompt.prompt(); deferredPrompt.userChoice.then(function(){deferredPrompt=null;drawInstallBar();}); };
  if(el("showInstallHelp")) el("showInstallHelp").onclick=function(){ drawInstallGate(); openModal("installGate"); };
}

function mobileBrowser(){ return isIOS() || /android|mobile/i.test(navigator.userAgent); }
function installInstructions(){
  if(isIOS()) return '<p><b>On iPhone or iPad:</b></p><ol class="installGateSteps"><li>Tap the Share button in Safari.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Open Threshold using the new Home Screen icon.</li></ol>';
  if(deferredPrompt) return '<p>Tap <b>Install Threshold</b> below, then open it from your Home Screen.</p>';
  return '<p><b>On Android:</b></p><ol class="installGateSteps"><li>Open the browser menu.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Open Threshold using the new icon.</li></ol>';
}
function drawInstallGate(){
  if(standalone()){ closeModal("installGate"); return false; }
  el("installGateInstructions").innerHTML=installInstructions();
  el("installGateDo").hidden=!deferredPrompt;
  return true;
}
function offerInstallGate(){
  if(standalone()||!mobileBrowser()) return false;
  var deferredFor=state.installGateContinuedAt&&Date.now()-state.installGateContinuedAt<7*86400000;
  if(deferredFor) return false;
  drawInstallGate(); openModal("installGate"); return true;
}
el("installGateDo").onclick=function(){
  if(!deferredPrompt){ drawInstallGate(); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(choice){
    if(choice&&choice.outcome==="accepted") el("installGateIntro").textContent="Installation started. Open Threshold from its Home Screen icon.";
    deferredPrompt=null; drawInstallGate(); drawInstallBar();
  });
};
el("installGateCheck").onclick=function(){
  if(standalone()){ closeModal("installGate"); continueStartup(); }
  else { drawInstallGate(); alert("Threshold is still running in the browser. After adding it, close this tab and open the new Home Screen icon."); }
};
el("installGateContinue").onclick=function(){
  state.installGateContinuedAt=Date.now(); save(); closeModal("installGate"); continueStartup();
};

function showSetup(force){
  if(!force&&state.setupDone) return;
  el("setupName").value=state.name||""; el("setupStart").value=scen().start||5; el("setupMode").value=mode(scen());
  el("setupCamera").checked=false; openModal("setupModal");
}
el("setupSave").onclick=function(){
  var v=intIn(el("setupStart").value,1,7200,0); if(!v){alert("Enter a valid starting duration.");return;}
  if(!el("setupCamera").checked&&!confirm("Continue without confirming that you will watch on a camera?"))return;
  state.name=el("setupName").value.trim().slice(0,40); state.scenarios.forEach(function(s){s.start=v;s.mode=el("setupMode").value==="door"?"door":"absence";});
  state.setupDone=true; closeModal("setupModal"); el("dogName").value=state.name;
  requestReturnNotificationPermission(); save(); render();
};
el("setupSkip").onclick=function(){
  state.setupDone=false;
  closeModal("setupModal");
  save();
  showToast("Setup skipped for now. You can reopen it from Settings.");
};
el("restartSetup").onclick=function(){showSetup(true);};

function offerRecovery(){
  var r=state.activeRun; if(!r)return false;
  var age=Math.max(0,Math.round((Date.now()-(Number(r.startedAt)||Number(r.savedAt)||Date.now()))/1000));
  var sc=state.scenarios.filter(function(s){return s.id===r.scenarioId;})[0];
  el("recoveryText").textContent="An unfinished "+(sc?sc.label.toLowerCase()+" ":"")+"session was saved "+fmt(age)+" ago. Resume from the recorded step, or discard it without adding a result.";
  openModal("recoveryModal"); return true;
}
el("recoveryResume").onclick=function(){
  var r=state.activeRun; closeModal("recoveryModal");
  if(!restoreRun(r)){state.activeRun=null;save();render();showToast("The unfinished session could not be recovered.");return;}
  restartRestoredRun(false);
};
el("recoveryDiscard").onclick=function(){
  closeModal("recoveryModal"); audioStop(); phase="idle"; state.activeRun=null; save(); render(); showToast("Unfinished session discarded.");
};

el("renameGo").onclick=function(){
  var v=el("renameTo").value.trim().slice(0,24);
  if(!v){ el("renameTo").focus(); return; }
  scen().label=v; save(); render(); showToast("Scenario name saved.");
};
el("renameTo").addEventListener("keydown",function(e){
  if(e.key==="Enter"){ e.preventDefault(); el("renameGo").click(); }
});
el("delScen").onclick=function(){
  if(state.scenarios.length<2){ alert("Keep at least one scenario. Rename this one instead."); return; }
  if(confirm("Delete "+scen().label+" and every session in it?")){
    state.scenarios=state.scenarios.filter(function(x){return x.id!==state.active;});
    state.active=state.scenarios[0].id; save(); render();
  }
};
el("copyData").onclick=function(){
  var t=el("data"), b=this; t.select();
  try{ navigator.clipboard.writeText(t.value); }catch(e){ try{ document.execCommand("copy"); }catch(e2){} }
  b.textContent="Copied"; setTimeout(function(){ b.textContent="Copy log"; },1500);
};
el("loadData").onclick=function(){ applyImport(el("data").value); };
el("wipe").onclick=function(){
  if(confirm("Delete every scenario and session, and start again?")){
    audioStop(); phase="idle"; state=freshState(); justEarned=[]; save(); render(); showSetup(true);
  }
};

el("dogName").value=state.name||"";
save();
render();
askPersist();
var startupContinued=false;
function continueStartup(){
  if(startupContinued) return; startupContinued=true;
  if(autoRestoreActiveRun()) return;
  if(!offerRecovery()) showSetup(false);
}
if(!offerInstallGate()) continueStartup();
