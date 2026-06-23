const scene = runtimeScene;
const v = scene.getVariables();

const valid = s => /^\d+;\d+;\d+$/.test(s);
const tint = (names, color) => {
  if (!valid(color)) return;
  for (const n of names) {
    for (const o of (scene.getObjects(n) || [])) {try {o.setColor(color)} catch (e) {}}
  }
};

let deco1 = "", deco2 = "";
try {
  const li = v.get("loadedLevel").getChild("levelInfo");
  deco1 = li.getChild("deco1").getAsString();
  deco2 = li.getChild("deco2").getAsString();
} catch (e) {}

const DECO1 = ["baselesschain", "bigburstspinner", "bigcogspinner", "bigcrossspinner",
  "bigfanspinner", "bigflowerspinner", "bigoctospinner", "bigstarspinner", "burstspinner",
  "chain", "cogspinner", "crossspinner", "crystals", "fanspinner", "flowerspinner",
  "groundthorn", "helix", "octospinner", "shortgroundthorn", "smallburstspinner",
  "smallchain", "smallcogspinner", "smallcrossspinner", "smallflowerspinner", "smallhelix",
  "smalloctospinner", "smallstarspinner", "starspinner", "tallgroundthorn"];
const DECO2 = ["arrow", "chevronarrow", "clouds", "cross", "diamondstar", "exclamationmark",
  "groundrectangles", "heart", "note", "questionmark", "sharpy", "sharpycorner",
  "squareclouds", "squarewirecenter", "squarewirecorner", "squarewireend", "squarewireline",
  "squarewiresole", "squarewiretee", "star", "swiggly", "swigglycorner", "triangle"];

const P = (window.__leveldeco = window.__leveldeco || {});
if (P.owner !== scene) {P.owner = scene; P.d1 = null; P.d2 = null}
if (deco1 !== P.d1 || deco2 !== P.d2) {
  P.d1 = deco1; P.d2 = deco2;
  tint(DECO1, deco1);
  tint(DECO2, deco2);
}
