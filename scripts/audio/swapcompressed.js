const fs = require("fs");
const path = require("path");
const map = require("./~audiomap");
const ROOT = path.join(__dirname, "..", "..");
const COMP = ROOT + "/project/assets/audio/music/compressed";
const gamedir = process.argv[2];
if (!gamedir) {console.error("usage: swapcompressed.js <gamedir>"); process.exit(1)}

/*////////////////////////////////////////////////////////////////////*/

let done = 0, miss = 0;
for (const name of map) {
  const src = path.join(COMP, name), dst = path.join(gamedir, name);
  if (!fs.existsSync(src)) {console.log("  WARN no compressed source: " + name); miss++; continue}
  if (!fs.existsSync(dst)) {console.log("  WARN no target in game dir: " + name); miss++; continue}
  fs.copyFileSync(src, dst);
  done++;
}
console.log("compressed audio: " + done + " swapped, " + miss + " missing");
process.exit(0);
