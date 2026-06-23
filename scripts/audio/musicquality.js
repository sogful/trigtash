if (window.__tgdmusicoverride) {
  const MENU = "assets\\sounds\\music\\blazuliteMenuTheme.ogg";
  const NAMES = /*__MUSICNAMES__*/[];
  let want = false;
  try {
    const f = JSON.parse(window.localStorage.getItem("GDJS_trigonometrydash") || "{}");
    if (f.settings && typeof f.settings.str === "string") {
      const v = JSON.parse(f.settings.str)["compressedmusic"];
      want = (v === true || v === "true" || v === 1);
    }
  } catch (e) {}
  if (window.__tgdquality === undefined) {
    window.__tgdquality = want;
  } else if (window.__tgdquality !== want) {
    window.__tgdquality = want;
    try {
      const sm = runtimeScene.getScene().getSoundManager();
      for (const nm of NAMES) {try {sm.unloadAudio(nm, true)} catch (e) {}}
      let vol = 100;
      try {const sl = runtimeScene.getObjects("volumeSlider"); if (sl.length && typeof sl[0].Value === "function") vol = sl[0].Value(null)} catch (e) {}
      try {gdjs.evtTools.sound.playMusicOnChannel(runtimeScene, MENU, 2, true, vol, 1)} catch (e) {}
    } catch (e) {}
  }
} else {
  try {for (const o of runtimeScene.getObjects("settingsSwitch")) {if (o.getVariables().get("id").getAsString() === "compressedmusic") {o.setOpacity(110); o.getVariables().get("locked").setNumber(1)}}} catch (e) {}
}
