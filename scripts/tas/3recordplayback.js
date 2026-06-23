  /*////////////////////////////////////////////////////////////////////*/

  // input recording & playback
  function samplekeys() {
    const cur = {};
    for (const name in t.watch) {
      if (input.isKeyPressed(t.watch[name])) cur[name] = true;
    }
    return cur;
  }

  function recordframe() {
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
    const entry = t.playm && t.playm.icon && t.playm.icon[frame];
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
      const want = !!keys[name] || (code === 32 && mouse);
      if (want && !input.isKeyPressed(code)) input.onKeyPressed(code, 0);
      if (!want && input.isKeyPressed(code)) input.onKeyReleased(code, 0);
    }
    if (mouse && !input.isMouseButtonPressed(0)) input.onMouseButtonPressed(0);
    if (!mouse && input.isMouseButtonPressed(0)) input.onMouseButtonReleased(0);
  }

  function playframe() {
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
  }

  function applypendingsynth() {
    if (t.synthtap) {
      if (t.synthtap.space) input.onKeyReleased(32, 0);
      if (t.synthtap.up) input.onKeyReleased(38, 0);
      if (t.synthtap.mouse) input.onMouseButtonReleased(0);
      t.synthtap = null;
    }
    const s = t.pendingsynth;
    if (!s) return;
    t.pendingsynth = null;
    const tap = {};
    if (s.space) {input.onKeyReleased(32, 0); input.onKeyPressed(32, 0); if (!t.physjump.space) tap.space = true}
    if (s.up) {input.onKeyReleased(38, 0); input.onKeyPressed(38, 0); if (!t.physjump.up) tap.up = true}
    if (s.mouse) {input.onMouseButtonReleased(0); input.onMouseButtonPressed(0); if (!t.physjump.mouse) tap.mouse = true}
    t.synthtap = tap;
  }

  function resyncheld() {
    if (t.mode === "play") return;
    if (t.physjump.space && !input.isKeyPressed(32)) input.onKeyPressed(32, 0);
    if (t.physjump.up && !input.isKeyPressed(38)) input.onKeyPressed(38, 0);
    if (t.physjump.mouse && !input.isMouseButtonPressed(0)) input.onMouseButtonPressed(0);
    if (t.jumpclick) {if (!input.isKeyPressed(32)) {input.onKeyPressed(32, 0); t.clickspace = true}}
    else if (t.clickspace) {input.onKeyReleased(32, 0); t.clickspace = false}
  }

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
    if (!m.icon || !m.icon.length) return;
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
    for (let f = 0; f < m.length; f++) {
      while (pos < events.length && events[pos][0] === f) {
        const ev = events[pos++];
        if (ev[1] === "kd") desired.keys[ev[2]] = true;
        if (ev[1] === "ku") delete desired.keys[ev[2]];
        if (ev[1] === "md") desired.mouse = true;
        if (ev[1] === "mu") desired.mouse = false;
        if (ev[1] === "mm") desired.cursor = [ev[2], ev[3]];
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
      newicon[nf] = icon[f];
      nf++;
    }
    note("trimmed macro: " + m.length + " -> " + nf + " frames (" + clusters.length + " segment(s) merged)");
    m.events = newevents;
    m.icon = newicon;
    m.length = nf;
  }
  /*//// trim end ////*/

  function endplayback(msg) {
    t.mode = "idle"; t.playend = null;
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
        t.pendingsynth = null; t.macro = null; t.prevstop = Infinity;
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
    if (t.mode === "play" && t.prevstop !== Infinity && stopnow < t.prevstop - 1) {
      endplayback("level restarted");
      t.prevstop = stopnow;
      refreshhud();
      return t.origstep(elapsed);
    }
    if (t.recording && !t.countdown && !t.requestrestart && !t.requestpractice && !t.ubacktrack) {
      const fresh = stopnow < t.prevstop - 1;
      if (t.mode === "record" && fresh) startsession(scene);
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
      try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
      refreshhud();
      return ok;
    }

    if (t.requestrestart) {
      t.requestrestart = null;
      t.editmode = false;
      const ok = dotreset(scene);

      try {svar(scene, "paused").setBoolean(false)} catch (e) {}
      clearpractice(scene, true);
      t.frame = 0; t.acc = 0; t.ring = [];
      t.prevkeys = {}; t.prevmouse = false; t.prevcursor = [0, 0];
      try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
      t.prevstop = 0;
      t.practice = false;

      if (t.playable) {
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

    if (!engaged()) {
      t.acc = 0;
      applypendingsynth();
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
    const replaypaused = (t.mode === "play" && ispaused(scene));
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
      applypendingsynth();
      resyncheld();
      if (t.mode === "play") {
        if (replaypaused) {
          releaseall();
        } else if (t.frame >= t.playm.length) {
          if (winshown(scene)) {
            if (!t.playend) t.playend = performance.now() + 4000;
            releaseall();
          } else {
            endplayback("playback finished");
          }
        } else playframe();
      }
      if (t.mode === "record") recordframe();
      let pauseinject = false;
      if (t.requestpause && t.mode === "play") {t.requestpause = false; pauseinject = true; try {input.onKeyPressed(27, 0)} catch (e) {}}

      let backinject = false;
      if (t.requestbacktrack && inlevel()) {const bt = (t.requestbacktrack === true) ? backtarget() : t.requestbacktrack; t.requestbacktrack = false; if (bt) {applynormalcp(scene, bt); t.ubacktrack = 8; backinject = true; try {input.onKeyPressed(82, 0)} catch (e) {}}}
      try {scene.render = (i === n - 1) ? realRender : noRender} catch (e) {}
      alive = t.origstep(t.step);
      if (pauseinject) try {input.onKeyReleased(27, 0)} catch (e) {}
      if (backinject) try {input.onKeyReleased(82, 0)} catch (e) {}
      if (t.mode === "record") recordicon(scene, t.frame);
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
    t.macro = {levelInfo: macrometa(scene), events: [], icon: [], length: 0};
    t.frame = 0; t.ring = [];
    t.prevkeys = {}; t.prevmouse = false; t.prevcursor = [0, 0];
    t.editmode = false; t.cheated = false; t.fresh = null;
    t.mode = "record";
  }

  function exportmacro() {
    const m = t.playable && t.playable.macro;
    if (!m || !m.length) {note("no finished macro to export"); return}
    const levelInfo = Object.assign({}, m.levelInfo, {length: m.length});
    const data = JSON.stringify({levelInfo: levelInfo, events: m.events, icon: m.icon});
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

  function importmacro() {
    const accept = data => {
      try {
        const m = JSON.parse(data);
        if (!m || !Array.isArray(m.events)) {note("invalid macro file"); return}
        const li = m.levelInfo || (m.meta && m.meta.level) || {};
        const len = (m.levelInfo && m.levelInfo.length) || m.length || 0;
        t.playable = {macro: {levelInfo: li, events: m.events, icon: m.icon || [], length: len}, src: "loaded"};
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

