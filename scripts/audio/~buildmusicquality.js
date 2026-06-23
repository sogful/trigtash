const fs = require("fs");
const path = require("path");
const GJ = path.join(__dirname, "..", "..", "project", "Geomangle.json");
const p = JSON.parse(fs.readFileSync(GJ, "utf8"));
const mm = p.layouts.find(l => l.name === "mainmenu");
if (!mm) {console.error("no mainmenu layout"); process.exit(1)}

/*////////////////////////////////////////////////////////////////////*/

const names = p.resources.resources.filter(r => r.kind === "audio" && /music/i.test(r.name || "")).map(r => r.name);
let src = fs.readFileSync(path.join(__dirname, "musicquality.js"), "utf8");
src = src.replace("/*__MUSICNAMES__*/[]", JSON.stringify(names));
const lines = src.split(/\r?\n/);

const marker = "music-quality toggle";
mm.events = mm.events.filter(e => !(e.type === "BuiltinCommonInstructions::JsCode" &&
  Array.isArray(e.inlineCode) && e.inlineCode.join("\n").includes(marker)));
mm.events.push({type: "BuiltinCommonInstructions::JsCode", inlineCode: lines,
  parameterObjects: "", useStrict: true, eventsSheetExpanded: false});

fs.writeFileSync(GJ, JSON.stringify(p, null, 2));
console.log("music-quality injected into mainmenu (" + names.length + " music resources baked)");
