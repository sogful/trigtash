const s = (window.__geoportal = window.__geoportal || {});
const scene = runtimeScene;
const game = scene.getGame();

const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const first = n => {const l = scene.getObjects(n); return l && l.length ? l[0] : null};
const dt = scene.getTimeManager().getElapsedTime() / 1000;

const cursorx = gdjs.evtTools.input.getCursorX(scene, "", 0);
const cursory = gdjs.evtTools.input.getCursorY(scene, "", 0);
const hovered = o => o && !o.isHidden() &&
  cursorx >= o.getAABBLeft() && cursorx <= o.getAABBRight() &&
  cursory >= o.getAABBTop() && cursory <= o.getAABBBottom();
const released = gdjs.evtTools.input.isMouseButtonReleased(scene, "Left");

/*//////////////////////////////////////////////////////////////////////*/

if (s.owner !== scene) {
  s.owner = scene;
  s.anim = 0;
  s.pending = null;
  try {
    gdjs.evtTools.window.setWindowSize(scene, 432 * 3, 240 * 3, true);
    gdjs.evtTools.window.centerWindow(scene);
  } catch (e) {}
  try {
    const tr = first("transition");
    if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Backward", 0, null);
  } catch (e) {}
  const t0 = first("titles");
  if (t0) {
    try {t0.setYOffset(158)} catch (e) {}
    try {
      t0.getBehavior("Resizable").setWidth(72);
      t0.getBehavior("Resizable").setHeight(20);
    } catch (e) {try {t0.setWidth(72); t0.setHeight(20)} catch (e2) {}}
  }
}

/*//////////////////////////////////////////////////////////////////////*/

s.anim += dt * 60;
const title = first("titles");
if (title) {
  title.setAngle(Math.cos(s.anim * Math.PI / 180) * 3);
  title.setX(216 - title.getWidth() / 2);
}
const glint = first("bgglint");
if (glint && glint.setXOffset) glint.setXOffset(glint.getXOffset() + dt * 40);

/*//////////////////////////////////////////////////////////////////////*/

const buttons = [
  ["creator", "creator", false],
  ["mappacks2", "mappack", false],
  ["featured", "rated", true],
  ["demonlist2", "demonlist", false],
  ["backbutton", "mainmenu", false]
];

function paintandgo(target) {
  try {
    const tr = first("transition");
    if (tr) tr.getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.2, "Circular", "Forward", 0, null);
  } catch (e) {}
  s.pending = {at: performance.now() + 200, scene: target};
}

const help = first("help");
let helptext = "";
for (const [name, target, disabled] of buttons) {
  const o = first(name);
  if (!o) continue;
  const hov = hovered(o);
  const targetscale = hov ? 1.2 : 1;
  o.setScale(lerp(o.getScale(), targetscale, dt * 30));
  try {o.setColor(disabled ? "120;120;120" : "255;255;255")} catch (e) {}
  if (hov && name !== "backbutton") {
    if (disabled) helptext = "not restored yet";
    else {
      try {helptext = o.getVariables().get("helpMsg").getAsString()} catch (e) {}
    }
  }
  if (hov && released && !disabled && !s.pending) paintandgo(target);
}
if (help) {
  help.setText(helptext);
  help.setX(216 - help.getWidth() / 2);
}

if (s.pending && performance.now() >= s.pending.at) {
  const target = s.pending.scene;
  s.pending = null;
  gdjs.evtTools.runtimeScene.replaceScene(scene, target, true);
}
