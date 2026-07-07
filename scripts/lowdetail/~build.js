// implements the "Layout Mode" setting (settings.layoutmode). folder kept as lowdetail/
// for the build.bat reinject list; the feature is a bare-collision performance mode.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const GJ = root + "/project/Geomangle.json";
const marker = "layout mode (tas)";
const oldmarkers = ["low detail (tas)"];

const proj = JSON.parse(fs.readFileSync(GJ, "utf8"));
const lv = proj.layouts.find(l => l.name === "level");
if (!lv) {console.error("no level layout"); process.exit(1)}

/*//////////////////////////////////////////////////////////////////////*/

// (1) wire the "nospin" setting onto the per-frame object-spin event (a UI stub nothing
// read). rotation is cosmetic (saw/orb collision shapes are circular).
const nospinCond = () => ({type: {value: "SceneVariableAsBoolean"}, parameters: ["settings.nospin", "False"]});
const isSpinAct = a => a.type && a.type.value === "SetAngle" && (a.parameters || [])[0] === "tile" &&
  /Variable\(spin\)/.test((a.parameters || [])[2] || "");
const hasNospin = e => (e.conditions || []).some(c => /settings\.nospin/.test(((c.parameters || [])[0]) || ""));
let spinWired = 0;
function wireSpin(evs) {
  for (const e of evs || []) {
    if ((e.actions || []).some(isSpinAct) && !hasNospin(e)) {e.conditions = e.conditions || []; e.conditions.push(nospinCond()); spinWired++}
    if (e.events) wireSpin(e.events);
  }
}
wireSpin(lv.events);

/*//////////////////////////////////////////////////////////////////////*/

// build the type lists Layout Mode needs.
const grp = {};
for (const g of lv.objectsGroups || []) grp[g.name] = new Set((g.objects || []).map(o => o.name));
const has = (gname, n) => (grp[gname] || new Set()).has(n);
const objNames = new Set((lv.objects || []).map(o => o.name));
const objByName = {};
for (const o of lv.objects || []) objByName[o.name] = o;
const physOf = {};
for (const o of lv.objects || []) {const b = (o.behaviors || []).find(x => /Physics2/.test(x.type)); physOf[o.name] = b || null;}
const isText = {};
for (const o of lv.objects || []) isText[o.name] = /Text/.test(o.type);

// broad "referenced anywhere in native events" scan so triggers / gameplay objects stay.
const used = new Set();
(function scan(evs) {
  for (const e of evs || []) {
    for (const ins of [...(e.conditions || []), ...(e.actions || [])])
      for (const pr of ins.parameters || []) {
        if (typeof pr !== "string") continue;
        for (const tok of pr.split(/[^A-Za-z0-9_]+/)) if (tok && objNames.has(tok)) used.add(tok);
      }
    if (e.events) scan(e.events);
  }
})(lv.events);

const decoSrc = fs.readFileSync(path.join(root, "scripts/leveldeco/leveldeco.js"), "utf8");
const extractArr = name => {const m = decoSrc.match(new RegExp("const " + name + "\\s*=\\s*(\\[[\\s\\S]*?\\]);")); return m ? JSON.parse(m[1].replace(/'/g, "\"").replace(/,\s*\]/g, "]")) : [];};
const forceDecor = [...extractArr("DECO1"), ...extractArr("DECO2")].filter(n => objNames.has(n) &&
  !has("jumpOn", n) && !has("kill", n) && !physOf[n]);

const keepGroups = ["jumpOn", "kill", "player", "indicated", "backgrounds",
  "physicsExceptions", "physicsObjects", "ghost", "clickable", "portal"];
const REMOVE = new Set();
for (const o of lv.objects || []) {
  const n = o.name;
  if (!has("tile", n)) continue;
  if (keepGroups.some(g => has(g, n))) continue;
  if (physOf[n] || used.has(n) || isText[n]) continue;
  REMOVE.add(n);
}
for (const n of forceDecor) REMOVE.add(n);
if (objNames.has("tiledrectangle")) REMOVE.add("tiledrectangle");
const REMOVELIST = [...REMOVE];

const bp = physOf["block"];
const boxSquare = [], STATICPHYS = [];
for (const o of lv.objects || []) {
  const b = physOf[o.name];
  if (!b || (b.bodyType || "Static") !== "Static") continue;
  STATICPHYS.push(o.name);
  if (has("jumpOn", o.name) && b.shape === "Box" && b.shapeDimensionA === b.shapeDimensionB &&
    !has("ghost", o.name) && !has("physicsExceptions", o.name) && (!bp || b.density === bp.density))
    boxSquare.push({name: o.name, dim: b.shapeDimensionA});
}
const dimCount = {};
for (const b of boxSquare) dimCount[b.dim] = (dimCount[b.dim] || 0) + 1;
let DIM = 0, bestDim = 0;
for (const d in dimCount) if (dimCount[d] > bestDim) {bestDim = dimCount[d]; DIM = +d;}
const FULLBLOCK = boxSquare.filter(b => b.dim === DIM).map(b => b.name);
const samePhys = n => {const b = physOf[n]; return bp && b && b.friction === bp.friction && b.restitution === bp.restitution && b.density === bp.density && b.linearDamping === bp.linearDamping;};
const UNIFY = FULLBLOCK.filter(n => n !== "block" && samePhys(n));
let BLOCKIMG = "";
try {BLOCKIMG = objByName["block"].animations[0].directions[0].sprites[0].image} catch (e) {}

/*//////////////////////////////////////////////////////////////////////*/

const codeStr = `
const scene = runtimeScene;
let lm = false, s = null;
try {s = scene.getVariables().get("settings"); lm = s.getChild("layoutmode").getAsBoolean()} catch (e) {}
if (lm) {
  try {s.getChild("disableparticles").setBoolean(true)} catch (e) {}
  try {s.getChild("nospin").setBoolean(true)} catch (e) {}
  const REMOVE = ${JSON.stringify(REMOVELIST)};
  for (const name of REMOVE) {const l = scene.getObjects(name); if (l) {for (const o of l) o.deleteFromScene(scene);}}
  const FULLBLOCK = ${JSON.stringify(FULLBLOCK)};
  const W = (window.__layout = window.__layout || {});
  if (W.scene !== scene) {W.scene = scene; W.done = false; W.stable = 0; W.last = -1;}
  if (!W.done) {
    let cnt = 0;
    for (const name of FULLBLOCK) {const l = scene.getObjects(name); if (l) cnt += l.length;}
    if (cnt === W.last) W.stable++; else {W.stable = 0; W.last = cnt;}
    if (cnt > 0 && W.stable >= 5) {
      W.done = true;
      const blocks = [];
      for (const name of FULLBLOCK) {const l = scene.getObjects(name); if (!l) continue; for (const o of l) blocks.push({o: o, w: o.getWidth(), h: o.getHeight(), x: o.getCenterXInScene(), y: o.getCenterYInScene()});}
      const step = vals => {
        const u = [...new Set(vals.map(v => Math.round(v)))].sort((a, b) => a - b), g = {};
        for (let i = 1; i < u.length; i++) {const d = u[i] - u[i - 1]; if (d > 0 && d <= 64) g[d] = (g[d] || 0) + 1;}
        let best = 0, S = 0; for (const d in g) if (g[d] > best) {best = g[d]; S = +d;} return S;
      };
      const S = step(blocks.map(b => b.x)) || step(blocks.map(b => b.y)) || 0;
      let removed = 0;
      if (S > 0) {
        const H = 8, cells = new Map();
        for (const b of blocks) {const k = Math.round(b.x / H) + "," + Math.round(b.y / H); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(b);}
        const tol = S * 0.4, rad = Math.ceil(tol / H) + 1;
        const near = (x, y) => {
          const cx = Math.round(x / H), cy = Math.round(y / H);
          for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) {const a = cells.get((cx + dx) + "," + (cy + dy)); if (a) for (const b of a) if (Math.abs(b.x - x) <= tol && Math.abs(b.y - y) <= tol) return true;}
          return false;
        };
        for (const b of blocks) if (near(b.x - S, b.y) && near(b.x + S, b.y) && near(b.x, b.y - S) && near(b.x, b.y + S)) {b.o.deleteFromScene(scene); b.dead = true; removed++;}
      }
      let retex = 0;
      const UNIFY = new Set(${JSON.stringify(UNIFY)});
      let tex = null;
      try {const bl = scene.getObjects("block"); if (bl && bl.length) {const r = bl[0].getRendererObject(); if (r && r.texture) tex = r.texture;}} catch (e) {}
      if (!tex) {try {tex = scene.getGame().getImageManager().getPIXITexture("${BLOCKIMG.replace(/\\/g, "\\\\")}")} catch (e) {}}
      if (tex) for (const b of blocks) {if (b.dead || !UNIFY.has(b.o.getName())) continue; try {const r = b.o.getRendererObject(); if (r && "texture" in r) {r.texture = tex; retex++}} catch (e) {}}
      try {console.log("[layout] step=" + S + " fullBlocks=" + blocks.length + " interiorRemoved=" + removed + " retextured=" + retex)} catch (e) {}
    }
  }
  const CULL = ${JSON.stringify(STATICPHYS)};
  const PLAYERS = ["cube", "ship", "ball", "ufo", "wave", "oldufo", "icon"];
  let px = null;
  for (const pn of PLAYERS) {const l = scene.getObjects(pn); if (l) {for (const o of l) {if (!o.isHidden()) {px = o.getX(); break}}} if (px !== null) break;}
  if (px === null) {try {px = gdjs.evtTools.camera.getCameraX(scene, "", 0)} catch (e) {}}
  if (px !== null) {
    let visW = 480;
    try {const z = gdjs.evtTools.camera.getCameraZoom(scene, "", 0) || 1; visW = scene.getGame().getGameResolutionWidth() / z} catch (e) {}
    const half = visW * 1.5, far = half * 1.2;
    for (const name of CULL) {
      const list = scene.getObjects(name); if (!list) continue;
      for (const o of list) {
        if (o.getWidth() > 1000) continue;
        const d = Math.abs(o.getX() - px), on = o.behaviorActivated("Physics2");
        try {if (on && d > far) o.activateBehavior("Physics2", false); else if (!on && d <= half) o.activateBehavior("Physics2", true)} catch (e) {}
      }
    }
  }
}`;
const code = codeStr.split("\n");

/*//////////////////////////////////////////////////////////////////////*/

function removeByName(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === marker || oldmarkers.includes(list[i].name)) list.splice(i, 1);
    else if (list[i].events) removeByName(list[i].events);
  }
}
removeByName(lv.events);
lv.events.push({colorB: 74, colorG: 228, colorR: 176, creationTime: 0, folded: true,
  name: marker, source: "", type: "BuiltinCommonInstructions::Group", parameters: [],
  events: [{type: "BuiltinCommonInstructions::JsCode", inlineCode: code, parameterObjects: "", useStrict: true, eventsSheetExpanded: false}]});

/*//////////////////////////////////////////////////////////////////////*/

const vmarker = "vignette hide (tas)";
let hideAct = null;
(function findHide(evs) {for (const e of evs || []) {for (const a of e.actions || []) if (a.type && a.type.value === "Cache" && (a.parameters || [])[0] === "vignette") hideAct = a; if (e.events) findHide(e.events);}})(lv.events);
function removeVig(list) {for (let i = list.length - 1; i >= 0; i--) {if (list[i].name === vmarker) list.splice(i, 1); else if (list[i].events) removeVig(list[i].events);}}
removeVig(lv.events);
let vig = 0;
if (hideAct) {
  lv.events.push({colorB: 74, colorG: 228, colorR: 176, creationTime: 0, folded: true, name: vmarker, source: "",
    type: "BuiltinCommonInstructions::Group", parameters: [], events: [
      {type: "BuiltinCommonInstructions::Standard",
        conditions: [{type: {value: "SceneVariableAsBoolean"}, parameters: ["settings.hidemmvignette", "True"]}],
        actions: [JSON.parse(JSON.stringify(hideAct))], events: []}
    ]});
  vig = 1;
}

fs.writeFileSync(GJ, JSON.stringify(proj, null, 2));
console.log("layout mode: nospin " + spinWired + "; remove " + REMOVELIST.length + " (force-decor " + forceDecor.length + "); fullblock " + FULLBLOCK.length + " dim=" + DIM + "; unify " + UNIFY.length + "; static-phys " + STATICPHYS.length + "; vignette " + vig);
