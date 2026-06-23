const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const groupname = "portal menu (tas)";
const oldnames = ["portal menu", "geo portal (injected)"];

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const portal = proj.layouts.find(l => l.name === "portal");
const mm = proj.layouts.find(l => l.name === "mainmenu");

/*//////////////////////////////////////////////////////////////////////*/

const cond = (value, parameters, inverted) =>
  ({type: inverted ? {inverted: true, value} : {value}, parameters});
const act = (value, parameters) => ({type: {value}, parameters});
const std = (conditions, actions, events) =>
  ({folded: false, type: "BuiltinCommonInstructions::Standard", conditions, actions, events: events || []});

const hover = (obj, inv) => cond("SourisSurObjet", [obj, "", "", ""], inv);
const clicked = () => cond("MouseButtonReleased", ["", "Left"]);
const once = () => cond("BuiltinCommonInstructions::Once", []);

const scaleTo = (obj, to) => [
  act("ChangeScaleWidth", [obj, "=", "lerp(" + obj + ".ScaleX()," + to + ",0.5)"]),
  act("ChangeScaleHeight", [obj, "=", "lerp(" + obj + ".ScaleY()," + to + ",0.5)"])
];
const setHelp = expr => act("BitmapText::BitmapTextObject::SetText", ["help", "=", expr]);
const paint = dir => act("FlashTransitionPainter::FlashTransitionPainter::PaintEffect",
  ["transition", "FlashTransitionPainter", "\"0;0;0\"", "0.2", "\"Circular\"", "\"" + dir + "\"", "", ""]);
const gotoScene = name => act("Scene", ["", "\"" + name + "\"", "yes"]);

/*//////////////////////////////////////////////////////////////////////*/

const events = [];

events.push(std([once()], [
  act("TiledSpriteObject::YOffset", ["titles", "=", "158"]),
  act("ResizableCapability::ResizableBehavior::SetWidth", ["titles", "Resizable", "=", "72"]),
  act("ResizableCapability::ResizableBehavior::SetHeight", ["titles", "Resizable", "=", "20"]),
  paint("Backward")
]));

events.push(std([], [
  act("ModVarObjet", ["titles", "phase", "+", "1*TimeDelta()*60"]),
  act("SetAngle", ["titles", "=", "cos(ToRad(titles.Variable(phase)))*3"]),
  act("MettreX", ["titles", "=", "216 - titles.Width()/2"]),
  act("TiledSpriteObject::XOffset", ["bgglint", "+", "TimeDelta()*40"]),
  setHelp("\"\"")
]));

const enabled = [
  {obj: "creator", scene: "creator"},
  {obj: "mappacks2", scene: "mappack"},
  {obj: "demonlist2", scene: "demonlist"},
  {obj: "featured", scene: "rated"}
];
for (const b of enabled) {
  events.push(std([hover(b.obj, false)], scaleTo(b.obj, "1.2").concat([setHelp(b.obj + ".Variable(helpMsg)")])));
  events.push(std([hover(b.obj, true)], scaleTo(b.obj, "1")));
  events.push(std([hover(b.obj, false), clicked()], [paint("Forward"), act("Wait", ["0.2"]), gotoScene(b.scene)]));
}

events.push(std([hover("backbutton", false)], scaleTo("backbutton", "1.2")));
events.push(std([hover("backbutton", true)], scaleTo("backbutton", "1")));
events.push(std([hover("backbutton", false), clicked()], [paint("Forward"), act("Wait", ["0.2"]), gotoScene("mainmenu")]));
events.push(std([], [act("MettreX", ["help", "=", "216 - help.Width()/2"])]));

/*//////////////////////////////////////////////////////////////////////*/

function removeByName(list, name) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === name) list.splice(i, 1);
    else if (list[i].events) removeByName(list[i].events, name);
  }
}
removeByName(portal.events, groupname);
for (const n of oldnames) removeByName(portal.events, n);

portal.events.push({
  colorB: 228, colorG: 74, colorR: 176, creationTime: 0, folded: true,
  name: groupname, source: "", type: "BuiltinCommonInstructions::Group",
  events: events, parameters: []
});
console.log("portal menu authored as " + events.length + " event blocks");

/*//////////////////////////////////////////////////////////////////////*/

let rerouted = 0, already = 0;
function walk(list) {
  for (const ev of list) {
    for (const a of ev.actions || []) {
      if (a.type.value !== "Scene") continue;
      const i = a.parameters.indexOf("\"creator\"");
      if (i !== -1) {a.parameters[i] = "\"portal\""; rerouted++}
      else if (a.parameters.some(p => /"portal"/.test(p))) already++;
    }
    if (ev.events) walk(ev.events);
  }
}
walk(mm.events);
if (rerouted === 0 && already > 0) console.log("mainmenu already routes to portal");
else if (rerouted === 1) console.log("mainmenu route changed: creator -> portal");
else {console.error("expected 1 creator route, found " + rerouted + "; aborting"); process.exit(1)}

fs.writeFileSync(projfile, JSON.stringify(proj, null, 2));
console.log("written");
