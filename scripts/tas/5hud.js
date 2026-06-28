  /*////////////////////////////////////////////////////////////////////*/

  // hud rendering
  // read: macroMode, macroFrozen, macroPace, macroHitbox, macroPractice, macroHasPlayable, macroFrameadv, macroOverlay
  // write: macroCmd = freeze|play|stepforward|stepback|slower|faster|resetspeed|hitbox|export|import|practice (run + cleared)
  const cmdmap = {freeze: "pauseresume", play: "playmacro", stepforward: "stepf",
    stepback: "stepb", slower: "slower", faster: "faster", resetspeed: "speed",
    hitbox: "hitbox", export: "exportm", import: "importm", practice: "practice",
    record: "record", video: "video"};

  function syncbridge(scene) {
    const v = scene.getVariables();
    const sn = (n, x) => {try {v.get(n).setNumber(x)} catch (e) {}};
    const ss = (n, x) => {try {v.get(n).setString(x)} catch (e) {}};
    ss("macroMode", t.mode);
    sn("macroFrozen", t.frozen ? 1 : 0);
    sn("macroPace", t.pace);
    sn("macroHitbox", t.hitboxes ? 1 : 0);
    sn("macroRecording", t.recording || t.mode === "record" ? 1 : 0);
    sn("macroEnabled", t.hotkey ? 1 : 0);
    sn("macroPractice", t.practice ? 1 : 0);
    sn("macroHasPlayable", t.playable ? 1 : 0);
    sn("macroFrameadv", t.frameadv ? 1 : 0);
    sn("macroOverlay", (t.hotkey && t.uivisible) ? 1 : 0);
    // cheating makes a main level run illegitimate
    if (t.pace !== 1 || t.frozen || t.hitboxes || t.practice || t.mode === "play") t.cheated = true;
    sn("macroCheated", t.cheated ? 1 : 0);
    let cmd = "";
    try {cmd = v.get("macroCmd").getAsString()} catch (e) {}
    if (cmd && cmd !== "0") {
      const fn = actions[cmdmap[cmd] || cmd];
      if (fn) fn();
      try {v.get("macroCmd").setString("")} catch (e) {}
    }
  }
  t.syncbridge = syncbridge;

  function spawncat(scene) {
    let cat = null;
    try {cat = scene.createObject("cat")} catch (e) {return}
    if (!cat) return;
    try {cat.setLayer("")} catch (e) {}
    let rx = 216, ry = 120;
    try {
      const lay = scene.getLayer("");
      const zoom = Math.max(0.05, lay.getCameraZoom());
      const hw = (216 / zoom) * 0.8, hh = (120 / zoom) * 0.8;
      rx = lay.getCameraX() + (Math.random() * 2 - 1) * hw;
      ry = lay.getCameraY() + (Math.random() * 2 - 1) * hh;
    } catch (e) {}
    try {cat.setPosition(rx, ry)} catch (e) {}
    try {const b = cat.getBehavior("Physics2"); if (b.updateBodyFromObject) b.updateBodyFromObject(); b.setLinearVelocityX(0); b.setLinearVelocityY(0); b.setAngularVelocity((Math.random() * 2 - 1) * 40)} catch (e) {}
  }

  function refreshhud() {
    const scene = inlevel();
    if (!scene) return;
    if (t.spawncat) {t.spawncat = false; if (t.hotkey && t.mode !== "play" && !t.vidphase && !t.countdown) spawncat(scene)}
    {
      if (t.lastscene !== scene) {t.lastscene = scene; t.levelspawn = null; t.timerstarted = false; try {t.startcp = readcp(scene)} catch (e) {}}
      if (t.levelspawn === null) {try {t.levelspawn = [svar(scene, "checkpointX").getAsNumber(), svar(scene, "checkpointY").getAsNumber()]} catch (e) {}}
      const pl = aliveplayer(scene);
      if (pl && t.levelspawn) {
        const plx = pl.getX(), ply = pl.getY();
        const atspawn = Math.abs(plx - t.levelspawn[0]) < 0.1 && Math.abs(ply - t.levelspawn[1]) < 0.1;
        const tele = t.tprevx !== undefined && (Math.abs(plx - t.tprevx) > 20 || Math.abs(ply - t.tprevy) > 20);
        if (atspawn && tele) t.timerstarted = false;
        if (!t.timerstarted) {
          if (atspawn) {
            try {const tm = scene.getTimeManager()._timers.get("stopwatch"); if (tm) tm.setTime(0)} catch (e) {}
            try {gdjs.evtTools.runtimeScene.pauseTimer(scene, "stopwatch")} catch (e) {}
            try {svar(scene, "stopwatchTime").setNumber(0)} catch (e) {}
          } else {
            t.timerstarted = true;
            t.timerstartframe = t.frame;
            try {gdjs.evtTools.runtimeScene.unpauseTimer(scene, "stopwatch")} catch (e) {}
          }
        }
        if (t.mode === "play" && t.timerstarted) {
          try {const tm = scene.getTimeManager()._timers.get("stopwatch"); const want = Math.max(0, (t.frame - (t.timerstartframe || 0)) * t.step); if (tm && tm.getTime() >= want - 200) tm.setTime(want)} catch (e) {}
        }
        t.tprevx = plx; t.tprevy = ply;
      }
    }

    // input display
    try {
      const cells = scene.getObjects("tasinput") || [];
      const showinp = t.inputviewer && !t.countdown && !t.playend && !t.vidblock && !t.vidphase;
      const LAY = [[384, 178, 20, 0, "up"], [364, 198, 0, 20, "left"],
        [404, 198, 40, 20, "right"], [384, 198, 20, 20, "down"]];
      let jump = false, lf = false, rt = false;
      if (showinp && t.mode === "play") {
        const pk = t.playkeys || {};
        jump = !!pk.Space || !!pk.Up || !!t.playmouse; lf = !!pk.Left; rt = !!pk.Right;
      } else if (showinp) {
        try {jump = input.isKeyPressed(t.watch.Space) || input.isKeyPressed(t.watch.Up) || input.isKeyPressed(87) || !!t.jumpclick} catch (e) {}
        try {lf = input.isKeyPressed(t.watch.Left) || input.isKeyPressed(65)} catch (e) {}
        try {rt = input.isKeyPressed(t.watch.Right) || input.isKeyPressed(68)} catch (e) {}
      }
      const held = {up: jump, left: lf, right: rt, down: false};
      const IDLE = "assets\\textures\\inputs.png", HELD = "assets\\textures\\inputsheld.png";
      for (let i = 0; i < cells.length && i < LAY.length; i++) {
        const o = cells[i], a = LAY[i];
        if (!showinp) {o.hide(true); continue}
        o.hide(false);
        try {o.setLayer("ui"); o.setZOrder(10006); o.setWidth(20); o.setHeight(20)} catch (e) {}
        const h = !!held[a[4]];
        if (o.__inpheld !== h) {o.__inpheld = h; try {o.setTexture(h ? HELD : IDLE, scene)} catch (e) {}}
        try {o.setXOffset(a[2]); o.setYOffset(a[3])} catch (e) {}
        try {o.setPosition(a[0], a[1])} catch (e) {}
      }
    } catch (e) {}

    try {
      let pl = null, vx = 0, vy = 0;
      const wantinfo = t.velocityreadout && !t.countdown && !t.vidblock && !t.vidphase;
      const wantvec = t.velvector && !t.countdown && !t.vidblock && !t.vidphase;
      if (wantinfo || wantvec) pl = aliveplayer(scene);
      if (pl) {
        let va = 0, px = 0, py = 0;
        try {const b = pl.getBehavior("Physics2"); vx = b.getLinearVelocityX(); vy = b.getLinearVelocityY(); va = b.getAngularVelocity()} catch (e) {}
        try {px = pl.getX(); py = pl.getY()} catch (e) {}
        if (wantinfo && t.veltext) {
          t.veltext.hide(false);
          try {t.veltext.setScale(0.5)} catch (e) {}
          const lbl = s => (s + "     ").slice(0, 5);
          const fit = (n, dec) => {
            let s = n.toFixed(dec);
            while (s.length > 7 && dec > 0) {dec--; s = n.toFixed(dec)}
            if (s.length > 7) {s = n.toExponential(1); if (s.length > 7) s = n.toExponential(0)}
            return s.padStart(7);
          };
          const vxs = fit(vx, 2);
          t.veltext.setText(
            lbl("x") + fit(px, 3) + " " + lbl("y") + fit(py, 3) + "\n" +
            lbl("xvel") + "       " + " " + lbl("yvel") + fit(vy, 2) + "\n" +
            lbl("ang") + va.toFixed(4));
          try {t.veltext.setTint("255;255;255")} catch (e) {}
          let gh = 224; try {gh = game.getGameResolutionHeight()} catch (e) {}
          const vty = gh - 6 - t.veltext.getHeight();
          t.veltext.setPosition(4, vty);
          // overlay just the xvel value, tinted redder the further |xvel| runs past the
          // gamemode's normal cap - a successful xvel boost. cube/ball 150, ship 75,
          // ufo 200, wave 175 (read live from the mode + <mode>speed scene vars)
          if (t.xvelcol) {
            let cap = 150;
            try {const m = svar(scene, "mode").getAsString(); const c = svar(scene, m + "speed").getAsNumber(); if (c > 0) cap = c} catch (e) {}
            const rr = Math.min(1, Math.max(0, Math.abs(vx) - cap) / (cap * 0.5));
            const gb = Math.round(255 - rr * 195);
            t.xvelcol.hide(false);
            try {t.xvelcol.setScale(0.5)} catch (e) {}
            t.xvelcol.setText(vxs);
            try {t.xvelcol.setTint("255;" + gb + ";" + gb)} catch (e) {try {t.xvelcol.setColor("255;" + gb + ";" + gb)} catch (e2) {}}
            let cw = 0, lh = 0; try {cw = t.veltext.getWidth() / 25; lh = t.veltext.getHeight() / 3} catch (e) {}
            t.xvelcol.setPosition(4 + 5 * cw, vty + lh);
          }
        } else {if (t.veltext) t.veltext.hide(true); if (t.xvelcol) t.xvelcol.hide(true)}
      } else {if (t.veltext) t.veltext.hide(true); if (t.xvelcol) t.xvelcol.hide(true)}
      if (t.veldraw) {
        try {t.veldraw.clear()} catch (e) {}
        if (pl && wantvec) {
          try {
            const cx = pl.getCenterXInScene(), cy = pl.getCenterYInScene(), sc = 0.1;
            let col = "255;255;255";
            try {col = pl.getColor()} catch (e) {}
            if (col === "255;255;255") {try {const c = svar(scene, "color1").getAsString(); if (c && c.split(";").length === 3) col = c} catch (e) {}}
            const dc = col.split(";").map(n => Math.round(Math.min(255, (parseInt(n) || 0) * 1.2))).join(";");
            t.veldraw.setOutlineColor(dc); t.veldraw.setFillColor(dc);
            t.veldraw.setOutlineOpacity(255); t.veldraw.setFillOpacity(255); t.veldraw.setOutlineSize(1);
            t.veldraw.drawLine(cx, cy, cx + vx * sc, cy + vy * sc, 1);
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (t.vidphase === "render") return;
    syncbridge(scene);
    const hidemarks = t.mode === "play" || t.countdown;
    for (const o of scene.getObjects("practicepoint") || []) {try {o.hide(hidemarks)} catch (e) {}}
    if (t.hudowner !== scene) return;
    const btns = t.buttons || [];
    const everything = btns.concat(t.pract ? [t.pract] : []);
    drawblack();
    drawhitboxes(scene);

    if (t.mode === "record" && t.practice) {
      const bcp = backtarget();
      const btx = bcp ? bcp.checkpointX : null;
      const bty = bcp ? bcp.checkpointY : null;
      const ap = aliveplayer(scene);
      const apx = ap ? ap.getCenterXInScene() : null;
      const apy = ap ? ap.getCenterYInScene() : null;
      try {for (const o of scene.getObjects("checkpoint") || []) {
        o.setOpacity(90);
        const cx = o.getCenterXInScene();
        if (apx !== null && Math.abs(cx - apx) < 24 && (apy === null || Math.abs(o.getCenterYInScene() - apy) < 24)) continue;
        const istarget = (typeof btx === "number") && Math.abs(cx - btx) < 16 && (typeof bty !== "number" || Math.abs(o.getCenterYInScene() - bty) < 16);
        try {const v = o.getVariables().get("selected"); if ((v.getAsBoolean() ? 1 : 0) !== (istarget ? 1 : 0)) v.setBoolean(istarget)} catch (e) {}
        try {const ab = o.getBehavior("Animation"); const want = istarget ? 1 : 0; if (ab.getAnimationIndex() !== want) ab.setAnimationIndex(want)} catch (e) {}
      }} catch (e) {}
    } else {
      try {for (const o of scene.getObjects("checkpoint") || []) o.setOpacity(255)} catch (e) {}
    }

    if (t.vidphase === "export" || t.vidphase === "exported") {
      completegrey(scene, true);
      if (t.counttext) {
        t.counttext.hide(false);
        try {t.counttext.setScale(0.5)} catch (e) {}
        t.counttext.setText(t.vidstep || "");
        t.counttext.setPosition(216 - t.counttext.getWidth() / 2, 224);
      }
      // "video exported!" for 2s
      if (t.vidphase === "exported" && performance.now() - t.exporteddone > 2000) {
        t.vidphase = null; t.vidblock = false;
        completegrey(scene, false);
        // the render dimmed the complete-screen objects to hide them from the footage;
        // bring them back so the complete screen reappears after exporting - the bg dim
        // is semitransparent (the game tweens it to 255/3), the rest are fully opaque
        for (const n of completeobjs) for (const o of scene.getObjects(n) || []) {try {o.setOpacity(n === "levelCompleteBg" ? 85 : 255)} catch (e) {}}
        if (t.counttext) {t.counttext.hide(); try {t.counttext.setScale(3)} catch (e) {}}
        // the offline playthrough left practice checkpoints set (applynormalcp fires on
        // each replayed death), so a restart from the complete screen would respawn
        // mid-level with the stale bg. restore the clean level-start checkpoint captured
        // on load, so dying/restarting from here is a full reset to the start
        if (t.startcp) try {applycp(scene, t.startcp)} catch (e) {}
        t.vidstep = "";
      }
    }

    const overlayon = t.hotkey && t.uivisible && t.mode !== "play" && !t.countdown;
    if (t.mode === "play" || t.countdown) {
      if (t.speedtext) t.speedtext.hide();
      for (const b of btns) {b.obj.hide(); b.hover = false}
      const pausededit = t.mode === "play" && !t.countdown && ispaused(scene) && !winshown(scene);
      if (!pausededit) {
        if (t.pract) {t.pract.obj.hide(); t.pract.hover = false}
        if (t.tiptext) t.tiptext.hide(true);
        return;
      }
    }
    if (!overlayon) {
      if (t.speedtext) t.speedtext.hide();
      for (const b of btns) {b.obj.hide(); b.hover = false}
    }

    if (t.dragcand) {
      const c = t.dragcand;
      const dx = input.getCursorX() - c.sx, dy = input.getCursorY() - c.sy;
      if (!c.active && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) c.active = true;
      if (c.active) t.uipos = {x: c.ux + dx, y: c.uy + dy};
    }

    let alpha = 255;
    if (t.fadein) {
      alpha = Math.min(255, (performance.now() - t.fadein) / 600 * 255);
      if (alpha >= 255) t.fadein = null;
    }

    const cx = input.getCursorX(), cy = input.getCursorY();
    const hovertest = o => cx >= o.getAABBLeft() - 2 && cx <= o.getAABBRight() + 2 &&
      cy >= o.getAABBTop() - 2 && cy <= o.getAABBBottom() + 2;

    let demo = false;
    try {demo = scene.getVariables().get("demoActive").getAsBoolean()} catch (e) {}
    const demohidden = b => demo && (b.def.id === "exportm" || b.def.id === "importm");

    if (overlayon) {
      const rowh = 24;
      const inrow = btns.filter(b => !b.def.under && !(b.def.adv && !t.frameadv) && !demohidden(b));
      let roww = 0;
      for (const b of inrow) roww += b.obj.getWidth() + 4;
      roww = Math.max(0, roww - 4);
      let ox = 400 - roww, oy = 4;
      if (t.uipos) {
        ox = Math.max(2, Math.min(430 - roww, t.uipos.x));
        oy = Math.max(2, Math.min(204, t.uipos.y));
      }
      t.uiorigin = [ox, oy];
      let x = ox;
      let underx = {};
      for (const b of btns) {
        if (b.def.under) {
          const anchor = underx[b.def.under];
          const show = !!anchor && !!t.playable;
          b.obj.hide(!show);
          if (!show) {b.hover = false; continue}
          if (b.def.id === "video") b.obj.setAnimationIndex(t.vidphase === "render" ? 1 : 0);

          const sy = oy + rowh + 4 + (b.def.stack || 0) * 28;
          b.obj.setPosition(anchor[0] + (anchor[1] - b.obj.getWidth()) / 2, sy);
          b.hover = hovertest(b.obj);
          try {b.obj.setOpacity(alpha * (b.hover ? 1 : 0.75))} catch (e) {}
          continue;
        }
        if (b.def.adv && !t.frameadv) {b.obj.hide(); b.hover = false; continue}
        if (demohidden(b)) {b.obj.hide(); b.hover = false; continue}
        b.obj.hide(false);
        if (b.def.id === "pauseresume") b.obj.setAnimationIndex(t.frozen ? 0 : 1);
        if (b.def.id === "hitbox") b.obj.setAnimationIndex(t.hitboxes ? 0 : 1);
        if (b.def.id === "record") b.obj.setAnimationIndex((t.recording || t.mode === "record") ? 1 : 0);
        if (b.def.id === "video") b.obj.setAnimationIndex(t.vidphase === "render" ? 1 : 0);

        let dis = false;
        if (b.def.id === "exportm") dis = !(t.playable && t.playable.macro && t.playable.macro.length);
        else if (b.def.id === "importm") dis = t.mode === "play";
        b.hover = !dis && hovertest(b.obj);
        b.obj.setPosition(x, oy + (rowh - b.obj.getHeight()) / 2);
        underx[b.def.id] = [b.obj.getX(), b.obj.getWidth()];
        x += b.obj.getWidth() + 4;
        try {b.obj.setOpacity(dis ? alpha * 0.3 : alpha * (b.hover ? 1 : 0.75))} catch (e) {}
        if (b.def.id === "speed" && t.speedtext) {
          t.speedtext.hide(false);
          t.speedtext.setText("x" + t.pace);
          t.speedtext.setPosition(b.obj.getX() + b.obj.getWidth() / 2 - t.speedtext.getWidth() / 2, oy + rowh + 2);
          try {t.speedtext.setOpacity(alpha)} catch (e) {}
        }
      }
    }

    if (t.pract) {
      const show = ispaused(scene) && !winshown(scene);
      const h = t.pract.obj.getHeight() / Math.max(0.01, t.pract.obj.getScale());
      const targety = show ? 168 - h / 2 : 280;
      if (!t.practtween || t.practtween.to !== targety) {
        t.practtween = {from: t.practy, to: targety, start: performance.now()};
      }
      const k = Math.min(1, (performance.now() - t.practtween.start) / 500);
      const c1 = 1.70158, c3 = c1 + 1;
      const eased = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      t.practy = t.practtween.from + (t.practtween.to - t.practtween.from) * eased;
      const offscreen = t.practy > 245 && !show;
      t.pract.obj.hide(offscreen);
      try {t.pract.obj.setAnimationIndex(t.practice ? 1 : 0)} catch (e) {}
      if (!offscreen) {
        t.pract.hover = show && hovertest(t.pract.obj);
        const targetscale = t.pract.hover ? 1.1 : 1;
        t.pract.obj.setScale(t.pract.obj.getScale() + (targetscale - t.pract.obj.getScale()) * 0.3);
        const w = t.pract.obj.getWidth();
        t.pract.obj.setPosition(216 - w / 2, t.practy);
        try {t.pract.obj.setOpacity(255)} catch (e) {}
      } else t.pract.hover = false;
    }

    // various labels
    if (t.tiptext) {
      let tip = null, tipid = null;
      if (overlayon) {
        for (const b of everything) {if (b.hover && b.obj && !b.obj.isHidden()) {tip = t.buttontips[b.def.id]; tipid = b.def.id; if (tip) break}}
      }
      // hold 5s from when the hover began, fade over 1s, then gone even if still hovering
      if (tip) {
        if (t.tiphoverid !== tipid) {t.tiphoverid = tipid; t.tipstart = performance.now()}
        const el = performance.now() - t.tipstart;
        const op = el > 5000 ? Math.max(0, 255 * (1 - (el - 5000) / 1000)) : 255;
        if (op <= 0) {t.tiptext.hide(true)}
        else {
          t.tiptext.hide(false);
          try {t.tiptext.setScale(0.5)} catch (e) {}
          try {t.tiptext.setOpacity(Math.round(op))} catch (e) {}
          t.tiptext.setText(tip);
          let gw = 432, gh = 224; try {gw = game.getGameResolutionWidth(); gh = game.getGameResolutionHeight()} catch (e) {}
          t.tiptext.setPosition(gw / 2 - t.tiptext.getWidth() / 2, gh - 14);
        }
      } else {t.tiphoverid = null; t.tiptext.hide(true)}
    }
    if (t.edittext) {
      if (t.editmode && t.mode === "record") {
        t.edittext.hide(false);
        try {t.edittext.setScale(0.5)} catch (e) {}
        try {t.edittext.setOpacity(128)} catch (e) {}
        t.edittext.setText("(editing macro)");
        let gw = 432, gh = 224; try {gw = game.getGameResolutionWidth(); gh = game.getGameResolutionHeight()} catch (e) {}
        t.edittext.setPosition(gw / 2 - t.edittext.getWidth() / 2, gh - 13);
      } else {t.edittext.hide(true)}
    }
    if (t.backtext) {
      const showback = t.mode === "record" && backtarget() && !t.editmode && !ispaused(scene) && !winshown(scene);
      // appears, holds 2s at full, fades over 1s, then stays gone until it next re-appears
      let bop = 0;
      if (showback) {
        if (t.backappear == null) t.backappear = performance.now();
        const el = performance.now() - t.backappear;
        bop = el > 2000 ? Math.max(0, 128 * (1 - (el - 2000) / 1000)) : 128;
      } else {t.backappear = null}
      if (showback && bop > 0) {
        t.backtext.hide(false);
        try {t.backtext.setScale(0.5)} catch (e) {}
        try {t.backtext.setOpacity(Math.round(bop))} catch (e) {}
        t.backtext.setText("('U' to backtrack)");
        let gw = 432, gh = 224; try {gw = game.getGameResolutionWidth(); gh = game.getGameResolutionHeight()} catch (e) {}
        t.backtext.setPosition(gw / 2 - t.backtext.getWidth() / 2, gh - 13);
        if (t.backicon) {
          try {
            t.backicon.hide(false);
            t.backicon.setScale(0.5);
            t.backicon.setOpacity(Math.round(bop));
            t.backicon.setPosition(t.backtext.getX() - t.backicon.getWidth() - 3, gh - 13 + (t.backtext.getHeight() - t.backicon.getHeight()) / 2);
          } catch (e) {}
        }
      } else {t.backtext.hide(true); if (t.backicon) {try {t.backicon.hide(true)} catch (e) {}}}
    }
  }
  t.refreshhud = refreshhud;

  const onpausebtn = function() {
    const sc = inlevel(); if (!sc) return false;
    let cx, cy; try {cx = input.getCursorX(); cy = input.getCursorY()} catch (e) {return false}
    try {for (const o of sc.getObjects("pausebutton") || []) {
      if (!o.isHidden() && cx >= o.getAABBLeft() && cx <= o.getAABBRight() && cy >= o.getAABBTop() && cy <= o.getAABBBottom()) return true;
    }} catch (e) {}
    return false;
  };

