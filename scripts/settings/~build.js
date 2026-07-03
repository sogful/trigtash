const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const marker = "settings storage (tas)";
const oldmarkers = ["geo settings (injected)"];

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const mm = proj.layouts.find(l => l.name === "mainmenu");

/*//////////////////////////////////////////////////////////////////////*/

function removeinjected(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === marker || oldmarkers.includes(list[i].name)) list.splice(i, 1);
    else if (list[i].events) removeinjected(list[i].events);
  }
}
removeinjected(mm.events);

/*//////////////////////////////////////////////////////////////////////*/

const settingsDef = JSON.parse(fs.readFileSync(root + "/project/json/settings.json", "utf8"));
const switchTpl = mm.instances.find(i => i.name === "settingsSwitch");
const tabTpl = mm.instances.find(i => i.name === "settingsSelect");
if (!switchTpl || !tabTpl) {console.error("no settingsSwitch/settingsSelect template instance found"); process.exit(1)}
const switchTplCopy = JSON.parse(JSON.stringify(switchTpl));
const tabTplCopy = JSON.parse(JSON.stringify(tabTpl));
mm.instances = mm.instances.filter(i => i.name !== "settingsSwitch" && i.name !== "settingsSelect" &&
  !(i.name === "button" && (i.initialVariables || []).some(v => v.name === "text" && v.value === "Edit Mobile Controls")));
let uuidn = 0;
const uuid = pfx => pfx + String(uuidn++).padStart(12, "0");
for (const tab of settingsDef.tabs) {
  const inst = JSON.parse(JSON.stringify(tabTplCopy));
  inst.x = 488 + 64 * tab.index; inst.y = 48; inst.persistentUuid = uuid("settab00-0000-0000-0000-");
  inst.initialVariables = [{folded: true, name: "text", type: "string", value: tab.name}];
  if (tab.index) inst.initialVariables.push({folded: true, name: "index", type: "number", value: tab.index});
  if (tab.xoff) inst.initialVariables.push({folded: true, name: "xoff", type: "number", value: tab.xoff});
  mm.instances.push(inst);
}
const posByTab = {};
const setvar = (inst, name, value, type) => {
  let v = (inst.initialVariables = inst.initialVariables || []).find(x => x.name === name);
  if (!v) {v = {folded: true, name, type: type || "number"}; inst.initialVariables.push(v)}
  v.value = value; v.type = type || v.type || "number";
};
for (const opt of settingsDef.options) {
  const pos = posByTab[opt.tab] = (posByTab[opt.tab] == null ? 0 : posByTab[opt.tab] + 1);
  if (opt.kind === "button") {
    const b = mm.instances.find(i => i.name === "button" && (i.initialVariables || []).some(v => v.name === "text" && v.value === opt.match));
    if (b) {setvar(b, "selectIndex", opt.tab); setvar(b, "pos", pos); b.y = 76 + pos * 20}
    else console.log("  WARN no settings button matching: " + opt.match);
    continue;
  }
  const inst = JSON.parse(JSON.stringify(switchTplCopy));
  inst.x = 476; inst.y = 76 + pos * 20; inst.persistentUuid = uuid("setsw000-0000-0000-0000-");
  inst.initialVariables = [
    {folded: true, name: "selectIndex", type: "number", value: opt.tab},
    {folded: true, name: "pos", type: "number", value: pos},
    {folded: true, name: "id", type: "string", value: opt.id},
    {folded: true, name: "name", type: "string", value: opt.name},
    {folded: true, name: "description", type: "string", value: opt.desc}
  ];
  if (opt.cycle) {
    inst.initialVariables.push({folded: true, name: "locked", type: "number", value: 1});
    inst.initialVariables.push({folded: true, name: "cycle", type: "string", value: opt.cycle.join(",")});
  }
  mm.instances.push(inst);
}
console.log("settings regenerated from settings.json: " + settingsDef.tabs.length + " tabs, " + settingsDef.options.length + " options");

{
  const desc = mm.instances.find(i => i.name === "settingsDesc");
  if (desc) {desc.customSize = true; desc.width = 330}
}

/*//////////////////////////////////////////////////////////////////////*/

const groupname = "settings menu (tas)";
function removeByName(list, name) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === name) list.splice(i, 1);
    else if (list[i].events) removeByName(list[i].events, name);
  }
}
removeByName(mm.events, groupname);
removeByName(mm.events, "settings menu");

const cond = (value, parameters, inverted) =>
  ({type: inverted ? {inverted: true, value} : {value}, parameters});
const act = (value, parameters) => ({type: {value}, parameters});
const std = (conditions, actions, events) =>
  ({folded: false, type: "BuiltinCommonInstructions::Standard", conditions, actions, events: events || []});
const forEach = (object, conditions, actions, events) =>
  ({folded: false, type: "BuiltinCommonInstructions::ForEach", object, conditions, actions, events: events || []});

const once = () => cond("BuiltinCommonInstructions::Once", []);
const hover = (obj, inv) => cond("SourisSurObjet", [obj, "", "", ""], inv);
const clicked = () => cond("MouseButtonReleased", ["", "Left"]);
const objSel = (obj, v, val) => cond("VarObjet", [obj, v, "=", val]);
const sceneVarIs = (expr, val) => cond("VarScene", [expr, "=", val]);
const scaleTo = (obj, to) => [
  act("ChangeScaleWidth", [obj, "=", "lerp(" + obj + ".ScaleX()," + to + ",0.5)"]),
  act("ChangeScaleHeight", [obj, "=", "lerp(" + obj + ".ScaleY()," + to + ",0.5)"])
];
const setText = (obj, expr) => act("TextContainerCapability::TextContainerBehavior::SetValue", [obj, "Text", "=", expr]);
const setAnim = (obj, idx) => act("AnimatableCapability::AnimatableBehavior::SetIndex", [obj, "Animation", "=", idx]);
const show = obj => act("Montre", [obj, ""]);
const hide = obj => act("Cache", [obj]);
const writeSettings = () => act("EcrireFichierTxt", ["\"trigonometrydash\"", "\"settings\"", "ToJSON(settings)"]);

const events = [];

events.push(std([cond("KeyReleased", ["", "Escape"]), cond("SceneVariableAsBoolean", ["settingsPage", "True"])],
  [act("SetSceneVariableAsBoolean", ["settingsPage", "False"])]));

events.push(std([once()], [act("ModVarScene", ["curTab", "=", "0"])], [
  forEach("settingsSwitch", [], [
    act("MettreXY", ["settingsSwitch", "=", "476", "=", "76 + settingsSwitch.Variable(pos)*20"]),
    act("Create", ["settingsName", "settingsName", "0", "0", ""]),
    setText("settingsName", "settingsSwitch.VariableString(name)"),
    act("ModVarObjetTxt", ["settingsName", "desc", "=", "settingsSwitch.VariableString(description)"]),
    act("ModVarObjet", ["settingsName", "selectIndex", "=", "settingsSwitch.Variable(selectIndex)"]),
    act("MettreXY", ["settingsName", "=", "settingsSwitch.BoundingBoxRight()+5", "=", "settingsSwitch.BoundingBoxCenterY()-settingsName.Height()/2"])
  ]),
  forEach("settingsSelect", [], [
    setText("settingsSelect", "settingsSelect.VariableString(text)"),
    act("MettreXY", ["settingsSelect", "=", "513 + 64*settingsSelect.Variable(index) + settingsSelect.Variable(xoff) - settingsSelect.Width()/2", "=", "48"])
  ]),
  forEach("button", [], [
    act("Create", ["buttonText", "buttonText", "0", "0", ""]),
    setText("buttonText", "button.VariableString(text)"),
    act("ModVarObjet", ["buttonText", "pos", "=", "button.Variable(pos)"]),
    act("ModVarObjet", ["buttonText", "selectIndex", "=", "button.Variable(selectIndex)"]),
    act("ResizableCapability::ResizableBehavior::SetWidth", ["button", "Resizable", "=", "buttonText.Width()+16"]),
    act("MettreXY", ["button", "=", "620 - buttonText.Width()/2", "=", "68 + button.Variable(pos)*20"]),
    act("MettreXY", ["buttonText", "=", "button.BoundingBoxCenterX()-buttonText.Width()/2", "=", "button.Y()+4"])
  ])
]));

events.push(std([hover("settingsSelect", false), clicked()],
  [act("ModVarScene", ["curTab", "=", "settingsSelect.Variable(index)"])]));

events.push(std([objSel("settingsSelect", "index", "Variable(curTab)")], [
  act("MettreX", ["settingsSelectUnderline", "=", "lerp(settingsSelectUnderline.X(),settingsSelect.X(),0.3)"]),
  act("MettreY", ["settingsSelectUnderline", "=", "58"]),
  act("ResizableCapability::ResizableBehavior::SetWidth", ["settingsSelectUnderline", "Resizable", "=", "lerp(settingsSelectUnderline.Width(),settingsSelect.Width(),0.3)"])
]));

for (const obj of ["settingsSwitch", "settingsName", "button", "buttonText"]) {
  events.push(std([cond("VarObjet", [obj, "selectIndex", "=", "Variable(curTab)"])], [show(obj)]));
  events.push(std([cond("VarObjet", [obj, "selectIndex", "=", "Variable(curTab)"], true)], [hide(obj)]));
}

events.push(std([hover("settingsSwitch", false), objSel("settingsSwitch", "selectIndex", "Variable(curTab)")],
  scaleTo("settingsSwitch", "1.2").concat([
    setText("settingsDesc", "settingsSwitch.VariableString(description)"),
    show("settingsDesc")
  ])));
events.push(std([hover("settingsSwitch", true)], scaleTo("settingsSwitch", "1").concat([hide("settingsDesc")])));
events.push(std([hover("settingsName", false), objSel("settingsName", "selectIndex", "Variable(curTab)")],
  [setText("settingsDesc", "settingsName.VariableString(desc)"), show("settingsDesc")]));

events.push(std([hover("settingsSwitch", false), objSel("settingsSwitch", "selectIndex", "Variable(curTab)"), clicked(), cond("VarObjet", ["settingsSwitch", "locked", "=", "1"], true)],
  [act("ToggleSceneVariableAsBoolean", ["settings[settingsSwitch.VariableString(id)]"]), writeSettings()]));

events.push(forEach("settingsSwitch", [], [], [
  std([sceneVarIs("settings[settingsSwitch.VariableString(id)]", "1")], [setAnim("settingsSwitch", "1")]),
  std([sceneVarIs("settings[settingsSwitch.VariableString(id)]", "0")], [setAnim("settingsSwitch", "0")])
]));

events.push(std([], [act("MettreXY", ["settingsDesc", "=", "628 - settingsDesc.Width()/2", "=", "216 - settingsDesc.Height()"])]));

events.push(std([hover("button", false), objSel("button", "selectIndex", "Variable(curTab)")], scaleTo("button", "1.1")));
events.push(std([hover("button", true)], scaleTo("button", "1")));

mm.events.push({
  colorB: 228, colorG: 176, colorR: 74, creationTime: 0, folded: true,
  name: groupname, source: "", type: "BuiltinCommonInstructions::Group",
  events: events, parameters: []
});
console.log("settings menu authored as " + events.length + " event blocks");

const helper = fs.readFileSync(path.join(__dirname, "storage.js"), "utf8").split(/\r?\n/);
mm.events.push({
  colorB: 228, colorG: 176, colorR: 74, creationTime: 0, folded: true,
  name: marker, source: "", type: "BuiltinCommonInstructions::Group", parameters: [],
  events: [{
    type: "BuiltinCommonInstructions::JsCode",
    inlineCode: helper,
    parameterObjects: "",
    useStrict: true,
    eventsSheetExpanded: false
  }]
});

fs.writeFileSync(projfile, JSON.stringify(proj, null, 2));
console.log("settings storage helper injected (" + helper.length + " lines)");
