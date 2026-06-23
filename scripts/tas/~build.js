/*//////////////////////////////////////////////////////////////////////*/
// injects the tas/macro system into the level scene: registers button texture
// resources, adds sprite button + text objects, and a jscode event group. idempotent.
// the runtime source lives split across the digit-prefixed chunks in this folder;
// they concatenate (in name order) into the single injected blob.
/*//////////////////////////////////////////////////////////////////////*/

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const marker = "macro system (tas)";
const oldmarkers = ["geo tas (injected)"];

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const level = proj.layouts.find(l => l.name === "level");

/*//////////////////////////////////////////////////////////////////////*/
// texture resources (files exist on disk, entries may be missing)
/*//////////////////////////////////////////////////////////////////////*/

// non-macro overlay textures (under system/)
const newtextures = ["pauseUpload.png", "practice.png", "playleveltinier.png", "newLevel.png"];
// macro overlay sprites now live under system/macro/
const macrotextures = ["macroLeft.png", "macroright.png", "macroTime.png", "macroPractice.png",
  "macroPracticeDisable.png", "macroHitboxOn.png", "macroHitboxOff.png", "macroClapperboard.png",
  "macroClapperboardDisable.png", "macroStop.png", "macroDownload.png", "macroUpload.png"];

// prune stale entries from when macro sprites lived under system/ (+ abandoned record icons)
const stale = new Set(["macroleft.png", "macroright.png", "macroTime.png", "macroPractice.png",
  "macroHitboxOn.png", "macroHitboxOff.png", "macroRecord0.png", "macroRecord1.png"]
  .map(b => "assets\\textures\\system\\" + b));
proj.resources.resources = proj.resources.resources.filter(r => !stale.has(r.name));

// basename -> on-disk path (relative to project/), so registration resolves the real
// location regardless of folder reorgs instead of a hardcoded subdir.
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

// input-display sheets (60x40, a 3x2 grid of 20x20 cells: up/left/right keys): one idle
// sheet + one all-held. carved per-cell by the runtime via xoffset/yoffset.
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
// remove previous injection
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
// drop previously placed tas instances (rebuilt below)
level.instances = level.instances.filter(i => !objnames.includes(i.name));

function register(def) {
  level.objects.push(def);
  if (level.objectsFolderStructure) {
    level.objectsFolderStructure.children = level.objectsFolderStructure.children || [];
    level.objectsFolderStructure.children.push({objectName: def.name});
  }
}

/*//////////////////////////////////////////////////////////////////////*/
// text objects: clone an existing bitmap text def so the shape is valid
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
// sprite buttons: clone the pauseDownload def, swap textures, origin 0,0
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
// macro record button wears the plus icon; clapperboard moves to the video-capture
// button (records the canvas without the overlay ui)
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
// decoration beside the "(press U to backtrack)" hint: the checkpoint's own texture
makesprite("tascpicon", ["assets\\textures\\editor\\tiles\\checkpointInactive.png"]);

// input-display cell: a 20x20 tiled sprite the runtime clones 3x (up/left/right) and
// offsets into the inputs.png / inputsheld.png 3x2 sheet.
register({
  assetStoreId: "", height: 20, name: "tasinput", texture: "assets\\textures\\inputs.png",
  type: "TiledSpriteObject::TiledSprite", width: 20, variables: [], effects: [], behaviors: []
});
// preload anchor for inputsheld.png: only applied via setTexture, so without an object
// referencing it the scene never loads it (renders as the gd placeholder).
register({
  assetStoreId: "", height: 20, name: "tasinputheld", texture: "assets\\textures\\inputsheld.png",
  type: "TiledSpriteObject::TiledSprite", width: 20, variables: [], effects: [], behaviors: []
});

// hitbox drawer: clone the transition shape painter, absolute coords, manual clearing,
// no custom behaviors
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
// velocity-vector drawer: a second painter, independent of the hitbox drawer's clearing
const veldef = JSON.parse(JSON.stringify(drawdef));
veldef.name = "tasveldraw";
register(veldef);

// full-screen black cover for the playback countdown: fades in behind it to hide the
// reset flash, fades out as the replay's first frame shows. same drawer, ui layer, top.
const blackdef = JSON.parse(JSON.stringify(drawdef));
blackdef.name = "tasblack";
register(blackdef);
console.log("button + marker + drawer objects added");

/*//////////////////////////////////////////////////////////////////////*/
// place real instances of every overlay object so they show on the editor canvas (modders
// can restyle them). the js lays them out + drags them at runtime, so these are just editor
// defaults. instance order matters for repeated objects (tasarrow x2, tasbtn x2): the
// runtime grabs them in scene order.
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
// top-right row (editor preview; runtime relays them out)
const row = ["tasplay", "tasstepb", "tasstepf", "tasarrow", "tastime", "tasarrow",
  "tashitbox", "tasexport", "tasimport"];
let rx = 232;
for (const n of row) {place(n, rx, 4, "ui", 10001); rx += 20}
// video (records the replay) + plain playback, under the import button
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
// input-display cells (up/left/right/down). off-screen; the runtime relays + textures them
// per held key, so no editor-canvas flash. order = getObjects order.
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinput", -9999, -9999, "ui", 10006);
place("tasinputheld", -9999, -9999, "ui", 10006);  // preload anchor (never shown/used)
console.log("placed " + (row.length + 16) + " overlay instances on the editor canvas");

/*//////////////////////////////////////////////////////////////////////*/
// inject the jscode event
/*//////////////////////////////////////////////////////////////////////*/

// bake hazard/collectible name lists from the level's object groups
const groups = level.objectsGroups || [];
const killgroup = groups.find(g => g.name === "kill");
const tilegroup = groups.find(g => g.name === "tile");
const killnames = killgroup ? killgroup.objects.map(o => o.name) : [];
const coinnames = tilegroup ? tilegroup.objects.map(o => o.name).filter(n => /coin/i.test(n)) : [];

// bake the Physics2 fixture shape of every level object that has one, so the hitbox
// overlay can draw the true gameplay collision shape
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
  // slopes are Polygon fixtures: keep the vertices (object-local, from TopLeft) so the
  // overlay draws the triangle, not a box
  if (b.shape === "Polygon" && Array.isArray(b.vertices) && b.vertices.length) {
    physmap[o.name].verts = b.vertices.map(v => [num(v.x), num(v.y)]);
    physmap[o.name].porigin = b.polygonOrigin || "TopLeft";
  }
  // a Box with zero dimensions falls back to the sprite size in gdevelop; drop it
  // (the overlay approximates from the default frame size instead)
  if (physmap[o.name].shape === "Box" && (!physmap[o.name].a || !physmap[o.name].b)) {
    delete physmap[o.name];
  }
}
console.log("baked " + killnames.length + " hazard names, " + coinnames.length + " collectible names, " + Object.keys(physmap).length + " physics shapes");

// reassemble the runtime from its ordered chunks (the digit-prefixed .js next to this script)
const chunks = fs.readdirSync(__dirname).filter(f => /^\d.*\.js$/.test(f)).sort();
let src = chunks.map(f => fs.readFileSync(path.join(__dirname, f), "utf8")).join("");
// interactive non-hazard objects (orbs/pads/portals) get a green hitbox
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

// gate the coin-state save-on-reset off while the macro overlay is enabled
// (clean macro attempts shouldn't persist coin state)
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

// early-respawn hook at the TOP of the sheet so it runs before the game's collision/death
// events (the main group runs at the end). enforces the checkpoint pose for the first
// frames of a practice respawn.
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
