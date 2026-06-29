const scene = runtimeScene;
const vars = scene.getVariables();
const S = (window.__geosettingsio = window.__geosettingsio || {});

/*//////////////////////////////////////////////////////////////////////*/

if (S.owner !== scene) {
  S.owner = scene;
  S.pending = null;
  try {
    if (gdjs.evtTools.storage.elementExistsInJSONFile("trigonometrydash", "settings")) {
      gdjs.evtTools.storage.readStringFromJSONFile("trigonometrydash", "settings", scene, vars.get("settingsTemp"));
      gdjs.evtTools.network.jsonToVariableStructure(vars.get("settingsTemp").getAsString(), vars.get("settings"));
    } else {
      vars.get("settings").getChild("timer").setBoolean(true);
      vars.get("settings").getChild("portalindicator").setBoolean(true);
      if (gdjs.evtTools.systemInfo.hasTouchScreen(scene)) vars.get("settings").getChild("mobile").setBoolean(true);
      gdjs.evtTools.storage.writeStringInJSONFile("trigonometrydash", "settings",
        gdjs.evtTools.network.variableStructureToJSON(vars.get("settings")));
    }
  } catch (e) {console.warn("settings load failed", e)}
}

/*//////////////////////////////////////////////////////////////////////*/

const released = gdjs.evtTools.input.isMouseButtonReleased(scene, "Left");
const cx = gdjs.evtTools.input.getCursorX(scene, "", 0);
const cy = gdjs.evtTools.input.getCursorY(scene, "", 0);

if (released) {
  for (const b of scene.getObjects("button") || []) {
    if (b.isHidden()) continue;
    if (cx < b.getAABBLeft() || cx > b.getAABBRight() || cy < b.getAABBTop() || cy > b.getAABBBottom()) continue;
    let label = "";
    try {label = b.getVariables().get("text").getAsString()} catch (e) {}
    if (label === "Export Save File") {
      const d = new Date();
      const pad = n => (n < 10 ? "0" : "") + n;
      const fname = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".tgd_save";
      const data = window.localStorage.getItem("GDJS_trigonometrydash") || "{}";
      try {gdjs.evtsExt__UDTFwTGD__DownloadTextFile.func(scene, fname, data, undefined)}
      catch (e) {
        try {const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], {type: "text/plain"})); a.download = fname; a.click()} catch (e2) {}
      }
    } else if (label === "Import Save File") {
      let ok = false;
      try {ok = window.confirm("This will wipe your current save file, make sure you save it first!")} catch (e) {}
      if (ok) {try {gdjs.evtsExt__UDTFwTGD__UploadTextFile.func(scene, vars.get("importedData"), null)} catch (e) {}}
    }
  }
  // cycle options (e.g. compress-export 0/8/15/30): click advances to the next value.
  // gate on a REAL cycle var via has() - get() auto-creates a "0" that read as truthy
  for (const sw of scene.getObjects("settingsSwitch") || []) {
    if (sw.isHidden() || !sw.getVariables().has("cycle")) continue;
    const cyc = sw.getVariables().get("cycle").getAsString();
    if (cyc.indexOf(",") < 0) continue;
    if (cx < sw.getAABBLeft() || cx > sw.getAABBRight() || cy < sw.getAABBTop() || cy > sw.getAABBBottom()) continue;
    const vals = cyc.split(",").map(Number);
    let id = ""; try {id = sw.getVariables().get("id").getAsString()} catch (e) {}
    let cur = 0; try {cur = vars.get("settings").getChild(id).getAsNumber()} catch (e) {}
    let idx = vals.indexOf(cur); if (idx < 0) idx = 0;
    try {vars.get("settings").getChild(id).setNumber(vals[(idx + 1) % vals.length])} catch (e) {}
    try {gdjs.evtTools.storage.writeStringInJSONFile("trigonometrydash", "settings", gdjs.evtTools.network.variableStructureToJSON(vars.get("settings")))} catch (e) {}
  }
}

// cycle-switch fill: animation 0 Off / 2 = 8MB(1of3) / 3 = 15MB(2of3) / 1 = 30MB(full),
// plus the value appended to its row label (only this switch - gated by has("cycle"))
const CYCANIM = {"0": 0, "8": 2, "15": 3, "30": 1};
for (const sw of scene.getObjects("settingsSwitch") || []) {
  if (sw.isHidden() || !sw.getVariables().has("cycle")) continue;
  let id = "", base = "", cur = 0;
  try {id = sw.getVariables().get("id").getAsString()} catch (e) {}
  try {base = sw.getVariables().get("name").getAsString()} catch (e) {}
  try {cur = vars.get("settings").getChild(id).getAsNumber()} catch (e) {}
  const ai = CYCANIM[String(cur)];
  try {sw.getBehavior("Animation").setAnimationIndex(ai != null ? ai : 0)} catch (e) {try {sw.setAnimationIndex(ai != null ? ai : 0)} catch (e2) {}}
  const label = base + " (" + (cur > 0 ? cur + " MB" : "Off") + ")";
  const swcy = (sw.getAABBTop() + sw.getAABBBottom()) / 2;
  for (const nm of scene.getObjects("settingsName") || []) {
    if (nm.isHidden() || Math.abs((nm.getAABBTop() + nm.getAABBBottom()) / 2 - swcy) > 8) continue;
    try {nm.getBehavior("Text").setText(label)} catch (e) {try {nm.setText(label)} catch (e2) {}}
  }
}

const imported = vars.get("importedData").getAsString();
if (imported !== "0" && imported !== "") {
  try {window.localStorage.setItem("GDJS_trigonometrydash", imported)} catch (e) {}
  vars.get("importedData").setString("0");
  try {
    const tr = (scene.getObjects("transition") || [])[0];
    if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Forward", 0, null);
  } catch (e) {}
  S.pending = performance.now() + 200;
}
if (S.pending && performance.now() >= S.pending) {
  S.pending = null;
  gdjs.evtTools.runtimeScene.replaceScene(scene, "mainmenu", true);
}
