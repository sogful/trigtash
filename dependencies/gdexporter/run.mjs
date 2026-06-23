import { loadProject, exportProject } from "gdcore-tools";
import { rmSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = process.argv[2] || ROOT + "/packaged";

try { rmSync(out, { recursive: true, force: true }); } catch (e) {}
console.log("loading project (gdevelop 5.6.269 core)...");
const project = await loadProject(ROOT + "/project/Geomangle.json");

console.log("exporting -> " + out + " ...");
exportProject(project, out, "electron");

const sm = out + "/app/howler-sound-manager/howler-sound-manager.js";
try {
  let js = readFileSync(sm, "utf8");
  const n = js.split("html5:t,xhr").length - 1;
  js = js.split("html5:t,xhr").join("html5:!1,xhr");
  writeFileSync(sm, js);
  console.log("patched sound manager: music -> web audio (" + n + " howl ctors)");
} catch (e) { console.log("WARN: sound-manager patch failed: " + e.message); }

console.log("export done! " + out + "/app");
process.exit(0);
