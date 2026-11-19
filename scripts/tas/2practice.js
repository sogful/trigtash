  /*////////////////////////////////////////////////////////////////////*/

  const cpnames = ["checkpointMode", "checkpointX", "checkpointY", "checkpointAngle", "checkpointSpeed",
    "checkpointSize", "checkpointGravX", "checkpointGravY", "checkpointOn",
    "checkpointbgColor1R", "checkpointbgColor1G", "checkpointbgColor1B",
    "checkpointbgColor2R", "checkpointbgColor2G", "checkpointbgColor2B",
    "checkpointgColor1R", "checkpointgColor1G", "checkpointgColor1B",
    "checkpointgColor2R", "checkpointgColor2G", "checkpointgColor2B"];

  function readcp(scene) {
    const out = {};
    for (const n of cpnames) {try {out[n] = svar(scene, n).toJSObject()} catch (e) {}}
    return out;
  }

  function applycp(scene, cp) {
    for (const n in cp) {try {svar(scene, n).fromJSObject(cp[n])} catch (e) {}}
  }
  t.readcp = readcp;

  function aliveplayer(scene) {
    for (const pname of playernames) {
      for (const o of scene.getObjects(pname) || []) {
        if (!o.isHidden()) return o;
      }
    }
    return null;
  }

  function placecp(scene) {
    const p = aliveplayer(scene);
    if (!p) return;
    const prev = readcp(scene);
    const vars = scene.getVariables();
    const num = (name, value) => {try {vars.get(name).setNumber(value)} catch (e) {}};
    try {vars.get("checkpointMode").setString(vars.get("mode").getAsString())} catch (e) {}
    try {
      num("checkpointGravX", vars.get("gravity").getChild("x").getAsNumber());
      num("checkpointGravY", vars.get("gravity").getChild("y").getAsNumber());
    } catch (e) {}
    try {num("checkpointSize", vars.get("mini").getAsNumber())} catch (e) {}
    num("checkpointX", p.getX());
    num("checkpointY", p.getY());
    num("checkpointAngle", p.getAngle());
    try {num("checkpointSpeed", vars.get("speed").getAsNumber())} catch (e) {}
    try {num("checkpointOn", vars.get("on").getAsNumber())} catch (e) {}
    for (const [varname, prefix] of [["bgcolor1", "checkpointbgColor1"], ["bgcolor2", "checkpointbgColor2"],
      ["gcolor1", "checkpointgColor1"], ["gcolor2", "checkpointgColor2"]]) {
      try {
        const arr = vars.get(varname).toJSObject();
        num(prefix + "R", arr[0]); num(prefix + "G", arr[1]); num(prefix + "B", arr[2]);
      } catch (e) {}
    }
    const snap = capture(scene);
    if (t.mode === "record") snap.frame++;
    let marker = null;
    try {
      marker = scene.createObject("practicepoint");
      if (marker) {
        marker.setLayer("");
        marker.setZOrder(1);
        marker.setPosition(p.getX() + p.getWidth() / 2 - marker.getWidth() / 2,
          p.getY() + p.getHeight() / 2 - marker.getHeight() / 2);
      }
    } catch (e) {}

    const prevtop = t.practstack.length ? t.practstack[t.practstack.length - 1] : null;
    const stamp = t.fresh || (prevtop && prevtop.normalcp) || null;
    t.fresh = null;
    t.practstack.push({prev, snap, marker, normalcp: stamp, cp: readcp(scene), hadcp: t.hadcp});
    t.hadcp = true;
  }

  function matchespractice(scene, entry) {
    if (!entry) return false;
    const cp = readcp(scene);
    return cpnames.every(name => cp[name] === entry.cp[name]);
  }

  function erasecp(scene) {
    const entry = t.practstack.pop();
    if (!entry) return;
    if (matchespractice(scene, entry)) {
      applycp(scene, entry.prev);
      t.hadcp = entry.hadcp;
    }
    if (entry.marker) {try {entry.marker.deleteFromScene(scene)} catch (e) {}}
  }

  function clearpractice(scene, rebase) {
    for (const entry of t.practstack) {
      if (entry.marker) {try {entry.marker.deleteFromScene(scene)} catch (e) {}}
    }
    t.practstack = [];
    t.practbase = rebase && t.practice ? readcp(scene) : null;
  }

  function settledpractice(scene, on) {
    t.practice = on;
    if (on) {
      t.practbase = readcp(scene);
      try {t.prevdeaths = svar(scene, "deaths").getAsNumber()} catch (e) {}
    } else {
      if (t.practbase) applycp(scene, t.practbase);
      clearpractice(scene, false);
    }
  }
  t.settledpractice = settledpractice;

  function savenormalcp(scene) {
    const out = {};
    try {const items = scene.getVariables()._variables.items; for (const k in items) {if (k.indexOf("checkpoint") === 0) {try {out[k] = items[k].toJSObject()} catch (e) {}}}} catch (e) {}
    return out;
  }
  function applynormalcp(scene, cp) {
    const c = scene.getVariables();
    for (const k in cp) {try {c.get(k).fromJSObject(cp[k])} catch (e) {}}
  }
  function onnormalcp(scene) {
    const p = aliveplayer(scene);
    if (!p) return false;
    const px = p.getCenterXInScene(), py = p.getCenterYInScene();
    for (const o of scene.getObjects("checkpoint") || []) {
      try {if (px >= o.getAABBLeft() && px <= o.getAABBRight() && py >= o.getAABBTop() && py <= o.getAABBBottom()) return true} catch (e) {}
    }
    return false;
  }
  function backtarget() {
    const top = t.practstack.length ? t.practstack[t.practstack.length - 1] : null;
    return (top && top.normalcp) || null;
  }
  t.applynormalcp = applynormalcp;

  t.beforepracticerespawn = function(scene) {
    if (!t.practice || ispaused(scene) || winshown(scene)) return;
    const xdown = scene.getGame().getInputManager().isKeyPressed(88);
    if (xdown && !t.prevx) {
      erasecp(scene);
      t.prevx = true;
    }
  };

  t.afterpracticerespawn = function(scene) {
    if (!t.practice || t.ubacktrack || winshown(scene) || ispaused(scene)) return;
    const entry = t.practstack[t.practstack.length - 1];
    if (!matchespractice(scene, entry)) return;
    restore(scene, entry.snap, "practice");
    const inputmanager = scene.getGame().getInputManager();
    svar(scene, "tasretryheld").setBoolean(inputmanager.isKeyPressed(82));
    t.ring.length = 0;
    if (t.mode === "record") rewindrecord(entry.snap.frame, true);
    t.prevdeaths = svar(scene, "deaths").getAsNumber();
  };

  /*//////////////////////////////////////////////////////////////////////*/

  t.practicetick = function(scene) {
    const im = scene.getGame().getInputManager();
    const zdown = im.isKeyPressed(90), xdown = im.isKeyPressed(88), rdown = im.isKeyPressed(82);
    if ((!rdown || im.wasKeyReleased(82)) && scene.getVariables().has("tasretryheld")) {
      svar(scene, "tasretryheld").setBoolean(false);
    }
    let deaths = t.prevdeaths;
    try {deaths = svar(scene, "deaths").getAsNumber()} catch (e) {}

    let cpx0 = 0, cpy0 = 0;
    try {cpx0 = svar(scene, "checkpointX").getAsNumber(); cpy0 = svar(scene, "checkpointY").getAsNumber()} catch (e) {}
    if (!t.cpinit) {t.cpinit = true; t.cp0 = [cpx0, cpy0]}
    else if (!t.hadcp && (Math.abs(cpx0 - t.cp0[0]) > 0.5 || Math.abs(cpy0 - t.cp0[1]) > 0.5)) t.hadcp = true;
    if (deaths < t.prevdeaths) {t.hadcp = false; t.cpinit = false}
    if (deaths > t.prevdeaths && !t.hadcp) resetstopwatch(scene);
    if (rdown && !t.prevr && !t.hadcp && !ispaused(scene) && !winshown(scene)) resetstopwatch(scene);

    {
      const onnow = onnormalcp(scene);
      const ap0 = aliveplayer(scene);
      const px0 = ap0 ? ap0.getCenterXInScene() : t.prevpx;
      const teleported = t.prevpx !== undefined && typeof px0 === "number" && Math.abs(px0 - t.prevpx) > 40;

      if (!onnow && t.prevoncp && !teleported) {
        const snap = savenormalcp(scene);
        const cx = snap.checkpointX, cy = snap.checkpointY;
        let onreal = false;
        if (typeof cx === "number") {try {for (const o of scene.getObjects("checkpoint") || []) {if (Math.abs(o.getCenterXInScene() - cx) < 24 && (typeof cy !== "number" || Math.abs(o.getCenterYInScene() - cy) < 24)) {onreal = true; break}}} catch (e) {}}
        if (onreal) t.fresh = snap;
      }
      t.prevoncp = onnow;
      if (typeof px0 === "number") t.prevpx = px0;
    }
    if (t.ubacktrack > 0) t.ubacktrack--;
    const udown = im.isKeyPressed(85);
    if (udown && !t.prevu && backtarget() && !t.ubacktrack && t.mode === "record" && !ispaused(scene) && !winshown(scene)) {
      t.requestbacktrack = backtarget();
      if (t.macro && !t.macro.inputonly) t.macro.events.push([t.frame, "back", t.requestbacktrack]);
    }

    if (t.practice && !ispaused(scene) && !winshown(scene)) {
      if (zdown && !t.prevz) placecp(scene);
      if (xdown && !t.prevx) erasecp(scene);
    }
    t.prevz = zdown; t.prevx = xdown; t.prevr = rdown;
    t.prevu = udown; t.prevdeaths = deaths;
  };

