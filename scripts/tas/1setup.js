const t = (window.__tas = window.__tas || {});
t.scene = runtimeScene;

const killlist = /*__KILLNAMES__*/[];
const coinlist = /*__COINNAMES__*/[];
const greenlist = /*__GREENNAMES__*/[];
const physmap = /*__PHYSMAP__*/{};

/*////////////////////////////////////////////////////////////////////*/

if (t.installed !== runtimeScene.getGame()) {
  const game = runtimeScene.getGame();
  t.installed = game;
  t.game = game;

  t.step = 1000 / 60;
  t.mode = "idle";            // idle | record | play
  t.frozen = false; t.pace = 1;
  t.cheated = false;
  t.paces = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10];
  t.lastrate = 1; t.acc = 0; t.frame = 0;
  t.pendingsteps = 0; t.pendingrollback = 0; t.requestrestart = null;
  t.ring = []; t.ringsize = 600;
  t.macro = null;
  t.playable = null;
  t.playm = null;
  t.prevstop = Infinity;
  t.playpos = 0; t.playkeys = {};
  t.playmouse = false; t.playcursor = null;
  t.playend = null;
  t.fadein = null;
  t.countdown = null;
  t.physjump = {space: false, up: false, mouse: false};
  t.bufjump = {space: false, up: false, mouse: false};
  t.pendingsynth = null;
  t.requestpractice = null;
  t.requestpause = false;
  t.hadcp = false;
  t.cpinit = false; t.cp0 = [0, 0];
  t.prevkeys = {}; t.prevmouse = false; t.prevcursor = [0, 0];
  t.uivisible = true; t.hotkey = false;
  t.recording = false;
  t.frameadv = false; t.hitboxes = false; t.drewboxes = false;
  t.killset = {};
  for (const n of killlist) t.killset[n] = true;
  t.coinset = {};
  for (const n of coinlist) t.coinset[n] = true;
  t.greenset = {};
  for (const n of greenlist) t.greenset[n] = true;
  t.uipos = null;
  try {t.uipos = JSON.parse(window.localStorage.getItem("__tas_uipos")) || null} catch (e) {}
  t.uiorigin = [290, 4];
  t.dragcand = null;
  t.practy = 300;
  t.practtween = null;
  t.skipvars = null;
  t.hold = null;
  t.practice = false;
  t.practstack = [];
  t.practbase = null;
  t.prevz = false; t.prevx = false; t.prevr = false;
  t.prevdeaths = 0; t.awaitrespawn = false; t.armage = 0;

  // gameplay input whitelist z/x included
  // so practice checkpoints replay correctly inside macros
  t.watch = {Space: 32, Up: 38, Down: 40, Left: 37, Right: 39, Escape: 27,
    a: 65, b: 66, c: 67, d: 68, h: 72, k: 75, r: 82, s: 83, t: 84, u: 85,
    w: 87, x: 88, z: 90};

  /*////////////////////////////////////////////////////////////////////*/

  const input = game.getInputManager();
  const stack = game.getSceneStack ? game.getSceneStack() : game._sceneStack;
  t.stack = stack;
  t.origstep = stack.step.bind(stack);

  const origframeend = input.onFrameEnded.bind(input);
  t.allowframeend = true;
  input.onFrameEnded = function() {if (t.allowframeend) origframeend()};

  const note = msg => {try {console.log("[tas] " + msg)} catch (e) {}};
  t.note = note;

  // fixed 60hz timestep only while recording, playing, frozen or speed changed
  const engaged = () => t.recording || t.frozen || t.mode !== "idle" || t.pace !== 1 ||
    t.pendingsteps > 0 || t.pendingrollback > 0 || t.requestrestart || t.requestpractice;

  const inlevel = () => {
    const sc = stack.getCurrentScene();
    return sc && sc.getName() === "level" ? sc : null;
  };

  const svar = (scene, name) => scene.getVariables().get(name);
  const winshown = scene => {try {return svar(scene, "win").getAsBoolean()} catch (e) {return false}};
  const ispaused = scene => {try {return svar(scene, "paused").getAsBoolean()} catch (e) {return false}};

  t.readsetting = function(scene, id) {
    const truthy = v => v === true || v === "true" || v === 1;
    try {
      const s = scene.getVariables();
      if (s.has("settings") && s.get("settings").hasChild(id)) {
        return s.get("settings").getChild(id).getAsBoolean();
      }
    } catch (e) {}
    try {
      const file = JSON.parse(window.localStorage.getItem("GDJS_trigonometrydash") || "{}");
      if (file.settings && typeof file.settings.str === "string") {
        return truthy(JSON.parse(file.settings.str)[id]);
      }
    } catch (e) {}
    return false;
  };

  /*////////////////////////////////////////////////////////////////////*/

  // sound/music rate follows game speed, kinda
  function applyrates() {
    if (t.pace === t.lastrate && t.pace === 1) return;
    try {
      const sm = game.getSoundManager();
      const pools = [];
      for (const field of ["_sounds", "_musics"]) {
        const table = sm[field];
        if (table && table.items) for (const k in table.items) pools.push(table.items[k]);
        else if (table) for (const k in table) pools.push(table[k]);
      }
      for (const field of ["_freeSounds", "_freeMusics"]) {
        if (Array.isArray(sm[field])) pools.push(...sm[field]);
      }
      for (const snd of pools) {
        if (!snd) continue;
        try {
          if (snd._howl && snd._id !== null && (!snd.isActualId || snd.isActualId()) && typeof snd._howl.rate === "function") {snd._howl.rate(t.pace, snd._id); snd._rate = t.pace}
          else if (typeof snd.setRate === "function" && snd.getRate() !== t.pace) snd.setRate(t.pace);
        } catch (e) {}
      }
      t.lastrate = t.pace;
    } catch (e) {}
  }
  t.applyrates = applyrates;

  function soundpool(fields) {
    const out = [];
    try {
      const sm = game.getSoundManager();
      for (const f of fields) {
        const tbl = sm[f];
        if (Array.isArray(tbl)) out.push(...tbl);
        else if (tbl && tbl.items) {for (const k in tbl.items) out.push(tbl.items[k])}
        else if (tbl) {for (const k in tbl) out.push(tbl[k])}
      }
    } catch (e) {}
    return out;
  }

  function resetaudio() {
    for (const s of soundpool(["_sounds", "_freeSounds"])) {
      try {if (s && s.stop) s.stop()} catch (e) {}
    }
    for (const m of soundpool(["_musics", "_freeMusics"])) {
      try {if (m && m.setSeek) m.setSeek(0)} catch (e) {}
    }
    try {if (window.Howler && t.savedvol != null) window.Howler.volume(t.savedvol)} catch (e) {}
  }

  /*////////////////////////////////////////////////////////////////////*/

  // sloppy snapshots for frame unadvance
  const playernames = ["cube", "ship", "ball", "ufo", "wave", "oldufo"];

  function skiplist(scene) {
    if (t.skipvars && t.skipvars.scene === scene) return t.skipvars.names;
    const names = {};
    const items = scene.getVariables()._variables.items;
    for (const name in items) {
      try {
        if (JSON.stringify(items[name].toJSObject()).length > 4096) names[name] = true;
      } catch (e) {names[name] = true}
    }
    t.skipvars = {scene: scene, names: names};
    return names;
  }

  const orbnames = ["yelloworb", "blueorb", "greenorb", "pinkorb", "redorb", "arroworb", "blackorb"];
  const spinnames = ["saw", "bigsaw", "smallsaw", "spearsaw", "bigspearsaw", "smallspearsaw", "ghostsaw", "ghostbigsaw", "ghostsmallsaw", "gear", "biggear", "smallgear", "cogspinner", "smallcogspinner", "bigcogspinner", "fanspinner", "bigfanspinner", "burstspinner", "bigburstspinner", "smallburstspinner", "octospinner", "bigoctospinner", "smalloctospinner", "starspinner", "bigstarspinner", "smallstarspinner", "crossspinner", "bigcrossspinner", "smallcrossspinner", "flowerspinner", "bigflowerspinner", "smallflowerspinner", "boulder", "smallboulder", "spikeboulder", "smallspikeboulder", "crusher"];
  const playertypes = {cube: 1, ship: 1, ball: 1, ufo: 1, wave: 1, oldufo: 1};
  function capturedyn(scene) {
    const out = [];
    let all; try {all = scene.getAdhocListOfAllInstances()} catch (e) {return out}
    for (const o of all) {
      if (playertypes[o.getName()]) continue;
      let b; try {b = o.getBehavior("Physics2")} catch (e) {continue}
      if (!b || typeof b.isDynamic !== "function") continue;
      let dyn = false; try {dyn = b.isDynamic()} catch (e) {}
      if (!dyn) continue;
      out.push({id: o.id, x: o.getX(), y: o.getY(), a: o.getAngle()});
    }
    return out;
  }
  function restoredyn(scene, dyn) {
    if (!dyn || !dyn.length) return;
    const map = {}; for (const d of dyn) map[d.id] = d;
    let all; try {all = scene.getAdhocListOfAllInstances()} catch (e) {return}
    for (const o of all) {
      const d = map[o.id]; if (!d) continue;
      o.setPosition(d.x, d.y); try {o.setAngle(d.a)} catch (e) {}
      try {const b = o.getBehavior("Physics2"); b.updateBodyFromObject(); b.setLinearVelocityX(0); b.setLinearVelocityY(0); b.setAngularVelocity(0)} catch (e) {}
    }
  }
  function getanim(o) {try {return o.getBehavior("Animation").getAnimationIndex()} catch (e) {} try {return o.getAnimationIndex()} catch (e) {return 0}}
  function setanim(o, a) {try {o.getBehavior("Animation").setAnimationIndex(a); return} catch (e) {} try {o.setAnimationIndex(a)} catch (e) {}}
  function captureobjs(scene) {
    const out = {};
    const bb = scene.getObjects("breakblock") || [];
    if (bb.length) out.breakblock = bb.map(o => o.isHidden() ? 1 : 0);
    const cn = scene.getObjects("coin") || [];
    if (cn.length) out.coin = cn.map(o => {
      let d = 0, op = 255;
      try {d = o.getVariables().get("disabled").getAsBoolean() ? 1 : 0} catch (e) {}
      try {op = o.getOpacity()} catch (e) {}
      return {d: d, a: getanim(o), x: o.getX(), y: o.getY(), op: op};
    });
    for (const n of orbnames) {const list = scene.getObjects(n) || []; if (list.length) out[n] = list.map(o => {let l = 0; try {l = o.getVariables().get("locked").getAsBoolean() ? 1 : 0} catch (e) {} return {l: l, a: o.getAngle()}})}
    for (const n of spinnames) {const list = scene.getObjects(n) || []; if (list.length) out["@" + n] = list.map(o => o.getAngle())}
    out.dyn = capturedyn(scene);
    return out;
  }
  function restoreobjs(scene, objs) {
    if (!objs) return;
    if (objs.breakblock) {
      const list = scene.getObjects("breakblock") || [];
      objs.breakblock.forEach((s, i) => {
        const o = list[i];
        if (!o) return;
        const broke = !!s;
        o.hide(broke);
        try {const b = o.getBehavior("Physics2"); b.enableLayer(1, !broke); b.enableMask(1, !broke)} catch (e) {}
      });
    }
    if (objs.coin) {
      const list = scene.getObjects("coin") || [];
      objs.coin.forEach((s, i) => {
        const o = list[i];
        if (!o) return;
        try {o.getVariables().get("disabled").setBoolean(!!s.d)} catch (e) {}
        setanim(o, s.a);
        o.setPosition(s.x, s.y);
        try {o.setOpacity(s.op)} catch (e) {}
      });
    }
    for (const n of orbnames) {
      if (!objs[n]) continue;
      const list = scene.getObjects(n) || [];
      objs[n].forEach((s, i) => {const o = list[i]; if (!o) return; try {o.getVariables().get("locked").setBoolean(!!s.l)} catch (e) {} try {o.setAngle(s.a)} catch (e) {}});
    }
    for (const n of spinnames) {
      const key = "@" + n; if (!objs[key]) continue;
      const list = scene.getObjects(n) || [];
      objs[key].forEach((a, i) => {const o = list[i]; if (!o) return; o.setAngle(a); try {o.getBehavior("Physics2").updateBodyFromObject()} catch (e) {}});
    }
    restoredyn(scene, objs.dyn);
  }

  function capture(scene) {
    const snap = {frame: t.frame, vars: {}, players: {}, timers: {}, cams: {}};
    const skip = skiplist(scene);
    const items = scene.getVariables()._variables.items;
    for (const name in items) {
      if (skip[name]) continue;
      try {snap.vars[name] = items[name].toJSObject()} catch (e) {}
    }
    for (const pname of playernames) {
      const list = scene.getObjects(pname) || [];
      snap.players[pname] = list.map(o => {
        const p = {x: o.getX(), y: o.getY(), angle: o.getAngle(), hidden: o.isHidden(), timers: {}};
        if (o.hasBehavior && o.hasBehavior("Physics2")) {
          const b = o.getBehavior("Physics2");
          try {p.vx = b.getLinearVelocityX(); p.vy = b.getLinearVelocityY(); p.va = b.getAngularVelocity()} catch (e) {}
        }
        const ts = o._timers && o._timers.items;
        for (const tn in ts || {}) p.timers[tn] = ts[tn].getTime();
        return p;
      });
    }
    const tm = scene.getTimeManager();
    snap.timescale = tm.getTimeScale();
    snap.timefromstart = tm.getTimeFromStart();
    const sts = tm._timers && tm._timers.items;
    for (const tn in sts || {}) snap.timers[tn] = sts[tn].getTime();
    for (const lname of ["bg", "", "mastermodevignette", "light", "lightning", "ui", "transition"]) {
      try {
        const lay = scene.getLayer(lname);
        snap.cams[lname] = [lay.getCameraX(), lay.getCameraY(), lay.getCameraZoom()];
      } catch (e) {}
    }
    if (t.mode === "record") {snap.reckeys = Object.assign({}, t.prevkeys); snap.recmouse = t.prevmouse}
    snap.objs = captureobjs(scene);
    return snap;
  }

  function restore(scene, snap, kind) {
    const practice = kind === "practice";
    const container = scene.getVariables();
    for (const name in snap.vars) {
      if (practice && name === "deaths") continue;
      try {container.get(name).fromJSObject(snap.vars[name])} catch (e) {}
    }
    for (const pname in snap.players) {
      const list = scene.getObjects(pname) || [];
      snap.players[pname].forEach((p, i) => {
        const o = list[i];
        if (!o) return;
        o.setX(p.x); o.setY(p.y); o.setAngle(p.angle); o.hide(p.hidden);
        o.clearForces();
        if (o.hasBehavior && o.hasBehavior("Physics2")) {
          const b = o.getBehavior("Physics2");
          try {
            b.updateBodyFromObject();
            if (p.vx !== undefined) {b.setLinearVelocityX(p.vx); b.setLinearVelocityY(p.vy); b.setAngularVelocity(p.va)}
          } catch (e) {}
        }
        for (const tn in p.timers) {try {o._timers.get(tn).setTime(p.timers[tn])} catch (e) {}}
      });
    }
    const tm = scene.getTimeManager();
    tm.setTimeScale(snap.timescale);
    tm._timeFromStart = snap.timefromstart;
    for (const tn in snap.timers) {try {tm._timers.get(tn).setTime(snap.timers[tn])} catch (e) {}}
    for (const lname in snap.cams) {
      try {
        const lay = scene.getLayer(lname);
        const c = snap.cams[lname];
        lay.setCameraX(c[0]); lay.setCameraY(c[1]); lay.setCameraZoom(c[2]);
      } catch (e) {}
    }
    restoreobjs(scene, snap.objs);
    try {
      const timer = scene.getTimeManager()._timers.get("stopwatch");
      if (timer) t.prevstop = timer.getTime();
    } catch (e) {}
    if (practice) return;
    t.frame = snap.frame;
    if (t.mode === "record") {
      t.macro.events = t.macro.events.filter(ev => ev[0] < snap.frame);
      t.macro.icon.length = Math.min(t.macro.icon.length, snap.frame);
      t.prevkeys = Object.assign({}, snap.reckeys || {});
      t.prevmouse = !!snap.recmouse;
      applykeystate({}, false);
    }
    if (t.mode === "play") rebuildplaystate(snap.frame);
  }

  t.earlyrespawn = function (scene) {
    if (!t.earlysnap || t.earlyframes <= 0) return;

    const snap = t.earlysnap;
    let cpx = 0, cpy = 0;
    try {cpx = svar(scene, "checkpointX").getAsNumber(); cpy = svar(scene, "checkpointY").getAsNumber()} catch (e) {}
    let acted = false;
    for (const pname in snap.players) {
      const list = scene.getObjects(pname) || [];
      snap.players[pname].forEach((pp, i) => {
        const o = list[i];
        if (!o) return;
        if (!t.earlyplaced && (Math.abs(o.getX() - cpx) > 12 || Math.abs(o.getY() - cpy) > 12)) return;
        acted = true;
        if (!t.earlyplaced) {o.setX(pp.x); o.setY(pp.y)}
        o.setAngle(pp.angle); o.hide(pp.hidden);
        if (o.hasBehavior && o.hasBehavior("Physics2")) {
          const b = o.getBehavior("Physics2");
          try {
            b.updateBodyFromObject();
            if (pp.vx !== undefined) {b.setLinearVelocityX(pp.vx); b.setLinearVelocityY(pp.vy); b.setAngularVelocity(pp.va)}
          } catch (e) {}
        }
      });
    }
    if (acted) {t.earlyplaced = true; t.earlyframes = 0}
  };

