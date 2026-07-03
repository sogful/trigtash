const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const marker = "macro system (tas)";
const oldmarkers = ["geo tas (injected)"];

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const level = proj.layouts.find(l => l.name === "level");

const newtextures = ["pauseUpload.png", "practice.png", "playleveltinier.png", "newLevel.png"];
const macrotextures = ["macroLeft.png", "macroright.png", "macroTime.png", "macroPractice.png",
  "macroPracticeDisable.png", "macroHitboxOn.png", "macroHitboxOff.png", "macroClapperboard.png",
  "macroClapperboardDisable.png", "macroStop.png", "macroDownload.png", "macroUpload.png"];

const stale = new Set(["macroleft.png", "macroright.png", "macroTime.png", "macroPractice.png",
  "macroHitboxOn.png", "macroHitboxOff.png", "macroRecord0.png", "macroRecord1.png"]
  .map(b => "assets\\textures\\system\\" + b));
proj.resources.resources = proj.resources.resources.filter(r => !stale.has(r.name));

const assetbase = {};
(function w(d) {for (const e of fs.readdirSync(d, {withFileTypes: true})) {const f = path.join(d, e.name); if (e.isDirectory()) w(f); else assetbase[e.name.toLowerCase()] = f.split(path.sep).join("/").slice((root + "/project/").length)}})(path.join(root, "project", "assets"));

const resnames = new Set(proj.resources.resources.map(r => r.name));
function regtex(base, sub) {
  const name = "assets\\textures\\system\\" + (sub ? "macro\\" : "") + base;
  const rel = assetbase[base.toLowerCase()];
  if (!rel) {
    console.error("texture file missing on disk: " + base);
    process.exit(1);
  }
  if (!resnames.has(name)) {
    proj.resources.resources.push({file: rel, kind: "image", metadata: "", name: name, smoothed: false, userAdded: true});
    resnames.add(name);
    console.log("registered resource " + name);
  }
}
for (const base of newtextures) regtex(base, false);
for (const base of macrotextures) regtex(base, true);

for (const [nm, base] of [["assets\\textures\\inputs.png", "inputs.png"], ["assets\\textures\\inputsheld.png", "inputsheld.png"]]) {
  const rel = assetbase[base.toLowerCase()];
  if (!rel) {console.error("input sheet missing on disk: " + base); process.exit(1)}
  if (!resnames.has(nm)) {
    proj.resources.resources.push({file: rel, kind: "image", metadata: "", name: nm, smoothed: false, userAdded: true});
    resnames.add(nm);
    console.log("registered resource " + nm + " -> " + rel);
  }
}

/*//////////////////////////////////////////////////////////////////////*/

const objnames = ["tasHud", "tasHelp", "tasbtn", "tasclose", "tasrec", "tasvideo", "tasplay",
  "tasplaytiny", "tasstepb", "tasstepf", "tastime", "tasarrow", "tasexport",
  "tasimport", "tashitbox", "tasdraw", "tasveldraw", "tasblack", "macroPractice", "practicepoint", "tasinput", "tasinputheld", "tascpicon"];

function removeinjected(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === marker || list[i].name === marker + " early" || oldmarkers.includes(list[i].name)) list.splice(i, 1);
    else if (list[i].events) removeinjected(list[i].events);
  }
}
removeinjected(level.events);
level.objects = level.objects.filter(o => !objnames.includes(o.name));
if (level.objectsFolderStructure && level.objectsFolderStructure.children) {
  level.objectsFolderStructure.children = level.objectsFolderStructure.children.filter(
    c => !objnames.includes(c.objectName));
}
level.instances = level.instances.filter(i => !objnames.includes(i.name));

function register(def) {
  level.objects.push(def);
  if (level.objectsFolderStructure) {
    level.objectsFolderStructure.children = level.objectsFolderStructure.children || [];
    level.objectsFolderStructure.children.push({objectName: def.name});
  }
}

/*//////////////////////////////////////////////////////////////////////*/

const texttemplate = level.objects.find(o => o.type === "BitmapText::BitmapTextObject" &&
  o.content && /visitor/.test(o.content.bitmapFontResourceName || ""));
if (!texttemplate) {console.error("no visitor-font bitmap text found in level to clone"); process.exit(1)}

for (const name of ["tasbtn"]) {
  const def = JSON.parse(JSON.stringify(texttemplate));
  def.name = name;
  def.variables = [];
  def.content.text = "";
  def.content.scale = 0.5;
  if ("tint" in def.content) def.content.tint = "255;255;255";
  register(def);
}

/*//////////////////////////////////////////////////////////////////////*/

const spritetemplate = level.objects.find(o => o.name === "pauseDownload" && o.type === "Sprite");
if (!spritetemplate) {console.error("pauseDownload sprite def not found in level"); process.exit(1)}

function makesprite(name, images) {
  const def = JSON.parse(JSON.stringify(spritetemplate));
  def.name = name;
  def.variables = [];
  const anim0 = def.animations[0];
  def.animations = images.map(img => {
    const a = JSON.parse(JSON.stringify(anim0));
    a.name = "";
    const sprite = a.directions[0].sprites[0];
    sprite.image = img;
    sprite.originPoint = {name: "origine", x: 0, y: 0};
    a.directions[0].sprites = [sprite];
    return a;
  });
  register(def);
}

const sys = n => "assets\\textures\\system\\" + n;
const mac = n => "assets\\textures\\system\\macro\\" + n;

makesprite("tasrec", [sys("newLevel.png"), mac("macroStop.png")]);
makesprite("tasvideo", [mac("macroClapperboard.png"), mac("macroClapperboardDisable.png")]);
makesprite("tasplay", [sys("playlevel1.png"), sys("playlevel0.png")]);
makesprite("tasplaytiny", [sys("playleveltinier.png")]);
makesprite("tasstepb", [mac("macroLeft.png")]);
makesprite("tasstepf", [mac("macroright.png")]);
makesprite("tastime", [mac("macroTime.png")]);
makesprite("tasarrow", [sys("arrowbutton12x12.png")]);
makesprite("tasexport", [mac("macroDownload.png")]);
makesprite("tasimport", [mac("macroUpload.png")]);
makesprite("macroPractice", [mac("macroPractice.png"), mac("macroPracticeDisable.png")]);
makesprite("practicepoint", [sys("practice.png")]);
makesprite("tashitbox", [mac("macroHitboxOff.png"), mac("macroHitboxOn.png")]);
makesprite("tascpicon", ["assets\\textures\\editor\\tiles\\checkpointInactive.png"]);

register({
  assetStoreId: "", height: 20, name: "tasinput", texture: "assets\\textures\\inputs.png",
  type: "TiledSpriteObject::TiledSprite", width: 20, variables: [], effects: [], behaviors: []
});
register({
  assetStoreId: "", height: 20, name: "tasinputheld", texture: "assets\\textures\\inputsheld.png",
  type: "TiledSpriteObject::TiledSprite", width: 20, variables: [], effects: [], behaviors: []
});

const drawertemplate = level.objects.find(o => o.name === "transition" && /Drawer/.test(o.type));
if (!drawertemplate) {console.error("no drawer object found in level to clone"); process.exit(1)}
const drawdef = JSON.parse(JSON.stringify(drawertemplate));
drawdef.name = "tasdraw";
drawdef.variables = [];
drawdef.behaviors = (drawdef.behaviors || []).filter(b => /Capability/.test(b.type));
if ("absoluteCoordinates" in drawdef) drawdef.absoluteCoordinates = true;
if (drawdef.content && "absoluteCoordinates" in drawdef.content) drawdef.content.absoluteCoordinates = true;
if ("clearBetweenFrames" in drawdef) drawdef.clearBetweenFrames = false;
if (drawdef.content && "clearBetweenFrames" in drawdef.content) drawdef.content.clearBetweenFrames = false;
register(drawdef);
const veldef = JSON.parse(JSON.stringify(drawdef));
veldef.name = "tasveldraw";
register(veldef);

const blackdef = JSON.parse(JSON.stringify(drawdef));
blackdef.name = "tasblack";
register(blackdef);
console.log("button + marker + drawer objects added");

/*//////////////////////////////////////////////////////////////////////*/

let uuidc = 0;
const uuid = () => "tas0000-0000-0000-0000-" + String(uuidc++).padStart(12, "0");
function place(name, x, y, layer, z) {
  level.instances.push({
    angle: 0, customSize: false, height: 0, keepRatio: true, layer: layer,
    name: name, persistentUuid: uuid(), width: 0, x: x, y: y, zOrder: z,
    numberProperties: [], stringProperties: [], initialVariables: []
  });
}
const row = ["tasrec", "tasplay", "tasstepb", "tasstepf", "tasarrow", "tastime", "tasarrow",
  "tashitbox", "tasexport", "tasimport"];
let rx = 232;
for (const n of row) {place(n, rx, 4, "ui", 10001); rx += 20}
place("tasvideo", 412, 32, "ui", 10001);
place("tasplaytiny", 412, 52, "ui", 10001);
place("macroPractice", 204, 168, "ui", 10001);
place("tasbtn", 300, 28, "ui", 10001);   // speed multiplier text
place("tasbtn", 200, 104, "ui", 10005);  // playback countdown text
place("tasbtn", 16, 140, "ui", 10005);   // video-record warning text
place("tasbtn", 4, 180, "ui", 10005);    // velocity readout text
place("tasbtn", 200, 200, "ui", 10005);  // macro-button hover tooltip
place("tasbtn", 200, 210, "ui", 10005);  // "(editing macro)" pause-to-edit indicator
place("tasbtn", 200, 220, "ui", 10005);  // "(press U to backtrack)" indicator
place("tascpicon", 186, 220, "ui", 10005);  // backtrack indicator checkpoint decoration
place("tasdraw", 0, 0, "", 9500);        // hitbox drawer
place("tasveldraw", 0, 0, "", 9501);     // velocity-vector drawer
place("tasblack", 0, 0, "ui", 10004);    // countdown black cover

place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinputheld", -9999, -9999, "ui", 10006);  // preload anchor (never shown/used)
console.log("placed " + (row.length + 16) + " overlay instances on the editor canvas");

/*//////////////////////////////////////////////////////////////////////*/

const groups = level.objectsGroups || [];
const killgroup = groups.find(g => g.name === "kill");
const tilegroup = groups.find(g => g.name === "tile");
const killnames = killgroup ? killgroup.objects.map(o => o.name) : [];
const coinnames = tilegroup ? tilegroup.objects.map(o => o.name).filter(n => /coin/i.test(n)) : [];

const physmap = {};
for (const o of level.objects) {
  const b = (o.behaviors || []).find(x => /Physics2::Physics2Behavior/.test(x.type));
  if (!b) continue;
  const num = v => (typeof v === "number" ? v : parseFloat(v) || 0);
  physmap[o.name] = {
    shape: b.shape || "Box",
    a: num(b.shapeDimensionA),
    b: num(b.shapeDimensionB),
    ox: num(b.shapeOffsetX),
    oy: num(b.shapeOffsetY)
  };
  if (b.shape === "Polygon" && Array.isArray(b.vertices) && b.vertices.length) {
    physmap[o.name].verts = b.vertices.map(v => [num(v.x), num(v.y)]);
    physmap[o.name].porigin = b.polygonOrigin || "TopLeft";
  }
  if (physmap[o.name].shape === "Box" && (!physmap[o.name].a || !physmap[o.name].b)) {
    delete physmap[o.name];
  }
}
console.log("baked " + killnames.length + " hazard names, " + coinnames.length + " collectible names, " + Object.keys(physmap).length + " physics shapes");

const chunks = fs.readdirSync(__dirname).filter(f => /^\d.*\.js$/.test(f)).sort();
let src = chunks.map(f => fs.readFileSync(path.join(__dirname, f), "utf8")).join("");
const greennames = level.objects.filter(o => /(orb|pad|portal)/i.test(o.name) &&
  !/(Overlay|flash|particle)/i.test(o.name)).map(o => o.name);
src = src.replace("/*__KILLNAMES__*/[]", JSON.stringify(killnames));
src = src.replace("/*__COINNAMES__*/[]", JSON.stringify(coinnames));
src = src.replace("/*__GREENNAMES__*/[]", JSON.stringify(greennames));
src = src.replace("/*__PHYSMAP__*/{}", JSON.stringify(physmap));
const buttontips = JSON.parse(fs.readFileSync(root + "/project/json/macrotips.json", "utf8"));
src = src.replace("/*__BUTTONTIPS__*/{}", JSON.stringify(buttontips));
const code = src.split(/\r?\n/);
level.events.push({
  type: "BuiltinCommonInstructions::Group",
  disabled: false,
  folded: true,
  colorR: 228, colorG: 176, colorB: 74,
  creationTime: 0,
  name: marker,
  source: "",
  events: [{
    type: "BuiltinCommonInstructions::JsCode",
    inlineCode: code,
    parameterObjects: "",
    useStrict: true,
    eventsSheetExpanded: false
  }]
});

let coinGate = 0;
function gateCoins(list) {
  for (const e of list || []) {
    const savesCoins = (e.actions || []).some(a => a.type.value === "ArrayTools::AppendAll" &&
      /savedata.*\.coins/.test(JSON.stringify(a.parameters || [])));
    if (savesCoins) {
      const conds = e.conditions || (e.conditions = []);
      if (!conds.some(c => c.type.value === "SceneVariableAsBoolean" && (c.parameters || [])[0] === "macroEnabled")) {
        conds.push({type: {value: "SceneVariableAsBoolean"}, parameters: ["macroEnabled", "False"]});
        coinGate++;
      }
    }
    if (e.events) gateCoins(e.events);
  }
}
gateCoins(level.events);
console.log("coin-save gated on macro-off: " + coinGate + " event(s)");
level.events.unshift({
  type: "BuiltinCommonInstructions::Group",
  disabled: false, folded: true,
  colorR: 228, colorG: 176, colorB: 74,
  creationTime: 0, name: marker + " early", source: "",
  events: [{
    type: "BuiltinCommonInstructions::JsCode",
    inlineCode: ["if (window.__tas && window.__tas.earlyrespawn) window.__tas.earlyrespawn(runtimeScene);"],
    parameterObjects: "", useStrict: true, eventsSheetExpanded: false
  }]
});

fs.writeFileSync(projfile, JSON.stringify(proj, null, 2));
console.log("tas system injected into level (" + code.length + " lines)");
