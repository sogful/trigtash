const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const projfile = root + "/project/Geomangle.json";
const marker = "decoration colour (tas)";

const proj = JSON.parse(fs.readFileSync(projfile, "utf8"));
const lv = proj.layouts.find(l => l.name === "level");

/*////////////////////////////////////////////////////////////////////*/

function removeByName(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === marker) list.splice(i, 1);
    else if (list[i].events) removeByName(list[i].events);
  }
}
removeByName(lv.events);

const code = fs.readFileSync(path.join(__dirname, "leveldeco.js"), "utf8").split(/\r?\n/);
lv.events.push({
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

fs.writeFileSync(projfile, JSON.stringify(proj, null, 2));
console.log("decoration colour tint injected (" + code.length + " lines)");
