  /*////////////////////////////////////////////////////////////////////*/

  function recordframe() {
    if (t.macro.inputonly) recordinputs();
    else recordlegacyframe();
  }

  function samplekeys() {
    const cur = {};
    for (const name in t.watch) {
      if (input.isKeyPressed(t.watch[name])) cur[name] = true;
    }
    return cur;
  }

  function recordlegacyframe() {
    if (!t.macro) return;
    const cur = samplekeys();
    for (const name in t.watch) {
      if (!!cur[name] !== !!t.prevkeys[name]) t.macro.events.push([t.frame, cur[name] ? "kd" : "ku", name]);
    }
    const mouse = input.isMouseButtonPressed(0);
    if (mouse !== t.prevmouse) t.macro.events.push([t.frame, mouse ? "md" : "mu"]);
    const cx = Math.round(input.getCursorX()), cy = Math.round(input.getCursorY());
    if (cx !== t.prevcursor[0] || cy !== t.prevcursor[1]) {
      t.macro.events.push([t.frame, "mm", cx, cy]);
      t.prevcursor = [cx, cy];
    }
    t.prevkeys = cur; t.prevmouse = mouse;
    t.macro.length = t.frame + 1;
  }

  const r3 = v => Math.round(v * 1000) / 1000;

  function recordicon(scene, frame) {
    if (!t.macro) return;
    const p = aliveplayer(scene);
    if (!p || p.isHidden()) {t.macro.icon[frame] = 0; return}
    let vx = 0, vy = 0, va = 0;
    if (p.hasBehavior && p.hasBehavior("Physics2")) {
      const b = p.getBehavior("Physics2");
      try {vx = b.getLinearVelocityX(); vy = b.getLinearVelocityY(); va = b.getAngularVelocity()} catch (e) {}
    }
    t.macro.icon[frame] = [playernames.indexOf(p.getName()), r3(p.getX()), r3(p.getY()),
      r3(p.getAngle()), r3(vx), r3(vy), r3(va)];
  }

  function applyicon(scene, frame) {
    const entry = t.playm && !t.playm.inputonly && t.playm.icon && t.playm.icon[frame];
    if (!Array.isArray(entry)) return;
    const list = scene.getObjects(playernames[entry[0]]) || [];
    const p = list.find(o => !o.isHidden()) || list[0];
    if (!p) return;
    p.setX(entry[1]); p.setY(entry[2]); p.setAngle(entry[3]);
    if (p.hasBehavior && p.hasBehavior("Physics2")) {
      const b = p.getBehavior("Physics2");
      try {
        b.updateBodyFromObject();
        b.setLinearVelocityX(entry[4]); b.setLinearVelocityY(entry[5]); b.setAngularVelocity(entry[6]);
      } catch (e) {}
    }
  }

  function applykeystate(keys, mouse) {
    for (const name in t.watch) {
      const code = t.watch[name];
      if (code === 27 || code === 82 || code === 84 || code === 85) continue;
      const want = !!keys[name] || (code === 32 && mouse);
      if (want && !input.isKeyPressed(code)) input.onKeyPressed(code, 0);
      if (!want && input.isKeyPressed(code)) input.onKeyReleased(code, 0);
    }
    if (mouse && !input.isMouseButtonPressed(0)) input.onMouseButtonPressed(0);
    if (!mouse && input.isMouseButtonPressed(0)) input.onMouseButtonReleased(0);
  }

  function playframe() {
    if (t.playm.inputonly) {
      playinputframe();
      return;
    }
    while (t.playpos < t.playm.events.length && t.playm.events[t.playpos][0] === t.frame) {
      const ev = t.playm.events[t.playpos++];
      if (ev[1] === "kd") t.playkeys[ev[2]] = true;
      if (ev[1] === "ku") delete t.playkeys[ev[2]];
      if (ev[1] === "md") t.playmouse = true;
      if (ev[1] === "mu") t.playmouse = false;
      if (ev[1] === "mm") t.playcursor = [ev[2], ev[3]];
      if (ev[1] === "back") t.requestbacktrack = ev[2] || true;
    }
    if (t.playcursor) input.onMouseMove(t.playcursor[0], t.playcursor[1]);
    applykeystate(t.playkeys, t.playmouse);
  }

  function rebuildplaystate(frame) {
    if (t.playm.inputonly) {
      seekinput(frame);
      return;
    }
    t.playkeys = {}; t.playmouse = false; t.playcursor = null; t.playpos = 0;
    while (t.playpos < t.playm.events.length && t.playm.events[t.playpos][0] < frame) {
      const ev = t.playm.events[t.playpos++];
      if (ev[1] === "kd") t.playkeys[ev[2]] = true;
      if (ev[1] === "ku") delete t.playkeys[ev[2]];
      if (ev[1] === "md") t.playmouse = true;
      if (ev[1] === "mu") t.playmouse = false;
      if (ev[1] === "mm") t.playcursor = [ev[2], ev[3]];
    }
  }

  function releaseall() {
    applykeystate({}, false);
    if (t.playm && t.playm.inputonly) {
      if (input.isKeyPressed(t.watch.Escape)) input.onKeyReleased(t.watch.Escape, 0);
      if (input.isKeyPressed(t.watch.r)) input.onKeyReleased(t.watch.r, 0);
      if (input.isKeyPressed(t.watch.t)) input.onKeyReleased(t.watch.t, 0);
      for (const id of t.playtouches.keys()) input.onTouchEnd(id);
      t.playtouches.clear();
      t.clickspace = false;
      t.inputseek = false;
    }
  }

  function resyncheld() {
    if (t.mode === "play") return;
    bridgeclick(t.jumpclick);
  }

  function bridgeclick(held) {
    if (held && !input.isKeyPressed(32)) {
      input.onKeyPressed(32, 0);
      t.clickspace = true;
    } else if (!held && t.clickspace) {
      if (!(t.mode === "play" ? t.playkeys.Space : t.realkeys.Space)) input.onKeyReleased(32, 0);
      t.clickspace = false;
    }
  }

  t.legacyphysics = function(scene) {
    const legacy = t.priminglegacy ||
      (t.mode === "play" && t.playm && !t.playm.inputonly) ||
      (t.mode === "record" && t.macro && !t.macro.inputonly);
    svar(scene, "macrolegacyphysics").setNumber(legacy ? 1 : 0);
  };

  function dotreset(scene) {
    let qrvar = null, qrold = null;
    try {
      const sv = svar(scene, "settings");
      if (sv.hasChild("quickrestart")) {
        qrvar = sv.getChild("quickrestart");
        qrold = qrvar.getAsBoolean();
        qrvar.setBoolean(true);
      }
    } catch (e) {}
    input.onKeyPressed(84, 0);
    origframeend();
    t.origstep(t.step);
    input.onKeyReleased(84, 0);
    const ok = t.origstep(t.step);
    origframeend();
    try {if (qrvar && qrold !== null) qrvar.setBoolean(qrold)} catch (e) {}
    t.hadcp = false; t.cpinit = false;
    return ok;
  }

  function resetstopwatch(scene) {
    try {
      const timer = scene.getTimeManager()._timers.get("stopwatch");
      if (timer) timer.setTime(0);
    } catch (e) {}
    try {svar(scene, "stopwatchTime").setNumber(0)} catch (e) {}
  }

  /*//// trim start ////*/
  function trimmacro(m) {
    if (m.inputonly || !m.icon || !m.icon.length) return;
    const icon = m.icon;
    const alive = f => Array.isArray(icon[f]);
    const keep = new Array(m.length).fill(true);
    let any = false;

    const backframes = new Set();
    for (const ev of m.events) {if (ev[1] === "back") {backframes.add(ev[0]); backframes.add(ev[0] + 1); backframes.add(ev[0] + 2)}}
    const respawns = [];
    for (let f = 0; f < m.length; f++) {
      if (alive(f)) continue;
      const start = f;
      const isback = backframes.has(start) || backframes.has(start - 1) || backframes.has(start - 2);
      while (f < m.length && !alive(f)) {if (!isback) keep[f] = false; f++}
      if (isback) continue;
      any = true;
      if (f < m.length) respawns.push({start: start, t: f, x: icon[f][1], y: icon[f][2]});
    }
    if (!any) return;

    const clusters = [];
    for (const r of respawns) {
      let c = clusters.find(c => Math.hypot(c.x - r.x, c.y - r.y) <= 6);
      if (!c) {c = {x: r.x, y: r.y, firstdeath: r.start, tlast: r.t}; clusters.push(c)}
      else {
        c.firstdeath = Math.min(c.firstdeath, r.start);
        c.tlast = Math.max(c.tlast, r.t);
      }
    }

    for (const c of clusters) {
      let afirst = -1;
      for (let f = 0; f < c.firstdeath; f++) {
        if (alive(f) && Math.hypot(icon[f][1] - c.x, icon[f][2] - c.y) <= 6) {afirst = f; break}
      }
      if (afirst === -1) {
        for (let f = 0; f < c.firstdeath; f++) {
          if (alive(f) && Math.hypot(icon[f][1] - c.x, icon[f][2] - c.y) <= 16) {afirst = f; break}
        }
      }
      const from = afirst === -1 ? c.firstdeath : afirst + 1;
      for (let f = from; f < c.tlast; f++) keep[f] = false;
    }

    const events = m.events;
    const newevents = [];
    const newicon = [];
    let pos = 0, nf = 0;
    const desired = {keys: {}, mouse: false, cursor: null};
    const emitted = {keys: {}, mouse: false, cursor: null};
    const ws = m.worldsnaps || {}, newworldsnaps = {};
    for (let f = 0; f < m.length; f++) {
      const actions = [];
      while (pos < events.length && events[pos][0] === f) {
        const ev = events[pos++];
        if (ev[1] === "kd") desired.keys[ev[2]] = true;
        if (ev[1] === "ku") delete desired.keys[ev[2]];
        if (ev[1] === "md") desired.mouse = true;
        if (ev[1] === "mu") desired.mouse = false;
        if (ev[1] === "mm") desired.cursor = [ev[2], ev[3]];
        if (ev[1] === "back") actions.push(ev);
      }
      if (!keep[f]) continue;
      for (const name in Object.assign({}, emitted.keys, desired.keys)) {
        if (!!desired.keys[name] !== !!emitted.keys[name]) {
          newevents.push([nf, desired.keys[name] ? "kd" : "ku", name]);
          if (desired.keys[name]) emitted.keys[name] = true; else delete emitted.keys[name];
        }
      }
      if (desired.mouse !== emitted.mouse) {
        newevents.push([nf, desired.mouse ? "md" : "mu"]);
        emitted.mouse = desired.mouse;
      }
      if (desired.cursor && (!emitted.cursor || desired.cursor[0] !== emitted.cursor[0] || desired.cursor[1] !== emitted.cursor[1])) {
        newevents.push([nf, "mm", desired.cursor[0], desired.cursor[1]]);
        emitted.cursor = desired.cursor;
      }
      for (const action of actions) newevents.push([nf, ...action.slice(1)]);
      newicon[nf] = icon[f];
      if (ws[f]) newworldsnaps[nf] = ws[f];
      nf++;
    }
    note("trimmed macro: " + m.length + " -> " + nf + " frames (" + clusters.length + " segment(s) merged)");
    m.events = newevents;
    m.icon = newicon;
    m.worldsnaps = newworldsnaps;
    m.length = nf;
  }
  /*//// trim end ////*/

  function endplayback(msg) {
    t.mode = "idle"; t.playend = null;
    t.requestbacktrack = false;
    t.manualpause = false;
    releaseall();
    t.fadein = performance.now();
    if (t.vidphase === "render" || t.ffhandle != null) abortoffline();
    note(msg);
  }

  /*////////////////////////////////////////////////////////////////////*/

  stack.step = function(elapsed) {
    t.allowframeend = true;
    const scene = inlevel();
    if (!scene) {
      if (t.mode !== "idle" || t.frozen || t.pace !== 1 || t.countdown || t.requestpractice) {
        t.mode = "idle"; t.frozen = false; t.pace = 1; t.requestrestart = null;
        t.playend = null; t.countdown = null; t.requestpractice = null;
        t.macro = null; t.prevstop = Infinity;
        t.videopending = false;
        if (t.vidphase === "render" || t.ffhandle != null) abortoffline();
        t.vidphase = null; t.vidblock = false; t.vidstep = "";
        try {if (window.Howler && t.savedvol != null) window.Howler.volume(t.savedvol)} catch (e) {}
        t.savedvol = null;
        releaseall(); applyrates();
      }
      t.acc = 0;
      return t.origstep(elapsed);
    }

    if (!t.frameadv && t.frozen) {t.frozen = false; t.pendingsteps = 0; t.pendingrollback = 0}

    // background session recording
    let stopnow = t.prevstop;
    try {
      const timer = scene.getTimeManager()._timers.get("stopwatch");
      if (timer) stopnow = timer.getTime();
    } catch (e) {}
    if (t.mode === "play" && !t.playm.inputonly && t.prevstop !== Infinity && stopnow < t.prevstop - 1) {
      endplayback("level restarted");
      t.prevstop = stopnow;
      refreshhud();
      return t.origstep(elapsed);
    }
    if (t.recording && !t.countdown && !t.requestrestart && !t.requestpractice && !t.ubacktrack) {
      const fresh = stopnow < t.prevstop - 1;
      if (t.mode === "record" && fresh && !t.macro.inputonly) startsession(scene);
      else if (t.mode === "idle" && !t.playend && !winshown(scene) && (t.macro === null || fresh)) startsession(scene);
    }
    t.prevstop = stopnow;
    if (t.mode === "record" && winshown(scene)) {
      t.mode = "idle";
      t.playable = {macro: t.macro, src: "session"};
    }
    applyrates();

    if (t.clearscreens) {
      t.clearscreens = false;
      const wasdone = winshown(scene), waspaused = ispaused(scene);
      try {svar(scene, "win").setBoolean(false)} catch (e) {}
      try {svar(scene, "challengeFailed").setBoolean(false)} catch (e) {}
      try {svar(scene, "winAnimationPhase").setNumber(0)} catch (e) {}
      try {svar(scene, "paused").setBoolean(false)} catch (e) {}
      if (wasdone) {
        for (const nm of completeobjs) for (const o of (scene.getObjects(nm) || [])) {try {o.setY(o.getY() - 600)} catch (e) {}}
      }
      if (wasdone || waspaused) {
        const ok = dotreset(scene);
        return ok;
      }
    }

    if (t.hold && performance.now() >= t.hold.next) {
      t.hold.action();
      t.hold.next = performance.now() + 66;
    }

    if (t.mode === "play" && t.playend && performance.now() >= t.playend) {
      endplayback("playback finished");
    }
    if (t.mode === "play" && !t.playend && winshown(scene)) {
      t.playend = performance.now() + 4000;
    }

    if (t.countdown) {
      const hudok = t.counttext && t.hudowner === scene;
      const left = t.countdown - performance.now();
      try {
        if (window.Howler && t.savedvol != null) {
          window.Howler.volume(t.savedvol * Math.max(0, Math.min(1, left / 1000)));
        }
      } catch (e) {}
      if (left <= 0) {
        t.countdown = null;
        if (hudok) t.counttext.hide();
        if (t.warntext) t.warntext.hide(true);
        t.requestrestart = "play";
      } else if (hudok) {
        t.counttext.hide(false);
        t.counttext.setText("" + Math.ceil(left / 1000));
        t.counttext.setPosition(216 - t.counttext.getWidth() / 2, 104);
        // video countdown warning
        if (t.videopending && t.warntext) {
          const fade = Math.max(0, Math.min(1, (3000 - left) / 500));
          let gw = 432, gh = 224;
          try {gw = game.getGameResolutionWidth(); gh = game.getGameResolutionHeight()} catch (e) {}
          t.warntext.hide(false);
          t.warntext.setText("audio will be muxed at the end!\npress esc during recording to abort.");
          t.warntext.setPosition(gw / 2 - t.warntext.getWidth() / 2, gh - 6 - t.warntext.getHeight());
          try {t.warntext.setOpacity(Math.round(fade * 255))} catch (e) {}
        }
      }
    }

    if (t.requestpractice) {
      const want = t.requestpractice === "on";
      t.requestpractice = null;
      if (t.mode === "play" && want) {
        t.editmode = true;
        t.macro = JSON.parse(JSON.stringify(t.playm));
        t.macro.events = (t.macro.events || []).filter(ev => ev[0] < t.frame);
        if (Array.isArray(t.macro.icon)) t.macro.icon.length = Math.min(t.macro.icon.length, t.frame);
        if (t.macro.inputonly) {
          rewindrecord(t.frame);
          t.inputqueue.length = 0;
        }
        t.macro.length = t.frame;
        t.prevkeys = Object.assign({}, t.playkeys);
        t.prevmouse = !!t.playmouse;
        t.prevcursor = t.playcursor ? [t.playcursor[0], t.playcursor[1]] : [0, 0];
        t.mode = "record";
        t.practice = true;
        clearpractice(scene, true);
        try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
        try {input.onKeyPressed(27, 0)} catch (e) {}
        const editok = t.origstep(elapsed);
        try {input.onKeyReleased(27, 0)} catch (e) {}
        refreshhud();
        return editok;
      }

      if (t.editmode && t.mode === "record") {
        t.practice = want;
        clearpractice(scene, true);
        try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
        let wasp = false;
        try {wasp = svar(scene, "paused").getAsBoolean()} catch (e) {}
        if (wasp) try {input.onKeyPressed(27, 0)} catch (e) {}
        const tok = t.origstep(elapsed);
        if (wasp) try {input.onKeyReleased(27, 0)} catch (e) {}
        refreshhud();
        return tok;
      }
      if (t.mode === "record") {t.mode = "idle"; releaseall()}
      try {svar(scene, "paused").setBoolean(false)} catch (e) {}
      const ok = dotreset(scene);
      t.practice = want;
      clearpractice(scene, true);
      if (t.recording) startsession(scene);
      try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
      refreshhud();
      return ok;
    }

    if (t.requestrestart) {
      const restart = t.requestrestart;
      t.requestrestart = null;
      t.editmode = false;
      t.mode = "idle";
      if (restart === "play") {
        releaseall();
        t.realkeys = {};
        t.realmouse = false;
        t.jumpclick = false;
        for (const id of t.realtouches.keys()) input.onTouchEnd(id);
        t.realtouches.clear();
      }
      t.manualpause = false;
      svar(scene, "paused").setBoolean(false);
      t.priminglegacy = restart === "play" && t.playable && !t.playable.macro.inputonly;
      let ok;
      try {ok = dotreset(scene)}
      finally {t.priminglegacy = false}

      try {svar(scene, "paused").setBoolean(false)} catch (e) {}
      clearpractice(scene, true);
      t.frame = 0; t.acc = 0; t.ring = [];
      t.prevkeys = {}; t.prevmouse = false; t.prevcursor = [0, 0];
      try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
      t.prevstop = 0;
      t.timerstarted = false; t.timerstartframe = 0; t.tprevx = undefined;
      t.practice = false;

      if (restart === "record") {
        startsession(scene);
      } else if (t.playable) {
        t.playm = JSON.parse(JSON.stringify(t.playable.macro));
        trimmacro(t.playm);
        let offok = false;
        if (t.videopending) {t.videopending = false; offok = startoffline(scene)}
        if (!offok) {
          t.mode = "play";
          t.vidphase = null;
          rebuildplaystate(0);
          setblackalpha(0);
        }
      }
      refreshhud();
      return ok;
    }
    if (t.vidphase === "render") return offlinetick(scene);
    if (t.mode !== "record") t.inputqueue.length = 0;

    if (!engaged()) {
      t.acc = 0;
      resyncheld();
      refreshhud();
      return t.origstep(elapsed);
    }

    while (t.pendingrollback > 0) {
      t.pendingrollback--;
      const snap = t.ring.pop();
      if (!snap) break;
      restore(scene, snap, "rollback");
    }

    let n = 0;
    if (t.manualpause && !ispaused(scene)) t.manualpause = false;
    const replaypaused = t.mode === "play" && (t.playm.inputonly ? t.manualpause : ispaused(scene));
    if (replaypaused) {
      n = 1;
    } else if (t.frozen) {
      n = Math.min(t.pendingsteps, 4);
      t.pendingsteps -= n;
    } else {
      t.acc += Math.min(elapsed, t.step * 2) * t.pace;
      n = Math.floor(t.acc / t.step);
      if (n > 4) {n = 4; t.acc = 0} else t.acc -= n * t.step;
    }

    let alive = true;
    const realRender = scene.render;
    const noRender = function () {};
    for (let i = 0; i < n && alive; i++) {
      if (t.frameadv) {
        t.ring.push(capture(scene));
        if (t.ring.length > t.ringsize) t.ring.shift();
      }
      if (i > 0) origframeend();
      resyncheld();
      if (t.mode === "play") {
        if (replaypaused) {
          if (t.playm.inputonly) {if (!t.inputseek) seekinput(t.frame)}
          else releaseall();
        } else if (t.frame >= t.playm.length) {
          if (winshown(scene)) {
            if (!t.playend) t.playend = performance.now() + 4000;
            releaseall();
          } else {
            endplayback("playback finished");
          }
        } else playframe();
      }
      const recording = t.mode === "record" && t.macro;
      if (recording) recordframe();
      let pauseinject = false;
      if (t.requestpause && t.mode === "play") {t.requestpause = false; pauseinject = true; try {input.onKeyPressed(27, 0)} catch (e) {}}

      let backinject = false;
      if (t.requestbacktrack && inlevel()) {
        const target = t.requestbacktrack === true ? backtarget() : t.requestbacktrack;
        t.requestbacktrack = false;
        if (target) {
          if (recording && t.macro.inputonly) t.macro.events.push([t.frame, "back", target]);
          applynormalcp(scene, target);
          t.ubacktrack = 8;
          backinject = true;
          input.onKeyPressed(82, 0);
        }
      }
      if (t.mode === "play" && !replaypaused && t.playm.worldsnaps && t.playm.worldsnaps[t.frame]) {
        try {restoreobjs(scene, t.playm.worldsnaps[t.frame])} catch (e) {}
      }
      try {scene.render = (i === n - 1) ? realRender : noRender} catch (e) {}
      alive = t.origstep(t.step);
      if (pauseinject) {
        input.onKeyReleased(27, 0);
        if (t.playm.inputonly) t.manualpause = ispaused(scene);
      }
      if (backinject) try {input.onKeyReleased(82, 0)} catch (e) {}
      if (inlevel() !== scene) break;
      if (recording && !t.macro.inputonly) recordicon(scene, t.frame);
      if (t.mode === "play" && !replaypaused) applyicon(scene, t.frame);
      if (!replaypaused) t.frame++;
      if (!inlevel()) break;
    }
    try {scene.render = realRender} catch (e) {}
    if (n === 0) {
      stack.renderWithoutStep();
      t.allowframeend = false;
    }
    refreshhud();
    return alive;
  };

  /*////////////////////////////////////////////////////////////////////*/

  // macro json
  function macrometa(scene) {
    const info = {name: "", from: "", version: ""};
    try {
      const lv = scene.getVariables().get("loadedLevel").getChild("levelInfo");
      info.name = lv.getChild("levelName").getAsString();
      info.from = lv.getChild("from").getAsString();
      info.version = lv.getChild("version").getAsString();
    } catch (e) {}
    return info;
  }

  function startsession(scene) {
    t.timerstarted = false;
    t.macro = {levelInfo: macrometa(scene), inputonly: true, events: [], length: 0};
    t.recinput = inputstate();
    t.restoredretry = false;
    t.recbaseline = false;
    t.inputqueue = baselineinput();
    t.frame = 0; t.ring = [];
    t.prevkeys = {}; t.prevmouse = false; t.prevcursor = [0, 0];
    t.editmode = false; t.cheated = false; t.fresh = null;
    t.mode = "record";
  }

  function exportmacro() {
    const m = t.playable && t.playable.macro;
    if (!m || !m.length) {note("no finished macro to export"); return}
    const levelInfo = Object.assign({}, m.levelInfo, {length: m.length});
    const data = JSON.stringify(m.inputonly ?
      {levelInfo: levelInfo, inputonly: true, events: m.events} :
      {levelInfo: levelInfo, events: m.events, icon: m.icon, worldsnaps: m.worldsnaps || {}});
    const fname = ((m.levelInfo && m.levelInfo.name) || "macro").replace(/[^\w\- ]/g, "") + ".tgdm";
    invoke("save_text_file", {defaultName: fname, content: data}).then(function (saved) {
      note(saved ? "macro exported" : "export cancelled");
    }, function () {
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([data], {type: "application/json"}));
        a.download = fname; a.click();
      } catch (e) {note("export failed")}
    });
  }

  function parsemacro(data) {
    const m = JSON.parse(data);
    const li = m && (m.levelInfo || (m.meta && m.meta.level)) || {};
    const len = (m && m.levelInfo && m.levelInfo.length) || (m && m.length) || 0;
    if (!m || !Array.isArray(m.events) || !Number.isSafeInteger(len) || len < 1) throw new Error("invalid macro");
    const macro = {levelInfo: li, events: m.events, length: len};
    if (m.inputonly === true) macro.inputonly = true;
    else {
      macro.icon = m.icon || [];
      macro.worldsnaps = m.worldsnaps || {};
    }
    return macro;
  }

  function importmacro() {
    const accept = data => {
      try {
        t.playable = {macro: parsemacro(data), src: "loaded"};
        note("macro imported (" + t.playable.macro.length + " frames)");
      } catch (e) {note("invalid macro file")}
    };
    try {
      const remote = window.require("@electron/remote");
      const fs = window.require("fs");
      const files = remote.dialog.showOpenDialogSync({
        title: "import macro",
        filters: [{name: "tgd macro", extensions: ["tgdm", "json"]}],
        properties: ["openFile"]
      });
      if (files && files[0]) accept(fs.readFileSync(files[0], "utf8"));
      return;
    } catch (e) {}
    try {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = ".tgdm,.json";
      picker.onchange = () => {
        const f = picker.files && picker.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => accept(reader.result);
        reader.readAsText(f);
      };
      picker.click();
    } catch (e) {
      const stored = window.localStorage.getItem("__tas_macro");
      if (stored) accept(stored); else note("import failed");
    }
  }

