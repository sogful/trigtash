const fs = require("fs");
const path = require("path");
const map = require("./~audiomap");
const ROOT = path.join(__dirname, "..", "..");
const COMP = ROOT + "/project/assets/audio/music/compressed";
const gamedir = process.argv[2];
if (!gamedir) {console.error("usage: buildaltaudio.js <gamedir>"); process.exit(1)}

/*////////////////////////////////////////////////////////////////////*/

let done = 0, miss = 0;
for (const name of map) {
  const src = path.join(COMP, name);
  if (!fs.existsSync(src)) {console.log("  WARN no compressed source: " + name); miss++; continue}
  fs.copyFileSync(src, path.join(gamedir, "cmp_" + name));
  done++;
}
console.log("alt audio: " + done + " compressed tracks -> cmp_*.ogg at root (" + miss + " missing)");

const idx = path.join(gamedir, "index.html");
if (fs.existsSync(idx)) {
  let html = fs.readFileSync(idx, "utf8");
  if (!html.includes("tgd-music-quality")) {
    const js = fs.readFileSync(path.join(__dirname, "musicoverride.js"), "utf8");
    const tag = "<script>/*tgd-music-quality*/\n" + js + "</script>\n";
    html = html.replace("<head>", "<head>\n" + tag);
    fs.writeFileSync(idx, html);
    console.log("music-quality override injected into index.html");
  }
} else {
  console.log("  WARN no index.html to inject override");
}
