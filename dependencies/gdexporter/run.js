const exportGame = require("./src/main.js");
const ROOT = require("path").join(__dirname, "..", "..");
const out = process.argv[2] || ROOT + "/packaged";
exportGame(ROOT + "/project/Geomangle.json", out, {
  buildType: "electron",
  gdevelopVersion: "local",
  verbose: true,
})
  .then(() => console.log("export done! " + out))
  .catch((e) => {
    console.error("export failed..");
    console.error((e && e.stack) || e);
    process.exit(1);
  });
