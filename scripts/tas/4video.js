  /*////////////////////////////////////////////////////////////////////*/

  // video capture
  const completeobjs = ["levelComplete", "levelCompleteBg", "winRestart", "winLeave",
    "winEdit", "wincoin", "winIcon", "completeTime", "deathCount", "wincoinMany", "leftbutton", "rightbutton"];
  const completebtns = ["winRestart", "winLeave", "winEdit", "leftbutton", "rightbutton"];
  function completedim(scene) {
    for (const n of completeobjs) for (const o of scene.getObjects(n) || []) {try {o.setOpacity(0)} catch (e) {}}
  }
  function completegrey(scene, grey) {
    for (const n of completebtns) for (const o of scene.getObjects(n) || []) {try {o.setColor(grey ? "120;120;120" : "255;255;255")} catch (e) {}}
  }

  function gamecanvas() {
    try {
      const r = game.getRenderer();
      if (r && r.getCanvas) return r.getCanvas();
      if (r && r.getPIXIRenderer && r.getPIXIRenderer()) return r.getPIXIRenderer().view;
    } catch (e) {}
    return document.querySelector("canvas");
  }

  function videofilename() {
    let nm = "";
    try {nm = (t.playable && t.playable.macro && t.playable.macro.levelInfo && t.playable.macro.levelInfo.name) || ""} catch (e) {}
    if (!nm) {try {nm = svar(inlevel(), "loadedLevel").getChild("levelInfo").getChild("levelName").getAsString()} catch (e) {}}
    return (nm || "video").replace(/[^\w\- ]/g, "").trim() + ".mp4";
  }

  /*////////////////////////////////////////////////////////////////////*/

  // video recorder (largest part..)
  const TC = (window.__TAURI__ && window.__TAURI__.core) || null;
  const invoke = function (cmd, args, opts) {
    if (!TC) return Promise.reject(new Error("no tauri ipc"));
    return TC.invoke(cmd, args, opts);
  };

  function hideoverlayforvideo(scene) {
    try {for (const b of (t.buttons || []).concat(t.pract ? [t.pract] : [])) b.obj.hide(true)} catch (e) {}
    try {if (t.speedtext) t.speedtext.hide(true)} catch (e) {}
    try {if (t.tiptext) t.tiptext.hide(true)} catch (e) {}
    try {if (t.draw && !t.hitboxes) {t.draw.clear(); t.drewboxes = false}} catch (e) {}
    if (!t.videoui) {
      try {for (const o of scene.getObjects("pausebutton") || []) o.hide(true)} catch (e) {}
      try {for (const o of scene.getObjects("fpscounter") || []) o.hide(true)} catch (e) {}
    }
    try {for (const o of scene.getObjects("tasinput") || []) o.hide(true)} catch (e) {}
  }

  function setblackalpha(a) {
    if (!t.black) return;
    try {
      t.black.clear();
      if (a > 0) {
        t.black.setOutlineOpacity(0);
        t.black.setFillColor("0;0;0");
        t.black.setFillOpacity(Math.round(Math.min(1, a) * 255));
        t.black.drawRectangle(-400, -400, 900, 900);
      }
    } catch (e) {}
  }

  function startoffline(scene) {
    if (!TC) {note("video export needs the desktop app"); return false}
    const cv = gamecanvas();
    if (!cv) {note("no game canvas for capture"); return false}
    t.offw = cv.width; t.offh = cv.height;
    t.off2d = document.createElement("canvas");
    t.off2d.width = t.offw; t.off2d.height = t.offh;
    t.off2dctx = t.off2d.getContext("2d");
    const ow = t.offw * 3, oh = t.offh * 3;
    t.offtmp = null; t.ffhandle = null; t.fferr = false; t.offpaused = false;
    t.writechain = Promise.resolve(); t.pendingwrites = 0;

    // yuv444p for good color quality, but in the end it's kind of poorly supported
    invoke("temp_path", {suffix: ".mp4"}).then(function (tmp) {
      t.offtmp = tmp;
      const args = ["-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", t.offw + "x" + t.offh,
        "-r", "60", "-i", "pipe:0",
        "-vf", "scale=" + ow + ":" + oh + ":flags=neighbor:in_range=full:out_range=full:out_color_matrix=bt709,format=yuv444p",
        "-c:v", "libx264", "-pix_fmt", "yuv444p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "pc",
        "-crf", "16", "-preset", "veryfast", t.offtmp];
      return invoke("ffmpeg_start", {args: args});
    }).then(function (handle) {t.ffhandle = handle}).catch(function (e) {
      t.fferr = true; t.ffstderr = String(e); note("ffmpeg failed to start");
    });
    try {t.offvol = t.savedvol != null ? t.savedvol : (window.Howler ? window.Howler.volume() : 1); if (window.Howler) window.Howler.volume(0)} catch (e) {}
    t.vidphase = "render"; t.vidblock = true; t.offframe = 0; t.offsub = "intro"; t.offwon = 0; t.offcompleteat = -1;
    rebuildplaystate(0);
    try {
      const pl = aliveplayer(scene);
      if (pl) {const lay = scene.getLayer(""); lay.setCameraX(pl.getAABBCenterX()); lay.setCameraY(pl.getAABBCenterY())}
    } catch (e) {}
    resetstopwatch(scene);
    try {const tm = scene.getTimeManager()._timers.get("stopwatch"); if (tm) tm.setTime(-t.step)} catch (e) {}
    try {origframeend(); t.origstep(t.step)} catch (e) {}
    resetstopwatch(scene);
    applyicon(scene, 0);
    // uncollect coins
    try {
      for (const o of scene.getObjects("coin") || []) {
        let dis = false; try {dis = o.getVariables().get("disabled").getAsBoolean()} catch (e) {}
        if (dis) {try {o.setY(o.getY() + 16)} catch (e) {}}
        try {o.getVariables().get("disabled").setBoolean(false)} catch (e) {}
        try {o.getBehavior("Animation").setAnimationIndex(0)} catch (e) {}
        try {o.setOpacity(255)} catch (e) {}
      }
      try {svar(scene, "gotCoin").clearChildren()} catch (e) {}
    } catch (e) {}
    hideoverlayforvideo(scene);
    hooksounds(true);
    note("rendering video...");
    return true;
  }

  function readbackandwrite() {
    if (t.fferr || t.ffhandle == null) return;
    try {
      t.off2dctx.drawImage(gamecanvas(), 0, 0, t.offw, t.offh);
      const img = t.off2dctx.getImageData(0, 0, t.offw, t.offh);
      const buf = img.data.buffer;
      t.pendingwrites++;
      t.writechain = t.writechain.then(function () {
        return invoke("ffmpeg_write", buf, {headers: {handle: String(t.ffhandle)}});
      }).then(function () {t.pendingwrites--}, function (e) {t.pendingwrites--; t.fferr = true; t.ffstderr = String(e)});
      if (t.pendingwrites > 24) t.offpaused = true;
    } catch (e) {}
  }

  function settimer(scene, a) {
    try {for (const o of scene.getObjects("timeAttackClock") || []) o.setOpacity(a)} catch (e) {}
    try {for (const o of scene.getObjects("timerIcon") || []) o.setOpacity(a)} catch (e) {}
  }
  function paintandcap(scene) {
    if (!t.videoui) {
      try {for (const o of scene.getObjects("fpscounter") || []) o.hide(true)} catch (e) {}
      try {for (const o of scene.getObjects("pausebutton") || []) o.hide(true)} catch (e) {}
    }
    try {for (const o of scene.getObjects("tasinput") || []) o.hide(true)} catch (e) {}
    completedim(scene);
    if (t.hitboxes) {try {drawhitboxes(scene)} catch (e) {}}
    try {scene.render()} catch (e) {}
    readbackandwrite();
  }

  function offlineframe(scene) {
    const introN = 30; // 0.5s
    hideoverlayforvideo(scene);
    if (t.offsub === "intro") {
      applyicon(scene, 0);
      settimer(scene, Math.round((t.offframe / introN) * 255));
      setblackalpha(1 - t.offframe / introN);
      paintandcap(scene);
      t.offframe++;
      if (t.offframe >= introN) {t.offsub = "play"; t.frame = 0; rebuildplaystate(0)}
      return true;
    }
    settimer(scene, 255);
    if (t.offsub === "play") {
      origframeend();
      if (t.frame < t.playm.length) playframe();
      setblackalpha(0);
      applypendingsynth();
      t.origstep(t.step);
      applyicon(scene, t.frame);
      paintandcap(scene);
      if (winshown(scene)) {t.offsub = "outro"; t.offwon = t.offframe; t.offcompleteat = -1}
      else if (t.frame >= t.playm.length + 240) {t.offsub = "outro"; t.offwon = t.offframe; t.offcompleteat = t.offframe}
      t.frame++; t.offframe++;
      return true;
    }
    let stepping = true;
    if (t.offcompleteat < 0) {
      let ph = 0; try {ph = svar(scene, "winAnimationPhase").getAsNumber()} catch (e) {}
      if (ph >= 117 || (t.offframe - t.offwon) > 360) t.offcompleteat = t.offframe;
    }
    let oa = 0, done = false;
    if (t.offcompleteat >= 0) {
      const oe = t.offframe - t.offcompleteat;
      oa = oe > 60 ? Math.min(1, (oe - 60) / 60) : 0;
      if (oe >= 120) done = true;
    }
    setblackalpha(oa);
    if (stepping) {origframeend(); t.origstep(t.step)}
    paintandcap(scene);
    t.offframe++;
    return !done;
  }

  function offlinetick(scene) {
    if (t.fferr) {note("ffmpeg error during render"); abortoffline(); return true}
    t.allowframeend = false;
    if (t.ffhandle == null) return true;
    if (t.offpaused) {
      if (t.pendingwrites <= 6) t.offpaused = false; else return true;
    }
    const budget = performance.now() + 12;
    let more = true;
    while (more && !t.offpaused && performance.now() < budget) more = offlineframe(scene);
    if (!more) finishoffline();
    return true;
  }

  function abortoffline() {
    try {if (t.ffhandle != null) invoke("ffmpeg_kill", {handle: t.ffhandle})} catch (e) {}
    t.ffhandle = null;
    hooksounds(false);
    try {if (window.Howler && t.offvol != null) {window.Howler.volume(t.offvol); t.offvol = null}} catch (e) {}
    t.vidphase = null; t.vidblock = false; t.vidstep = "";
    releaseall();
    setblackalpha(0);
  }

  /*////////////////////////////////////////////////////////////////////*/

  function hooksounds(install) {
    let sm = null;
    try {sm = game.getSoundManager()} catch (e) {}
    if (!sm) return;
    if (install) {
      if (sm.__tashooked) return;
      sm.__tashooked = true;
      t.soundlog = [];
      t.sndorig = {};
      const wrap = function (name, chan, music) {
        if (typeof sm[name] !== "function") return;
        t.sndorig[name] = sm[name];
        sm[name] = function () {
          try {
            const a = arguments;
            const res = a[0], loop = chan ? a[2] : a[1], vol = chan ? a[3] : a[2], rate = chan ? a[4] : a[3];
            t.soundlog.push({frame: t.offframe, res: res, loop: !!loop, vol: (vol == null ? 100 : vol) / 100, rate: rate || 1, music: music});
          } catch (e) {}
        };
      };

      wrap("playSound", false, false);
      wrap("playSoundOnChannel", true, false);
      wrap("playMusic", false, true);
      wrap("playMusicOnChannel", true, true);

      try {
        const ms = (sm._freeMusics || []).concat(Object.keys(sm._musics || {}).map(k => sm._musics[k]));
        for (const m of ms) {
          if (m && m._audioResourceName && m.playing && m.playing()) {
            t.soundlog.push({frame: 0, res: m._audioResourceName, loop: true, vol: m._initialVolume == null ? 1 : m._initialVolume, rate: m._rate || 1, music: true});
          }
        }
      } catch (e) {}
    } else {
      if (!sm.__tashooked) return;
      for (const n in t.sndorig) sm[n] = t.sndorig[n];
      t.sndorig = {};
      sm.__tashooked = false;
    }
  }

  function soundurl(sm, res) {
    try {const r = sm._getAudioResource(res); return sm._resourceLoader.getFullUrl(r.file)} catch (e) {return null}
  }

  function fetchaudio(url) {
    return new Promise(function (resolve) {
      let done = false;
      const to = setTimeout(function () {if (!done) {done = true; resolve(null)}}, 8000);
      fetch(url).then(r => r.arrayBuffer()).then(function (ab) {if (!done) {done = true; clearTimeout(to); resolve(ab)}})
        .catch(function () {if (!done) {done = true; clearTimeout(to); resolve(null)}});
    });
  }

  // AudioBuffer tuah 16-bit PCM WAV for ffmpeg
  function audiobuffertowav(buf) {
    const nch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const blockAlign = nch * 2, dataLen = len * blockAlign;
    const ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
    let p = 0;
    const ws = s => {for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i))};
    ws("RIFF"); dv.setUint32(p, 36 + dataLen, true); p += 4; ws("WAVE");
    ws("fmt "); dv.setUint32(p, 16, true); p += 4; dv.setUint16(p, 1, true); p += 2;
    dv.setUint16(p, nch, true); p += 2; dv.setUint32(p, sr, true); p += 4;
    dv.setUint32(p, sr * blockAlign, true); p += 4; dv.setUint16(p, blockAlign, true); p += 2;
    dv.setUint16(p, 16, true); p += 2; ws("data"); dv.setUint32(p, dataLen, true); p += 4;
    const chans = [];
    for (let c = 0; c < nch; c++) chans.push(buf.getChannelData(c));
    for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      dv.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2;
    }
    return new Uint8Array(ab);
  }

  // decode every logged sound and render to wav file
  function buildaudio() {
    return new Promise(function (resolve) {
      const all = (t.soundlog || []).slice();
      if (!all.length) {resolve(null); return}
      const log = all.filter(e => !e.music);
      const musicev = all.filter(e => e.music).sort((a, b) => a.frame - b.frame)[0];
      // export at FULL volume regardless of the ingame setting, i don't think anybody would want musicless videos
      if (musicev) {musicev.frame = 30; musicev.vol = 1; log.push(musicev)}
      const sm = game.getSoundManager();
      const sr = 44100, dur = t.offframe / 60 + 1.5;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      let octx;
      try {octx = new OAC(2, Math.ceil(dur * sr), sr)} catch (e) {resolve(null); return}
      const urls = {};
      for (const e of log) if (!(e.res in urls)) urls[e.res] = soundurl(sm, e.res);
      const buffers = {};
      const tasks = Object.keys(urls).map(function (res) {
        const url = urls[res];
        if (!url) return Promise.resolve();
        return fetchaudio(url).then(function (abuf) {
          if (!abuf) return;
          return octx.decodeAudioData(abuf).then(function (b) {buffers[res] = b}).catch(function () {});
        }).catch(function () {});
      });
      t.vidstep = "decoding audio...";
      Promise.all(tasks).then(function () {
        t.vidstep = "mixing audio...";
        const master = octx.createGain();
        master.connect(octx.destination);
        const endt = t.offframe / 60;
        try {master.gain.setValueAtTime(1, Math.max(0, endt - 1)); master.gain.linearRampToValueAtTime(0, endt)} catch (er) {}
        for (const e of log) {
          const b = buffers[e.res];
          if (!b) continue;
          try {
            const src = octx.createBufferSource();
            src.buffer = b; src.loop = !!e.loop;
            try {src.playbackRate.value = e.rate || 1} catch (er) {}
            const g = octx.createGain();
            g.gain.value = e.vol == null ? 1 : e.vol;
            src.connect(g); g.connect(master);
            src.start(Math.max(0, e.frame / 60));
          } catch (er) {}
        }
        octx.startRendering().then(function (rendered) {
          const bytes = audiobuffertowav(rendered);
          invoke("temp_path", {suffix: ".wav"}).then(function (wp) {
            return invoke("write_bytes", {path: wp, data: Array.from(bytes)}).then(function () {resolve(wp)});
          }).catch(function () {resolve(null)});
        }).catch(function () {resolve(null)});
      });
    });
  }

  function muxav(videopath, wavpath) {
    return new Promise(function (resolve) {
      invoke("temp_path", {suffix: ".mp4"}).then(function (out) {
        const args = ["-y", "-i", videopath, "-i", wavpath, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out];
        return invoke("ffmpeg_run", {args: args}).then(function (code) {resolve(code === 0 ? out : null)});
      }).catch(function () {resolve(null)});
    });
  }

  function beginplayback(withvideo) {
    if (!t.playable) {note("no macro available"); return}
    t.videopending = !!withvideo;
    t.mode = "idle";
    t.frozen = false;
    releaseall();
    t.clearscreens = true;
    try {t.savedvol = window.Howler ? window.Howler.volume() : 1} catch (e) {t.savedvol = 1}
    if (withvideo) t.countdown = performance.now() + 3000;
    else t.requestrestart = "play";
  }

  function drawblack() {
    if (!t.black) return;
    let a = 0;
    if (t.countdown) {
      const elapsed = 3000 - (t.countdown - performance.now());
      a = Math.max(0, Math.min(1, elapsed / 500));
    } else if (t.vidphase === "outro") {
      const el = t.completeat == null ? 0 : performance.now() - t.completeat;
      a = el > 1500 ? Math.min(1, (el - 1500) / 500) : 0;
    } else if (t.blackfadeout) {
      a = 1 - (performance.now() - t.blackfadeout) / 450;
      if (a <= 0) {a = 0; t.blackfadeout = null}
    }
    if (a <= 0) {
      if (t.blackdrawn) {try {t.black.clear()} catch (e) {} t.blackdrawn = false}
      return;
    }
    try {
      t.black.clear();
      t.black.setOutlineOpacity(0);
      t.black.setFillColor("0;0;0");
      t.black.setFillOpacity(Math.round(a * 255));
      t.black.drawRectangle(-400, -400, 900, 900);
      t.blackdrawn = true;
    } catch (e) {}
  }

  function finishoffline() {
    t.vidphase = "export"; t.vidblock = true; t.vidstep = "encoding...";
    t.mode = "idle"; t.fadein = performance.now(); t.exportfade = performance.now();
    setblackalpha(0);
    releaseall();
    try {if (window.Howler && t.offvol != null) {window.Howler.volume(t.offvol); t.offvol = null}} catch (e) {}
    hooksounds(false);
    t.writechain.then(function () {
      return invoke("ffmpeg_finish", {handle: t.ffhandle});
    }).then(function (code) {
      t.ffhandle = null;
      if (code !== 0) {
        note("ffmpeg exit " + code); t.vidstep = "encode failed (" + code + ")";
        t.vidphase = "exported"; t.exporteddone = performance.now();
        return;
      }
      // mux the logged sounds onto the silent video, then save! 
      t.vidstep = "muxing audio...";
      let done = false;
      const finish = function (p) {if (done) return; done = true; savemp4(p || t.offtmp)};
      setTimeout(function () {finish(t.offtmp)}, 30000);
      Promise.resolve().then(buildaudio).then(function (wav) {
        if (!wav) return t.offtmp;
        return muxav(t.offtmp, wav).then(function (muxed) {
          try {invoke("remove_file", {path: wav})} catch (e) {}
          return muxed || t.offtmp;
        });
      }).then(finish).catch(function (e) {note("audio mux failed?! " + e); finish(t.offtmp)});
    }).catch(function (e) {
      t.ffhandle = null; note("ffmpeg finish failed: " + e);
      t.vidstep = "encode failed"; t.vidphase = "exported"; t.exporteddone = performance.now();
    });
  }

  function savemp4(finalpath) {
    t.vidstep = "saving...";
    const cleanup = function () {
      try {invoke("remove_file", {path: t.offtmp})} catch (e) {}
      if (finalpath !== t.offtmp) {try {invoke("remove_file", {path: finalpath})} catch (e) {}}
    };
    invoke("save_file_as", {src: finalpath, defaultName: videofilename()}).then(function (saved) {
      t.vidstep = saved ? "video exported!" : "export cancelled";
    }, function () {
      t.vidstep = "save failed";
    }).then(function () {
      cleanup();
      t.vidphase = "exported"; t.exporteddone = performance.now();
      t.ffhandle = null;
    });
  }

  /*////////////////////////////////////////////////////////////////////*/

  const actions = {
    record() {
      if (t.recording || t.mode === "record") {
        t.recording = false;
        if (t.mode === "record") {
          t.mode = "idle";
          if (t.macro) t.playable = {macro: t.macro, src: "session"};
        }
        note("recording stopped");
      } else {
        t.recording = true;
        const sc = inlevel();
        if (sc) startsession(sc);
        note("recording...");
      }
    },
    pauseresume() {
      t.frozen = !t.frozen; t.pendingsteps = 0;
    },
    playmacro() {beginplayback(false)},
    stepf() {if (!t.frameadv) return; if (!t.frozen) t.frozen = true; t.pendingsteps++},
    stepb() {if (!t.frameadv) return; if (!t.frozen) t.frozen = true; t.pendingrollback++},
    slower() {
      const i = t.paces.indexOf(t.pace);
      if (i > 0) t.pace = t.paces[i - 1];
    },
    faster() {
      const i = t.paces.indexOf(t.pace);
      if (i < t.paces.length - 1) t.pace = t.paces[i + 1];
    },
    speed() {t.pace = 1},
    hitbox() {t.hitboxes = !t.hitboxes},
    exportm() {exportmacro()},
    importm() {importmacro()},
    practice() {
      t.requestpractice = t.practice ? "off" : "on";
    },
    video() {
      if (t.vidphase || t.ffhandle != null) return;
      beginplayback(true);
    }
  };

  t.buttondefs = [
    {id: "pauseresume", objname: "tasplay", adv: true},
    {id: "stepb", objname: "tasstepb", hold: true, adv: true},
    {id: "stepf", objname: "tasstepf", hold: true, adv: true},
    {id: "slower", objname: "tasarrow", hold: true},
    {id: "speed", objname: "tastime"},
    {id: "faster", objname: "tasarrow", hold: true, flip: true},
    {id: "hitbox", objname: "tashitbox"},
    {id: "exportm", objname: "tasexport"},
    {id: "importm", objname: "tasimport"},
    {id: "video", objname: "tasvideo", under: "importm", stack: 0},
    {id: "playmacro", objname: "tasplaytiny", under: "importm", stack: 1}
  ];
  t.buttontips = /*__BUTTONTIPS__*/{};

  /*////////////////////////////////////////////////////////////////////*/

  function fillbox(d, cx, cy, hw, hh, ang) {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const cn = (sx, sy) => [cx + sx * hw * cos - sy * hh * sin, cy + sx * hw * sin + sy * hh * cos];
    const a = cn(-1, -1), b = cn(1, -1), c = cn(1, 1), e = cn(-1, 1);
    d.beginFillPath(a[0], a[1]);
    d.drawPathLineTo(b[0], b[1]);
    d.drawPathLineTo(c[0], c[1]);
    d.drawPathLineTo(e[0], e[1]);
    d.closePath();
    d.endFillPath();
  }

  const radii = {goal: true, bgcolortrigger: true,
    groundcolortrigger: true, forcetrigger: true};
  const trigtex = {bgcolortrigger: true, groundcolortrigger: true, forcetrigger: true};
  function objradius(o) {
    try {return o.getVariables().get("data").getChild("radius").getAsNumber() * 16} catch (e) {return 48}
  }
  function physscale(o) {
    try {const b = o.getBehavior("Physics2"); if (b) {if (b.getShapeScale) return b.getShapeScale(); if (b.shapeScale) return b.shapeScale}} catch (e) {}
    return 1;
  }
  function drawphys(d, o, phys, ccx, ccy) {
    const ang = o.getAngle() * Math.PI / 180, cos = Math.cos(ang), sin = Math.sin(ang);
    if (phys.shape === "Polygon" && phys.verts) {
      let sx = 1, sy = 1;
      try {sx = o.getScaleX(); sy = o.getScaleY()} catch (e) {}
      let flip = 1;
      try {if (o.isFlippedX && o.isFlippedX()) flip = -1} catch (e) {}
      const w = o.getWidth(), h = o.getHeight();
      const pts = phys.verts.map(v => {
        let px = v[0] * sx, py = v[1] * sy;
        if (flip === -1) px = w - px;
        const cxo = px - w / 2, cyo = py - h / 2;
        return [ccx + cxo * cos - cyo * sin, ccy + cxo * sin + cyo * cos];
      });
      drawpoly(d, pts);
      return;
    }
    const ss = physscale(o);
    let flip = 1;
    try {if (o.isFlippedX && o.isFlippedX()) flip = -1} catch (e) {}
    const ox = phys.ox * ss * flip, oy = phys.oy * ss;
    const fx = ccx + ox * cos - oy * sin, fy = ccy + ox * sin + oy * cos;
    if (phys.shape === "Edge") {
      const eoy = oy + o.getHeight() / 2;
      const efx = ccx + ox * cos - eoy * sin, efy = ccy + ox * sin + eoy * cos;
      fillbox(d, efx, efy, phys.a / 2 * ss, 1, ang + phys.b * flip * Math.PI / 180);
    } else if (phys.shape === "Circle") {
      d.drawCircle(fx, fy, phys.a * ss);
    } else {
      fillbox(d, fx, fy, phys.a / 2 * ss, phys.b / 2 * ss, ang);
    }
  }
  function drawmask(d, o) {
    let hbs;
    try {hbs = o.getHitBoxes()} catch (e) {return}
    if (!hbs) return;
    for (const hb of hbs) drawpoly(d, (hb.vertices || []).map(v => [v[0], v[1]]));
  }
  function drawcheckpoint(d, o) {
    let sx = 1, sy = 1;
    try {sx = o.getScaleX(); sy = o.getScaleY()} catch (e) {}
    const ang = o.getAngle() * Math.PI / 180, cos = Math.cos(ang), sin = Math.sin(ang);
    const cx = o.getCenterXInScene(), cy = o.getCenterYInScene();
    const oy = -4 * sy;
    fillbox(d, cx - oy * sin, cy + oy * cos, 7 * sx, 12 * sy, ang);
  }
  function drawhitboxes(scene) {
    const d = t.draw;
    if (!d) return;
    const on = t.hitboxes && !t.countdown && t.vidphase !== "export" && t.vidphase !== "exported";
    if (!on) {
      if (t.drewboxes) {
        try {d.clear()} catch (e) {}
        try {for (const o of scene.getAdhocListOfAllInstances()) {if (trigtex[o.getName()]) o.hide(true)}} catch (e) {}
        t.drewboxes = false;
      }
      return;
    }
    t.drewboxes = true;
    let onv = 1;
    try {onv = svar(scene, "on").getAsNumber()} catch (e) {}
    try {
      d.clear();
      const lay = scene.getLayer("");
      const camx = lay.getCameraX(), camy = lay.getCameraY();
      const zoom = Math.max(0.05, lay.getCameraZoom());
      const cullw = 216 / zoom + 64, cullh = 120 / zoom + 64;
      d.setOutlineSize(1);
      for (const o of scene.getAdhocListOfAllInstances()) {
        if (o.getLayer() !== "") continue;
        const name = o.getName();
        if (o.isHidden()) {if (!trigtex[name]) continue; try {o.hide(false)} catch (e) {}}
        if (name === "playerpass") continue;
        const ccx = o.getCenterXInScene(), ccy = o.getCenterYInScene();
        if (Math.abs(ccx - camx) > cullw || Math.abs(ccy - camy) > cullh) continue;
        if ((name === "onblock" || name === "onspike") && onv !== 1) continue;
        if ((name === "offblock" || name === "offspike") && onv === 1) continue;
        try {const b = o.hasBehavior && o.hasBehavior("Physics2") && o.getBehavior("Physics2"); if (b && b.activated && !b.activated()) continue} catch (e) {}
        if (t.coinset[name]) {try {if (o.getVariables().get("disabled").getAsBoolean()) continue} catch (e) {}}
        if (playernames.indexOf(name) !== -1) continue;

        const phys = physmap[name];
        let col = null;
        if (name === "icon") col = "0;230;230";
        else if (t.killset[name]) col = "255;64;64";
        else if (radii[name] || t.greenset[name] || t.coinset[name] || name === "onoffswitch" || name === "checkpoint") col = "64;255;64";
        else if (phys) col = "64;128;255";
        if (!col) continue;
        d.setFillColor(col);
        d.setOutlineColor(col);
        d.setFillOpacity(60);
        d.setOutlineOpacity(220);
        // trigger circle
        if (radii[name]) {
          d.setFillOpacity(0);
          d.drawCircle(ccx, ccy, (name === "goal" ? 48 : (objradius(o) || 48)) - 8);
          continue;
        }
        if (name === "checkpoint") drawcheckpoint(d, o);
        else if (phys) drawphys(d, o, phys, ccx, ccy);
        else drawmask(d, o);
      }
      drawplayer(scene, d);
    } catch (e) {}
  }

  function drawpoly(d, poly) {
    if (!poly || poly.length < 2) return;
    d.beginFillPath(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) d.drawPathLineTo(poly[i][0], poly[i][1]);
    d.closePath();
    d.endFillPath();
  }
  function playershape(o, phys) {
    const ss = physscale(o);
    const ang = o.getAngle() * Math.PI / 180, cos = Math.cos(ang), sin = Math.sin(ang);
    const ccx = o.getCenterXInScene(), ccy = o.getCenterYInScene();
    const ox = phys.ox * ss, oy = phys.oy * ss;
    const fx = ccx + ox * cos - oy * sin, fy = ccy + ox * sin + oy * cos;
    if (phys.shape === "Circle") return {kind: "circle", x: fx, y: fy, r: phys.a * ss};
    const hw = phys.a / 2 * ss, hh = phys.b / 2 * ss;
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(c => [fx + c[0] * cos - c[1] * sin, fy + c[0] * sin + c[1] * cos]);
    return {kind: "poly", pts: pts};
  }
  function drawshape(d, s) {
    if (s.kind === "circle") d.drawCircle(s.x, s.y, s.r);
    else drawpoly(d, s.pts);
  }
  function drawplayer(scene, d) {
    let p = null, anyp = null;
    for (const pn of playernames) {
      const list = scene.getObjects(pn) || [];
      if (!list.length) continue;
      if (!anyp) anyp = list[0];
      const vis = list.find(o => !o.isHidden());
      if (vis) {p = vis; break}
    }
    p = p || anyp;
    if (!p) {t.trail = []; return}
    const phys = physmap[p.getName()];
    if (!phys) {t.trail = []; return}
    const cx = p.getCenterXInScene(), cy = p.getCenterYInScene();
    const shape = playershape(p, phys);

    t.trail = t.trail || [];
    const last = t.trail[t.trail.length - 1];
    if (last && Math.hypot(cx - last.cx, cy - last.cy) > 80) t.trail = [];
    if (!last || Math.hypot(cx - last.cx, cy - last.cy) > 0.5) {
      t.trail.push({cx: cx, cy: cy, shape: shape});
      if (t.trail.length > 60) t.trail.shift();
    }

    d.setFillOpacity(0);
    d.setOutlineColor("0;230;230");
    for (let k = 0; k < t.trail.length; k++) {
      d.setOutlineOpacity(Math.round(25 + 120 * (k / Math.max(1, t.trail.length))));
      drawshape(d, t.trail[k].shape);
    }
    d.setOutlineColor("0;230;230");
    d.setFillColor("0;230;230");
    d.setOutlineOpacity(235);
    d.setFillOpacity(55);
    drawshape(d, shape);
  }

