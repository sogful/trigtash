const s = (window.__geosettings = window.__geosettings || {});
const scene = runtimeScene;
const vars = scene.getVariables();
const game = scene.getGame();

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const first = n => {const l = scene.getObjects(n); return l && l.length ? l[0] : null};
const all = n => (scene.getObjects(n) || []).slice();
const v = (obj, name) => obj.getVariables().get(name);
const dt = scene.getTimeManager().getElapsedTime() / 1000;

const cursorx = gdjs.evtTools.input.getCursorX(scene, "", 0);
const cursory = gdjs.evtTools.input.getCursorY(scene, "", 0);
const hovered = o => !o.isHidden() &&
  cursorx >= o.getAABBLeft() && cursorx <= o.getAABBRight() &&
  cursory >= o.getAABBTop() && cursory <= o.getAABBBottom();
const released = gdjs.evtTools.input.isMouseButtonReleased(scene, "Left");

const settings = vars.get("settings");
const savesettings = () => {
  try {
    gdjs.evtTools.storage.writeStringInJSONFile("trigonometrydash", "settings",
      gdjs.evtTools.network.variableStructureToJSON(settings));
  } catch (e) {console.warn("settings save failed", e)}
};

/*//////////////////////////////////////////////////////////////////////*/

if (s.owner !== scene) {
  s.owner = scene;
  s.pairs = [];
  s.buttons = [];
  s.pending = null;

  if (!gdjs.evtTools.storage.elementExistsInJSONFile("trigonometrydash", "settings")) {
    settings.getChild("timer").setBoolean(true);
    settings.getChild("portalindicator").setBoolean(true);
    if (gdjs.evtTools.systemInfo.hasTouchScreen(scene)) settings.getChild("mobile").setBoolean(true);
    savesettings();
  }

  for (const tab of all("settingsSelect")) {
    tab.setText(v(tab, "text").getAsString());
    tab.setX(513 + 80 * v(tab, "index").getAsNumber() - tab.getWidth() / 2);
    tab.setY(48);
  }

  const sel = game.getVariables().get("settingsSel");
  if (sel.getChild("width").getAsNumber() === 0) {
    const tab0 = all("settingsSelect").find(t => v(t, "index").getAsNumber() === 0);
    if (tab0) {
      sel.getChild("index").setNumber(0);
      sel.getChild("x").setNumber(tab0.getX());
      sel.getChild("width").setNumber(tab0.getWidth());
    }
  }
  const under = first("settingsSelectUnderline");
  if (under) {
    under.setPosition(sel.getChild("x").getAsNumber(), 58);
    under.setWidth(Math.max(1, sel.getChild("width").getAsNumber()));
    under.setHeight(1);
  }

  for (const sw of all("settingsSwitch")) {
    const pos = sw.getVariables().has("pos") ? v(sw, "pos").getAsNumber() : 0;
    sw.setX(476);
    sw.setY(76 + pos * 20);
    const name = scene.createObject("settingsName");
    if (!name) continue;
    name.setLayer(sw.getLayer());
    name.setZOrder(53);
    name.setText(v(sw, "name").getAsString());
    v(name, "selectIndex").setNumber(v(sw, "selectIndex").getAsNumber());
    name.setPosition(sw.getAABBRight() + 5, sw.getAABBCenterY() - name.getHeight() / 2);
    s.pairs.push({sw: sw, name: name});
  }

  for (const b of all("button")) {
    const t = scene.createObject("buttonText");
    if (!t) continue;
    t.setLayer(b.getLayer());
    t.setZOrder(66);
    t.setText(v(b, "text").getAsString());
    v(t, "pos").setNumber(v(b, "pos").getAsNumber());
    v(t, "selectIndex").setNumber(v(b, "selectIndex").getAsNumber());
    const w = t.getWidth() + 16;
    b.setWidth(w);
    b.setX(620 - t.getWidth() / 2);
    b.setY(68 + v(b, "pos").getAsNumber() * 20);
    v(b, "ogX").setNumber(b.getX()); v(b, "ogY").setNumber(b.getY());
    v(b, "ogWidth").setNumber(w); v(b, "ogHeight").setNumber(b.getHeight());
    t.setPosition(b.getCenterXInScene() - t.getWidth() / 2, b.getY() + 4);
    s.buttons.push({b: b, t: t});
  }
}

/*//////////////////////////////////////////////////////////////////////*/

const sel = game.getVariables().get("settingsSel");
const selindex = () => sel.getChild("index").getAsNumber();

for (const tab of all("settingsSelect")) {
  if (released && hovered(tab)) {
    sel.getChild("index").setNumber(v(tab, "index").getAsNumber());
    sel.getChild("x").setNumber(tab.getX());
    sel.getChild("width").setNumber(tab.getWidth());
  }
}

const under = first("settingsSelectUnderline");
if (under) {
  under.setX(lerp(under.getX(), sel.getChild("x").getAsNumber(), dt * 10));
  under.setWidth(Math.max(1, lerp(under.getWidth(), sel.getChild("width").getAsNumber(), dt * 10)));
  under.setHeight(1);
  under.setY(58);
}

const desc = first("settingsDesc");
let anyhover = false;
for (const p of s.pairs) {
  const visible = v(p.sw, "selectIndex").getAsNumber() === selindex();
  p.sw.hide(!visible);
  p.name.hide(!visible);
  if (!visible) {p.sw.setScale(lerp(p.sw.getScale(), 1, dt * 20)); continue}
  const id = v(p.sw, "id").getAsString();
  if (settings.hasChild && !settings.hasChild(id)) settings.getChild(id).setBoolean(false);
  p.sw.setAnimationIndex(settings.getChild(id).getAsBoolean() ? 1 : 0);
  if (hovered(p.sw) || hovered(p.name)) {
    anyhover = true;
    p.sw.setScale(lerp(p.sw.getScale(), 1.2, dt * 20));
    if (desc) {
      desc.setText(v(p.sw, "description").getAsString());
      desc.hide(false);
      desc.setX(648 - desc.getWidth() / 2);
    }
    if (released) {
      const ch = settings.getChild(id);
      ch.setBoolean(!ch.getAsBoolean());
      savesettings();
    }
  } else {
    p.sw.setScale(lerp(p.sw.getScale(), 1, dt * 20));
  }
}
if (desc && !anyhover) desc.hide();

for (const q of s.buttons) {
  const visible = v(q.b, "selectIndex").getAsNumber() === selindex();
  q.b.hide(!visible);
  q.t.hide(!visible);
  if (!visible) continue;
  const ogw = v(q.b, "ogWidth").getAsNumber();
  const target = hovered(q.b) ? ogw + 2 : ogw;
  q.b.setWidth(lerp(q.b.getWidth(), target, dt * 20));
  q.b.setX(v(q.b, "ogX").getAsNumber() - (q.b.getWidth() - ogw) / 2);
  q.t.setPosition(q.b.getCenterXInScene() - q.t.getWidth() / 2, q.b.getY() + 4);
  if (released && hovered(q.b)) dispatch(v(q.b, "text").getAsString());
}

function paintandgo(target) {
  try {
    const tr = first("transition");
    if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Forward", 0, null);
  } catch (e) {}
  s.pending = {at: performance.now() + 200, scene: target};
}

function dispatch(label) {
  if (label === "Edit Mobile Controls") paintandgo("mobilecontrols");
  if (label === "Export Save File") {
    const d = new Date();
    const pad = n => (n < 10 ? "0" : "") + n;
    const fname = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".tgd_save";
    const data = window.localStorage.getItem("GDJS_trigonometrydash") || "{}";
    try {
      gdjs.evtsExt__UDTFwTGD__DownloadTextFile.func(scene, fname, data, undefined);
    } catch (e) {
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([data], {type: "text/plain"}));
        a.download = fname;
        a.click();
      } catch (e2) {console.warn("export failed", e2)}
    }
  }
  if (label === "Import Save File") {
    let ok = false;
    try {ok = window.confirm("This will wipe your current save file, make sure you save it first!")} catch (e) {}
    if (ok) {
      try {
        gdjs.evtsExt__UDTFwTGD__UploadTextFile.func(scene, vars.get("importedData"), null);
      } catch (e) {console.warn("import failed", e)}
    }
  }
}

const imported = vars.get("importedData").getAsString();
if (imported !== "0" && imported !== "") {
  try {window.localStorage.setItem("GDJS_trigonometrydash", imported)} catch (e) {}
  vars.get("importedData").setString("0");
  paintandgo("mainmenu");
}

if (s.pending && performance.now() >= s.pending.at) {
  const target = s.pending.scene;
  s.pending = null;
  gdjs.evtTools.runtimeScene.replaceScene(scene, target, true);
}
