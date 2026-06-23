const scene = runtimeScene;
const P = (window.__mappack = window.__mappack || {});

const META = [
  {name: "Beginner Pack", diff: "easy", id: 0, num: 3, frontColor: "60;104;255", backColor: "99;162;255"},
  {name: "UFO Pack", diff: "hard", id: 1, num: 3, frontColor: "255;152;47", backColor: "255;208;47"},
  {name: "Intermediate Pack", diff: "hard", id: 2, num: 3, frontColor: "255;152;47", backColor: "255;208;47"}
];

// i hope yalls firebase is configured correctly v2
const KEY = "AIzaSyDW-WtdoFxgkx6IC9z6ZqKIo-9yTZ5ILWE";
const URL = "https://firestore.googleapis.com/v1/projects/tgd-reborn/databases/(default)/documents/mappacks?key=" + KEY + "&pageSize=100";

/*////////////////////////////////////////////////////////////////////*/

function makeLevelstore(byId) {
  for (const id in byId) {
    const ls = scene.createObject("levelstore");
    if (!ls) continue;
    try {ls.hide(true)} catch (e) {}
    try {ls.getVariables().get("id").setNumber(parseInt(id, 10))} catch (e) {}
    const lvls = byId[id] || [];
    for (let k = 0; k < lvls.length; k++) {
      try {ls.getVariables().get("level").getChild(k).setString(lvls[k])} catch (e) {}
    }
  }
}

if (P.owner !== scene) {
  P.owner = scene;
  P.created = false;

  try {gdjs.evtTools.network.jsonToVariableStructure(JSON.stringify(META), scene.getGame().getVariables().get("mappacks"))} catch (e) {}

  let cache = null;
  try {
    if (gdjs.evtTools.storage.elementExistsInJSONFile("trigonometrydash", "mappackLevels2")) {
      gdjs.evtTools.storage.readStringFromJSONFile("trigonometrydash", "mappackLevels2", scene, scene.getVariables().get("__mpc"));
      cache = JSON.parse(scene.getVariables().get("__mpc").getAsString());
    }
  } catch (e) {}
  if (cache) {makeLevelstore(cache); P.created = true}
  try {
    fetch(URL).then(r => r.json()).then(j => {
      const byId = {};
      (j.documents || []).forEach(d => {
        const f = d.fields || {};
        const id = parseInt((f.id && (f.id.integerValue || f.id.doubleValue)) || "0", 10);
        const data = (f.data && f.data.arrayValue && f.data.arrayValue.values) || [];
        byId[id] = data.map(v => {
          const mf = (v.mapValue && v.mapValue.fields) || {};
          let lvlStr = (mf.lvl && mf.lvl.stringValue) || "";
          const author = (mf.author && mf.author.stringValue) || "";
          const diff = (mf.diff && mf.diff.stringValue) || "";
          try {
            const obj = JSON.parse(lvlStr);
            if (!obj.author && author) obj.author = author;
            if (!obj.difficulty && diff) obj.difficulty = diff;
            lvlStr = JSON.stringify(obj);
          } catch (e) {}
          return lvlStr;
        });
      });
      try {gdjs.evtTools.storage.writeStringInJSONFile("trigonometrydash", "mappackLevels2", JSON.stringify(byId))} catch (e) {}
      if (!P.created) {P.pendingReload = true}
    }).catch(e => {});
  } catch (e) {}
}

if (P.pendingReload) {
  P.pendingReload = false;
  gdjs.evtTools.runtimeScene.replaceScene(scene, "mappack", true);
}

try {const nv = scene.getObjects("nerdview"); if (nv && nv[0]) nv[0].hide(true)} catch (e) {}
