const scene = runtimeScene;
const G = scene.getGame().getVariables();
const P = (window.__rated = window.__rated || {});

// i hope yalls firebase is set up properly
const KEY = "AIzaSyDW-WtdoFxgkx6IC9z6ZqKIo-9yTZ5ILWE";
const URL = "https://firestore.googleapis.com/v1/projects/tgd-reborn/databases/(default)/documents/rated?key=" + KEY + "&pageSize=300";

const RATE = {
  na: 0, auto: 360, easy: 336, normal: 312, medium: 288, hard: 264, harder: 240,
  veryhard: 216, tough: 192, insane: 168, extreme: 144, easydemon: 120,
  mediumdemon: 96, demon: 72, harddemon: 72, insanedemon: 48, extremedemon: 24
};

const create = n => {try {return scene.createObject(n)} catch (e) {return null}};
const first = n => {const l = scene.getObjects(n); return l && l.length ? l[0] : null};
const released = gdjs.evtTools.input.isMouseButtonReleased(scene, "Left");
const settext = (o, t) => {try {o.getBehavior("Text").setText(t)} catch (e) {try {o.setText(t)} catch (e2) {}}};
const tint = (o, c) => {try {o.setTint(c)} catch (e) {}};
const zord = (o, z) => {try {o.setZOrder(z)} catch (e) {}};
const hov = o => {
  if (!o || o.isHidden()) return false;
  const ly = o.getLayer();
  const mx = gdjs.evtTools.input.getCursorX(scene, ly, 0);
  const my = gdjs.evtTools.input.getCursorY(scene, ly, 0);
  return mx >= o.getAABBLeft() && mx <= o.getAABBRight() && my >= o.getAABBTop() && my <= o.getAABBBottom();
};
const fmtName = s => (("" + s).length > 21 ? ("" + s).substring(0, 18) + "..." : "" + s);

function rateselect() {try {const r = G.get("rateselect").getAsNumber(); return r === 2 ? 2 : 1} catch (e) {return 1}}

function fetchList() {
  P.docs = null;
  P.error = "";
  try {
    fetch(URL).then(r => r.json()).then(j => {
      const g = (f, k) => {
        const c = f[k];
        if (!c) return "";
        if (c.stringValue != null) return c.stringValue;
        if (c.integerValue != null) return c.integerValue;
        if (c.doubleValue != null) return "" + c.doubleValue;
        return "";
      };
      const docs = (j.documents || []).map(d => {
        const f = d.fields || {};
        return {name: g(f, "name"), author: g(f, "author"), diff: g(f, "diff"),
          rate: parseInt(g(f, "rate") || "1", 10), rateDate: parseFloat(g(f, "rateDate") || "0"), lvl: g(f, "lvl")};
      });
      docs.sort((a, b) => b.rateDate - a.rateDate);
      P.docs = docs;
    }).catch(e => {P.docs = []; P.error = "offline"});
  } catch (e) {P.docs = []; P.error = "offline"}
}

function clearRows() {
  for (const r of P.rows || []) for (const o of r.objs) {try {o.deleteFromScene(scene)} catch (e) {}}
  P.rows = [];
  P.built = false;
  P.scroll = 120;
}

/*//////////////////////////////////////////////////////////////////////*/

if (P.owner !== scene) {
  P.owner = scene;
  P.rows = [];
  P.built = false;
  P.scroll = 120;
  P.pending = null;
  try {if (!G.has("rateselect") || G.get("rateselect").getAsNumber() === 0) G.get("rateselect").setNumber(1)} catch (e) {}
  P.lastSel = rateselect();
  try {const sl = first("featuredSlider"); if (sl) sl.SetValue(P.lastSel, null)} catch (e) {}
  fetchList();
  try {
    const tt = first("titles");
    if (tt) {
      tt.setXOffset(0); tt.setYOffset(138);
      tt.getBehavior("Resizable").setWidth(64);
      tt.getBehavior("Resizable").setHeight(20);
      tt.setX(216 - 64 / 2);
    }
  } catch (e) {}
  try {const tr = first("transition"); if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Backward", 0, null)} catch (e) {}
}

P.tphase = (P.tphase || 0) + gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(scene) * 60;
try {const tt = first("titles"); if (tt) {tt.setAngle(Math.cos(gdjs.toRad(P.tphase)) * 3); tt.setX(216 - tt.getWidth() / 2)}} catch (e) {}

const nv = first("nerdview");
if (nv) {
  const msg = P.docs == null ? "Loading rated levels..." : (P.error ? "Could not reach the server :-(" : "");
  settext(nv, msg);
  if (msg) {try {nv.setX(216 - nv.getWidth() / 2)} catch (e) {}}
}

/*//////////////////////////////////////////////////////////////////////*/

if (P.docs && !P.built) {
  P.built = true;
  const sel = rateselect();
  const list = P.docs.filter(d => sel === 2 ? d.rate >= 2 : d.rate >= 1);
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const y = 52 + 44 * i;
    const row = {lvl: d.lvl, objs: []};

    const ml = create("maplevel");
    if (ml) {try {ml.setLayer("mappack")} catch (e) {} try {ml.setPosition(92, y)} catch (e) {} zord(ml, 2); row.bg = ml; row.objs.push(ml)}
    const bx = ml ? ml.getX() : 92;
    const base = ml ? ml.getY() : y;
    const rowH = ml ? ml.getHeight() : 40;

    const tName = create("title");
    if (tName) {try {tName.setLayer("mappack")} catch (e) {} try {tName.setPosition(126, base + 10)} catch (e) {} zord(tName, 4); settext(tName, fmtName(d.name)); row.objs.push(tName)}

    const tAuth = create("title");
    if (tAuth) {
      try {tAuth.setLayer("mappack")} catch (e) {}
      try {tAuth.setPosition(126, base + 21)} catch (e) {}
      zord(tAuth, 4);
      try {tAuth.setBitmapFontAndTextureAtlasResourceName("fonts\\garden.fnt", "fonts\\garden.png")} catch (e) {}
      settext(tAuth, "by " + d.author);
      tint(tAuth, "60;104;255");
      row.objs.push(tAuth);
    }

    const icon = create("mapPackLevelDifficulty");
    if (icon) {
      try {icon.setLayer("mappack")} catch (e) {}
      zord(icon, 3);
      const ry = RATE[("" + d.diff).toLowerCase().replace(/ /g, "")];
      try {icon.setYOffset(ry == null ? RATE.na : ry)} catch (e) {}
      try {icon.setXOffset(d.rate * 24)} catch (e) {}
      try {icon.getBehavior("Resizable").setWidth(24); icon.getBehavior("Resizable").setHeight(24)} catch (e) {}
      try {icon.setPosition((bx + 20) - icon.getWidth() / 2, base + rowH / 2 - icon.getHeight() / 2)} catch (e) {}
      row.objs.push(icon);
    }

    const play = create("playbutton");
    if (play) {try {play.setLayer("mappack")} catch (e) {} try {play.setPosition(308, base + 8)} catch (e) {} zord(play, 4); row.play = play; row.objs.push(play)}

    P.rows.push(row);
  }
}

/*//////////////////////////////////////////////////////////////////////*/

const dt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(scene);
if (gdjs.evtTools.input.isScrollingDown && gdjs.evtTools.input.isScrollingDown(scene)) P.scroll += 44;
if (gdjs.evtTools.input.isScrollingUp && gdjs.evtTools.input.isScrollingUp(scene)) P.scroll -= 44;
if (gdjs.evtTools.input.isKeyPressed(scene, "Down")) P.scroll += 360 * dt;
if (gdjs.evtTools.input.isKeyPressed(scene, "Up")) P.scroll -= 360 * dt;
const count = P.rows ? P.rows.length : 0;
P.scroll = Math.min(Math.max(P.scroll, 120), Math.max(120, 44 * count - 56));
try {gdjs.evtTools.camera.setCameraY(scene, P.scroll, "mappack", 0)} catch (e) {}

try {
  const sl = first("featuredSlider");
  if (sl) {
    const v = sl.Value(null);
    if (v != null && v !== P.lastSel) {
      P.lastSel = v;
      try {G.get("rateselect").setNumber(v)} catch (e) {}
      clearRows();
    }
  }
} catch (e) {}

for (const rt of scene.getObjects("ratetype") || []) {
  try {
    if (rt.getY() < 100) {rt.setXOffset(48); rt.setYOffset(0)}
    else {rt.setXOffset(0); rt.setYOffset(0)}
  } catch (e) {}
}

/*//////////////////////////////////////////////////////////////////////*/

if (P.pending && performance.now() >= P.pending.at) {
  const tgt = P.pending.scene;
  P.pending = null;
  gdjs.evtTools.runtimeScene.replaceScene(scene, tgt, true);
}

function paintGo(target) {
  try {const tr = first("transition"); if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Forward", 0, null)} catch (e) {}
  P.pending = {at: performance.now() + 200, scene: target};
}

/*//////////////////////////////////////////////////////////////////////*/

if (!P.pending && released) {
  const back = first("backbutton");
  const refresh = first("refresh");
  if (back && hov(back)) {
    paintGo("portal");
  } else if (refresh && hov(refresh)) {
    clearRows();
    fetchList();
  } else {
    for (const r of P.rows) {
      if (r.play && hov(r.play)) {
        try {G.get("level").setString(r.lvl)} catch (e) {}
        try {G.get("lvlFrom").setString("rated")} catch (e) {}
        paintGo("level");
        break;
      }
    }
  }
}
