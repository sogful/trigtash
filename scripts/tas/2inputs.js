  /*////////////////////////////////////////////////////////////////////*/

  const inputnames = new Map(Object.entries(t.watch).map(([name, code]) => [code, name]));
  t.realkeys = {};
  for (const [name, code] of Object.entries(t.watch)) {
    if (input.isKeyPressed(code)) t.realkeys[name] = true;
  }
  t.realmouse = input.isMouseButtonPressed(0);
  t.realcursor = [input.getCursorX(), input.getCursorY()];
  t.realtouches = new Map();
  t.inputqueue = [];
  t.playtouches = new Map();

  function gameplaykey(name) {
    return name && name !== "u";
  }

  function queueinput(event) {
    if (t.mode !== "record" || !t.macro || !t.macro.inputonly || !inlevel()) return;
    const queue = t.inputqueue;
    const last = queue[queue.length - 1];
    if (event[0] === "mm" && last && last[0] === "mm") queue[queue.length - 1] = event;
    else queue.push(event);
  }

  realinput.onKeyPressed = function(code, location) {
    const name = inputnames.get(code);
    if (gameplaykey(name) && !t.realkeys[name]) {
      queueinput(["kd", name]);
      t.realkeys[name] = true;
    }
    input.onKeyPressed(code, location);
  };
  realinput.onKeyReleased = function(code, location) {
    const name = inputnames.get(code);
    if (gameplaykey(name) && t.realkeys[name]) {
      if (name !== "r" || !t.restoredretry) queueinput(["ku", name]);
      if (name === "r") t.restoredretry = false;
      delete t.realkeys[name];
    }
    input.onKeyReleased(code, location);
  };
  const clearpressed = ["releaseAllPressedKeys", "clearAllPressedKeys"];
  for (const method of clearpressed) {
    const original = realinput[method].bind(realinput);
    realinput[method] = function() {
      for (const name of Object.keys(t.realkeys)) {
        if (gameplaykey(name)) queueinput(["ku", name]);
      }
      t.realkeys = {};
      t.restoredretry = false;
      original();
    };
  }

  realinput.onMouseButtonPressed = function(button) {
    if (button === 0 && !t.realmouse) {
      queueinput(["md"]);
      t.realmouse = true;
    }
    input.onMouseButtonPressed(button);
  };
  realinput.onMouseButtonReleased = function(button) {
    if (button === 0) t.jumpclick = false;
    if (button === 0 && t.realmouse) {
      queueinput(["mu"]);
      t.realmouse = false;
    }
    input.onMouseButtonReleased(button);
  };
  realinput.onMouseMove = function(x, y, movement) {
    if (x !== t.realcursor[0] || y !== t.realcursor[1]) {
      queueinput(["mm", x, y]);
      t.realcursor = [x, y];
    }
    input.onMouseMove(x, y, movement);
  };

  realinput.onTouchStart = function(id, x, y) {
    if (t.mode === "play") return;
    queueinput(["td", id, x, y]);
    t.realtouches.set(id, [x, y]);
    input.onTouchStart(id, x, y);
  };
  realinput.onTouchMove = function(id, x, y) {
    if (t.mode === "play") return;
    if (t.realtouches.has(id)) {
      const last = t.realtouches.get(id);
      if (last[0] !== x || last[1] !== y) queueinput(["tm", id, x, y]);
      t.realtouches.set(id, [x, y]);
    }
    input.onTouchMove(id, x, y);
  };
  realinput.onTouchEnd = function(id) {
    if (t.mode === "play") return;
    if (t.realtouches.delete(id)) queueinput(["tu", id]);
    input.onTouchEnd(id);
  };
  realinput.onTouchCancel = realinput.onTouchEnd;

  window.addEventListener("blur", function() {
    if (t.mode === "play") return;
    realinput.releaseAllPressedKeys();
    if (t.realmouse) realinput.onMouseButtonReleased(0);
    for (const id of t.realtouches.keys()) realinput.onTouchEnd(id);
  });

  /*////////////////////////////////////////////////////////////////////*/

  function inputstate() {
    return {keys: {}, mouse: false, cursor: null, touches: new Map()};
  }

  function updateinput(state, event) {
    const [, action, control, x, y] = event;
    if (action === "kd") state.keys[control] = true;
    if (action === "ku") delete state.keys[control];
    if (action === "md") state.mouse = true;
    if (action === "mu") state.mouse = false;
    if (action === "mm") state.cursor = [control, x];
    if (action === "td" || action === "tm") state.touches.set(control, [x, y]);
    if (action === "tu") state.touches.delete(control);
  }

  function baselineinput() {
    const state = t.recinput;
    const events = [];
    for (const name of inputnames.values()) {
      const held = !!t.realkeys[name] && !(name === "r" && t.restoredretry);
      if (gameplaykey(name) && !!state.keys[name] !== held) {
        events.push([held ? "kd" : "ku", name]);
      }
    }
    if (state.mouse !== t.realmouse) events.push([t.realmouse ? "md" : "mu"]);
    const [x, y] = t.realcursor;
    if (!state.cursor || x !== state.cursor[0] || y !== state.cursor[1]) events.push(["mm", x, y]);
    for (const id of state.touches.keys()) {
      if (!t.realtouches.has(id)) events.push(["tu", id]);
    }
    for (const [id, coords] of t.realtouches) {
      const previous = state.touches.get(id);
      if (!previous) events.push(["td", id, ...coords]);
      else if (previous[0] !== coords[0] || previous[1] !== coords[1]) events.push(["tm", id, ...coords]);
    }
    return events;
  }

  function recordinputs() {
    const pending = t.recbaseline ? baselineinput() : t.inputqueue;
    for (const event of pending) {
      const entry = [t.frame, ...event];
      t.macro.events.push(entry);
      updateinput(t.recinput, entry);
    }
    t.inputqueue.length = 0;
    t.recbaseline = false;
    t.macro.length = t.frame + 1;
  }

  function rewindrecord(frame, instep) {
    t.frame = frame;
    const events = t.macro.events;
    while (events.length && events[events.length - 1][0] >= frame) events.pop();
    t.recinput = inputstate();
    for (const event of events) updateinput(t.recinput, event);
    t.macro.length = frame;
    if (t.macro.inputonly) {
      if (instep) {
        t.restoredretry = !!t.realkeys.r;
        t.recbaseline = true;
      } else {
        t.inputqueue = baselineinput();
        t.recbaseline = false;
      }
    } else {
      t.prevkeys = t.recinput.keys;
      t.prevmouse = t.recinput.mouse;
      t.prevcursor = t.recinput.cursor || [0, 0];
      t.macro.icon.length = Math.min(t.macro.icon.length, frame);
      for (const key of Object.keys(t.macro.worldsnaps || {})) {
        if (Number(key) > frame) delete t.macro.worldsnaps[key];
      }
    }
    if (instep) recordframe();
  }

  function seekinput(frame) {
    releaseall();
    const state = inputstate();
    t.playpos = 0;
    while (t.playpos < t.playm.events.length && t.playm.events[t.playpos][0] < frame) {
      updateinput(state, t.playm.events[t.playpos++]);
    }
    t.playkeys = state.keys;
    t.playmouse = state.mouse;
    t.playcursor = state.cursor;
    t.playtouches = state.touches;
    t.inputseek = true;
  }

  function playinputframe() {
    const state = {keys: t.playkeys, mouse: t.playmouse, cursor: t.playcursor, touches: t.playtouches};
    if (t.inputseek) {
      t.inputseek = false;
      if (state.cursor) input.onMouseMove(...state.cursor);
      for (const [name, code] of Object.entries(t.watch)) {
        if (gameplaykey(name) && !!state.keys[name] !== input.isKeyPressed(code)) {
          input[state.keys[name] ? "onKeyPressed" : "onKeyReleased"](code, 0);
        }
      }
      if (state.mouse) input.onMouseButtonPressed(0);
      for (const [id, coords] of state.touches) input.onTouchStart(id, ...coords);
    }
    while (t.playpos < t.playm.events.length && t.playm.events[t.playpos][0] === t.frame) {
      const event = t.playm.events[t.playpos++];
      const [, action, control, x, y] = event;
      updateinput(state, event);
      if ((action === "kd" || action === "ku") && gameplaykey(control) && Object.hasOwn(t.watch, control)) {
        input[action === "kd" ? "onKeyPressed" : "onKeyReleased"](t.watch[control], 0);
      }
      if (action === "md") input.onMouseButtonPressed(0);
      if (action === "mu") input.onMouseButtonReleased(0);
      if (action === "mm") input.onMouseMove(control, x);
      if (action === "td") input.onTouchStart(control, x, y);
      if (action === "tm") input.onTouchMove(control, x, y);
      if (action === "tu") input.onTouchEnd(control);
      if (action === "back") t.requestbacktrack = control || true;
    }
    t.playmouse = state.mouse;
    t.playcursor = state.cursor;
    bridgeclick(state.mouse && !ispaused(inlevel()) && !onpausebtn());
  }


