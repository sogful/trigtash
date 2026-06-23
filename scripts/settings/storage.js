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
