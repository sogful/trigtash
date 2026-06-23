const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const GJ = root + "/project/Geomangle.json";

const FORCE = 318;
const YELLOWTINT = "\"249;255;104\"";
const BLACKTINT = "\"68;51;77\"";

const p = JSON.parse(fs.readFileSync(GJ, "utf8"));
const lvl = p.layouts.find(l => l.name === "level");
if (!lvl) {console.error("no level layout"); process.exit(1)}

const isCollNP = c => (c.type && c.type.value) === "CollisionNP";
const isYellowAct = e => (e.conditions || []).some(c => isCollNP(c) && (c.parameters || [])[1] === "yelloworb") &&
  (e.actions || []).some(a => (a.type && a.type.value) === "Create" && (a.parameters || [])[1] === "pulse");
const isBlackAct = e => (e.conditions || []).some(c => isCollNP(c) && (c.parameters || [])[1] === "blackorb");

function removeClones(evs) {
  if (!Array.isArray(evs)) return;
  for (let i = evs.length - 1; i >= 0; i--) {
    if (isBlackAct(evs[i])) {evs.splice(i, 1); continue}
    if (evs[i].events) removeClones(evs[i].events);
  }
}
removeClones(lvl.events);

const flipForce = expr => expr.replace(/^(-?)(\d+(?:\.\d+)?)\*/, (m, sign) => (sign === "-" ? "" : "-") + FORCE + "*");

function transform(node) {
  if (Array.isArray(node)) {node.forEach(transform); return}
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.parameters)) {
    node.parameters = node.parameters.map(pr =>
      typeof pr === "string" ? pr.split("yelloworb").join("blackorb").split(YELLOWTINT).join(BLACKTINT) : pr);
  }
  const tv = node.type && node.type.value;
  if ((tv === "Physics2::LinearVelocityX" || tv === "Physics2::LinearVelocityY") && node.parameters && node.parameters[3]) {
    node.parameters[3] = flipForce(node.parameters[3]);
  }
  for (const k in node) if (k !== "type" && typeof node[k] === "object") transform(node[k]);
}

let made = 0;
function inject(evs) {
  if (!Array.isArray(evs)) return;
  for (const e of evs) if (e.events) inject(e.events);
  for (let i = evs.length - 1; i >= 0; i--) {
    if (!isYellowAct(evs[i])) continue;
    const clone = JSON.parse(JSON.stringify(evs[i]));
    transform(clone);
    evs.splice(i + 1, 0, clone);
    made++;
  }
}
inject(lvl.events);

fs.writeFileSync(GJ, JSON.stringify(p, null, 2));
