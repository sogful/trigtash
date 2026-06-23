const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GAMEDIR = (process.argv[2] || ROOT + "/build/game").split("\\").join("/");
const GJ = ROOT + "/project/Geomangle.json";

const fwd = s => (s || "").split("\\").join("/");

const proj = JSON.parse(fs.readFileSync(GJ, "utf8"));
const nameToPath = {};
for (const r of proj.resources.resources) {
  if (r.name && r.file) nameToPath[fwd(r.name)] = fwd(r.file);
}

/*////////////////////////////////////////////////////////////////////*/

const dataPath = path.join(GAMEDIR, "data.js");
let raw = fs.readFileSync(dataPath, "utf8");
const optIdx = raw.indexOf("gdjs.runtimeGameOptions");
const projPart = (optIdx >= 0 ? raw.slice(0, optIdx) : raw).trim();
const restPart = optIdx >= 0 ? raw.slice(optIdx) : "";
const pm = projPart.match(/^gdjs\.projectData\s*=\s*/);
if (!pm) {console.error("data.js not in expected form"); process.exit(1)}
const data = JSON.parse(projPart.slice(pm[0].length).replace(/;\s*$/, ""));

let placed = 0, already = 0, missing = 0;
const flatOriginals = new Set();
for (const r of data.resources.resources) {
  const target = nameToPath[fwd(r.name)];
  if (!target) {missing++; continue}
  if (fwd(r.file) === target) {already++; continue}
  const src = path.join(GAMEDIR, r.file);
  const dst = path.join(GAMEDIR, target);
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), {recursive: true});
      fs.copyFileSync(src, dst);
      if (!fwd(r.file).includes("/")) flatOriginals.add(src);
      placed++;
    } else if (fs.existsSync(dst)) {
      already++;
    } else {missing++; continue}
    r.file = target;
  } catch (e) {console.error("fail " + r.file + " -> " + target + ": " + e.message)}
}

let cmpMoved = 0;
let musicDir = null;
for (const r of data.resources.resources) {
  const f = fwd(r.file);
  if (f.endsWith(".ogg") && f.includes("/music/") && !/\/cmp_/.test(f)) {musicDir = path.dirname(path.join(GAMEDIR, f)); break}
}
if (musicDir) {
  try {fs.mkdirSync(musicDir, {recursive: true})} catch (e) {}
  for (const f of fs.readdirSync(GAMEDIR)) {
    if (/^cmp_.*\.ogg$/i.test(f)) {try {fs.renameSync(path.join(GAMEDIR, f), path.join(musicDir, f)); cmpMoved++} catch (e) {}}
  }
}

let removed = 0;
for (const f of flatOriginals) {try {if (fs.existsSync(f)) {fs.unlinkSync(f); removed++}} catch (e) {}}

fs.writeFileSync(dataPath, "gdjs.projectData = " + JSON.stringify(data) + ";\n" + restPart);
console.log("asset folders: " + placed + " placed, " + already + " already-structured, " + cmpMoved + " cmp_ moved, " + removed + " flat removed, " + missing + " unmapped");
