const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const marker = "map pack data (tas)";

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const mp = proj.layouts.find(l => l.name === "mappack");

/*////////////////////////////////////////////////////////////////////*/

const reslist = proj.resources.resources;
if (!reslist.some(r => r.name === "mappacks.json")) {
  reslist.push({disablePreload: false, file: "mappacks.json", kind: "json",
    metadata: "", name: "mappacks.json", userAdded: true});
  console.log("registered mappacks.json resource");
} else {
  console.log("mappacks.json resource already present");
}

let removedLoad = 0;
(function countAndStrip(list) {
  for (const e of list || []) {
    if (e.actions) {
      const before = e.actions.length;
      e.actions = e.actions.filter(a => !(a.type.value === "JSONResourceLoader::LoadJSONToScene" &&
        (a.parameters || [])[1] === "mappacks.json"));
      removedLoad += before - e.actions.length;
    }
    if (e.events) countAndStrip(e.events);
  }
})(mp.events);
console.log("neutralised mappacks.json async loads: " + removedLoad);

function removeByName(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === marker) list.splice(i, 1);
    else if (list[i].events) removeByName(list[i].events);
  }
}
removeByName(mp.events);

const code = fs.readFileSync(path.join(__dirname, "runtime.js"), "utf8").split(/\r?\n/);
mp.events.unshift({
  colorB: 74, colorG: 228, colorR: 176, creationTime: 0, folded: true,
  name: marker, source: "", type: "BuiltinCommonInstructions::Group", parameters: [],
  events: [{
    type: "BuiltinCommonInstructions::JsCode",
    inlineCode: code,
    parameterObjects: "",
    useStrict: true,
    eventsSheetExpanded: false
  }]
});

let back = 0;
function walk(list) {
  for (const e of list || []) {
    for (const a of e.actions || []) {
      if (a.type.value === "Scene") {
        const i = (a.parameters || []).indexOf("\"creator\"");
        if (i !== -1) {a.parameters[i] = "\"portal\""; back++}
      }
    }
    if (e.events) walk(e.events);
  }
}
walk(mp.events);

const PAGE_EXPR = "(Variable(targetc)-216)/304";
function fixCompare(conds, op, rhs) {
  for (const c of conds || []) {
    if (c.type.value === "BuiltinCommonInstructions::CompareNumbers" &&
      (c.parameters || [])[0] === PAGE_EXPR) {
      c.parameters = [PAGE_EXPR, op, rhs];
    }
    if (c.type.value === "BuiltinCommonInstructions::Not") fixCompare(c.conditions, op, rhs);
  }
}
let pageFix = 0;
function walkPage(list) {
  for (const e of list || []) {
    for (const a of e.actions || []) {
      if (a.type.value !== "EffectCapability::EffectBehavior::EnableEffect") continue;
      const obj = (a.parameters || [])[0];
      if (obj === "pageScrollRight") {fixCompare(e.conditions, ">=", "Variable(am)-1"); pageFix++}
      else if (obj === "pageScrollLeft") {fixCompare(e.conditions, "<=", "0"); pageFix++}
    }
    if (e.events) walkPage(e.events);
  }
}
walkPage(mp.events);
console.log("page-arrow grey-out events fixed: " + pageFix);

fs.writeFileSync(projfile, JSON.stringify(proj, null, 2));
console.log("mappack data layer injected (" + code.length + " lines); back creator->portal: " + back);
