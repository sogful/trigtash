  /*////////////////////////////////////////////////////////////////////*/

  // dom listeners
  window.addEventListener("mousedown", function(e) {
    if (t.vidblock) {e.preventDefault(); e.stopImmediatePropagation(); return}
    if (e.button === 0) {
      t.physjump.mouse = true;
      if (t.awaitrespawn) t.bufjump.mouse = true;
    }
    if (!inlevel()) return;
    if (t.mode === "play") {
      let pausedrep = false;
      try {pausedrep = svar(inlevel(), "paused").getAsBoolean()} catch (er) {}
      if (!pausedrep) {
        if (e.button === 0 && onpausebtn()) t.requestpause = true;
        e.preventDefault(); e.stopImmediatePropagation(); return;
      }
      if (e.button === 0 && t.pract && t.pract.hover && !t.pract.obj.isHidden()) {
        actions.practice();
        t.swallowup = true;
        refreshhud();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    if (e.button !== 0) return;
    refreshhud();
    const all = (t.buttons || []).concat(t.pract ? [t.pract] : []);
    const hit = all.find(b => b.hover && !b.obj.isHidden());
    if (hit) {
      if (hit.def.hold || hit.def.id === "practice") {
        actions[hit.def.id]();
        if (hit.def.hold) t.hold = {action: actions[hit.def.id], next: performance.now() + 350};
      } else {
        t.dragcand = {sx: input.getCursorX(), sy: input.getCursorY(),
          ux: t.uiorigin[0], uy: t.uiorigin[1], btn: hit, active: false};
      }
      t.swallowup = true;
      refreshhud();
      e.preventDefault();
      e.stopImmediatePropagation();
    } else {
      let paused = false;
      try {paused = svar(inlevel(), "paused").getAsBoolean()} catch (e) {}
      if (!paused && !onpausebtn()) t.jumpclick = true;
    }
  }, true);

  window.addEventListener("mouseup", function(e) {
    if (t.vidblock) {e.preventDefault(); e.stopImmediatePropagation(); return}
    t.hold = null;
    if (e.button === 0) {t.physjump.mouse = false; t.jumpclick = false}
    if (t.dragcand) {
      const c = t.dragcand;
      t.dragcand = null;
      if (c.active) {
        t.uipos = {x: t.uiorigin[0], y: t.uiorigin[1]};
        try {window.localStorage.setItem("__tas_uipos", JSON.stringify(t.uipos))} catch (err) {}
      } else if (actions[c.btn.def.id]) {
        actions[c.btn.def.id]();
      }
      refreshhud();
    }
    if (!inlevel()) return;
    if (t.mode === "play") {
      let pausedrep = false;
      try {pausedrep = svar(inlevel(), "paused").getAsBoolean()} catch (er) {}
      if (!pausedrep) {e.preventDefault(); e.stopImmediatePropagation(); return}
      if (t.swallowup) {t.swallowup = false; e.preventDefault(); e.stopImmediatePropagation()}
      return;
    }
    if (t.swallowup) {
      t.swallowup = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("keydown", function(e) {
    if (e.code === "Space") {t.physjump.space = true; if (t.awaitrespawn) t.bufjump.space = true}
    if (e.code === "ArrowUp") {t.physjump.up = true; if (t.awaitrespawn) t.bufjump.up = true}
    if (!inlevel()) return;
    if (t.countdown) {
      if (e.code === "Escape") {
        t.countdown = null;
        try {if (t.counttext) t.counttext.hide()} catch (err) {}
        t.fadein = performance.now();
        refreshhud();
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (t.mode === "play") {
      if (e.code === "Escape") {t.requestpause = true; e.preventDefault(); e.stopImmediatePropagation(); return}
      if (e.code === "F12" || (e.ctrlKey && e.shiftKey && (e.code === "KeyI" || e.code === "KeyJ" || e.code === "KeyC"))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // abort key for video exports
    if (t.vidblock || t.vidphase === "render") {
      if (e.code === "Escape") endplayback("recording stopped");
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Comma" && t.frameadv) {
      actions.stepb();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Period" && t.frameadv) {
      actions.stepf();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Tab" && t.hotkey && !e.repeat) {
      t.uivisible = !t.uivisible;
      refreshhud();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // practice mode blocks the quick restart
    if (e.code === "KeyT" && t.practice) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("keyup", function(e) {
    if (e.code === "Space") t.physjump.space = false;
    if (e.code === "ArrowUp") t.physjump.up = false;
    if (!inlevel()) return;
    if (t.mode === "play" || t.countdown) {e.preventDefault(); e.stopImmediatePropagation(); return}
    if (e.code === "KeyT" && t.practice) {e.preventDefault(); e.stopImmediatePropagation()}
  }, true);
}

