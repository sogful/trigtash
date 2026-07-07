/*//////////////////////////////////////////////////////////////////////*/

if (t.hudowner !== runtimeScene) {
  t.hudowner = runtimeScene;
  t.skipvars = null; t.practstack = []; t.practbase = null;
  t.awaitrespawn = false; t.earlyframes = 0; t.earlysnap = null;
  if (t.mode === "record") t.mode = "idle";
  t.dragcand = null; t.drewboxes = false;
  const pool = {};
  const grab = name => {
    if (!pool[name]) pool[name] = (runtimeScene.getObjects(name) || []).slice();
    return pool[name].shift() || null;
  };
  t.speedtext = grab("tasbtn");
  if (t.speedtext) {t.speedtext.setLayer("ui"); t.speedtext.setZOrder(10001); t.speedtext.hide(true)}
  t.counttext = grab("tasbtn");
  if (t.counttext) {
    t.counttext.setLayer("ui");
    t.counttext.setZOrder(10005);
    try {t.counttext.setScale(3)} catch (e) {}
    t.counttext.hide();
  }
  // video record warning text
  t.warntext = grab("tasbtn");
  if (t.warntext) {
    t.warntext.setLayer("ui");
    t.warntext.setZOrder(10005);
    try {t.warntext.setScale(0.5)} catch (e) {}
    try {t.warntext.setWrapping(false)} catch (e) {}
    t.warntext.hide(true);
  }
  t.veltext = grab("tasbtn");
  if (t.veltext) {
    t.veltext.setLayer("ui");
    t.veltext.setZOrder(10005);
    try {t.veltext.setScale(0.5)} catch (e) {}
    try {t.veltext.setWrapping(false)} catch (e) {}
    t.veltext.hide(true);
  }
  t.xvelcol = null;
  try {t.xvelcol = runtimeScene.createObject("tasbtn")} catch (e) {}
  if (t.xvelcol) {
    t.xvelcol.setLayer("ui");
    t.xvelcol.setZOrder(10006);
    try {t.xvelcol.setScale(0.5)} catch (e) {}
    try {t.xvelcol.setWrapping(false)} catch (e) {}
    t.xvelcol.hide(true);
  }
  t.tiptext = grab("tasbtn");
  if (t.tiptext) {
    t.tiptext.setLayer("ui");
    t.tiptext.setZOrder(10005);
    try {t.tiptext.setScale(0.5)} catch (e) {}
    try {t.tiptext.setWrapping(false)} catch (e) {}
    t.tiptext.hide(true);
  }
  t.edittext = grab("tasbtn");
  if (t.edittext) {
    t.edittext.setLayer("ui");
    t.edittext.setZOrder(10005);
    try {t.edittext.setScale(0.5)} catch (e) {}
    try {t.edittext.setWrapping(false)} catch (e) {}
    t.edittext.hide(true);
  }
  t.backtext = grab("tasbtn");
  if (t.backtext) {
    t.backtext.setLayer("ui");
    t.backtext.setZOrder(10005);
    try {t.backtext.setScale(0.5)} catch (e) {}
    try {t.backtext.setWrapping(false)} catch (e) {}
    t.backtext.hide(true);
  }
  t.stoptext = null;
  try {t.stoptext = runtimeScene.createObject("tasbtn")} catch (e) {}
  if (t.stoptext) {
    t.stoptext.setLayer("ui");
    t.stoptext.setZOrder(10005);
    try {t.stoptext.setScale(0.5)} catch (e) {}
    try {t.stoptext.setWrapping(false)} catch (e) {}
    t.stoptext.hide(true);
  }
  t.backicon = grab("tascpicon");
  if (t.backicon) {
    t.backicon.setLayer("ui");
    t.backicon.setZOrder(10005);
    t.backicon.hide(true);
  }
  t.buttons = [];
  for (const def of t.buttondefs) {
    const obj = grab(def.objname);
    if (!obj) continue;
    obj.setLayer("ui");
    obj.setZOrder(10001);
    obj.hide(true);
    if (def.flip) {try {obj.flipX(true)} catch (e) {}}
    t.buttons.push({def: def, obj: obj, hover: false});
  }
  const pobj = grab("macroPractice");
  if (pobj) {
    pobj.setLayer("ui");
    pobj.setZOrder(10001);
    pobj.hide(true);
    t.pract = {def: {id: "practice"}, obj: pobj, hover: false};
  }
  t.draw = grab("tasdraw");
  if (t.draw) {
    t.draw.setLayer("");
    t.draw.setZOrder(9500);
    t.draw.setPosition(0, 0);
    try {t.draw.clear()} catch (e) {}
  }
  t.veldraw = grab("tasveldraw");
  if (t.veldraw) {
    t.veldraw.setLayer("");
    t.veldraw.setZOrder(9501);
    t.veldraw.setPosition(0, 0);
    try {t.veldraw.clear()} catch (e) {}
  }
  t.black = grab("tasblack");
  if (t.black) {
    t.black.setLayer("ui");
    t.black.setZOrder(10004);
    t.black.setPosition(0, 0);
    try {t.black.clear()} catch (e) {}
  }
  t.blackdrawn = false; t.blackfadeout = null; t.practy = 300;
  t.hotkey = t.readsetting(runtimeScene, "macrohotkey");
  t.recording = t.hotkey; // always record in the background while the macro setting is on!
  t.frameadv = t.readsetting(runtimeScene, "macroframeadv");
  t.inputviewer = t.readsetting(runtimeScene, "macroinputviewer");
  t.videoui = t.readsetting(runtimeScene, "macrovideoui");
  t.velocityreadout = t.readsetting(runtimeScene, "macrovelocity");
  t.velvector = t.readsetting(runtimeScene, "macrovelvector");
  t.stopbutton = t.readsetting(runtimeScene, "macrostopbutton");
  t.macro = null; t.prevstop = Infinity; t.practtween = null;
  t.prevz = false; t.prevx = false; t.prevr = false;
  t.armage = 0; t.pendingsynth = null;
  t.bufjump = {space: false, up: false, mouse: false};
  t.hadcp = false; t.cpinit = false;
  try {t.prevdeaths = runtimeScene.getVariables().get("deaths").getAsNumber()} catch (e) {t.prevdeaths = 0}
}
if (t.practice && !t.practbase) t.practbase = t.readcp(runtimeScene);

t.practicetick(runtimeScene);
t.refreshhud();
