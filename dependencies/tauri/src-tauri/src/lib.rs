//////////////////////////////////////////////////////////////////////////
// tauri shell for trigonometry dash. uses the OS webview2 (no bundled
// chromium). the window stays 9:5 (no black void). the game's save lives in a
// pretty savedata.json next to the exe: rust injects it into localStorage
// before the game loads and persists changes back, so no webview leveldb junk
// is exposed. a small ffmpeg backend lets the recorder pipe rawvideo frames to
// the ffmpeg sidecar without electron/node.
//////////////////////////////////////////////////////////////////////////

use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{
  LogicalSize, PhysicalSize, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// the game renders at 432x240 = 9:5. keep the window content at that ratio so
// no black void appears (title-bar height otherwise makes the content wider).
const ASPECT: f64 = 9.0 / 5.0;

//////////////////////////////////////////////////////////////////////////
// portable save: a pretty savedata.json next to the exe (localStorage mirror)
//////////////////////////////////////////////////////////////////////////

fn savedata_path() -> Option<PathBuf> {
  std::env::current_exe()
    .ok()?
    .parent()
    .map(|d| d.join("savedata.json"))
}

#[tauri::command]
fn save_data(json: String) -> Result<(), String> {
  let p = savedata_path().ok_or("no savedata path")?;
  std::fs::write(p, json).map_err(|e| e.to_string())
}

// user levels live as individual .tgd files in <exe dir>/.levels/ (one per level,
// named by the level name) instead of bloating savedata.json. the init script seeds
// localStorage from these at boot and mirrors editor saves back to them.
fn levels_dir() -> Option<PathBuf> {
  let d = std::env::current_exe().ok()?.parent()?.join(".levels");
  let _ = std::fs::create_dir_all(&d);
  Some(d)
}

// reject anything that isn't a plain filename (no separators / traversal)
fn safe_level_name(name: &str) -> Option<String> {
  if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
    return None;
  }
  Some(name.to_string())
}

// {"<filename without .tgd>": "<file content>"} for every .tgd in .levels/
#[tauri::command]
fn read_levels() -> String {
  let mut out = serde_json::Map::new();
  if let Some(dir) = levels_dir() {
    if let Ok(entries) = std::fs::read_dir(&dir) {
      for e in entries.flatten() {
        let path = e.path();
        if path.extension().and_then(|x| x.to_str()) == Some("tgd") {
          if let (Some(stem), Ok(content)) =
            (path.file_stem().and_then(|s| s.to_str()), std::fs::read_to_string(&path))
          {
            out.insert(stem.to_string(), serde_json::Value::String(content));
          }
        }
      }
    }
  }
  serde_json::to_string(&serde_json::Value::Object(out)).unwrap_or_else(|_| "{}".to_string())
}

#[tauri::command]
fn write_level(name: String, content: String) -> Result<(), String> {
  let dir = levels_dir().ok_or("no levels dir")?;
  let n = safe_level_name(&name).ok_or("bad level name")?;
  std::fs::write(dir.join(n + ".tgd"), content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_level(name: String) -> Result<(), String> {
  let dir = levels_dir().ok_or("no levels dir")?;
  let n = safe_level_name(&name).ok_or("bad level name")?;
  let _ = std::fs::remove_file(dir.join(n + ".tgd"));
  Ok(())
}

// native "download/save a text file": show a save dialog, write via std::fs
// (bypasses the fs-plugin scope so the user can save anywhere). returns false
// if the dialog was cancelled. fixes level download / save export in webview2.
#[tauri::command]
async fn save_text_file(app: tauri::AppHandle, default_name: String, content: String) -> Result<bool, String> {
  use tauri_plugin_dialog::DialogExt;
  let name = default_name.clone();
  let picked = tauri::async_runtime::spawn_blocking(move || {
    let ext = name.rsplit('.').next().unwrap_or("txt").to_string();
    app.dialog()
      .file()
      .set_file_name(&name)
      .add_filter(&ext, &[ext.as_str()])
      .blocking_save_file()
  })
  .await
  .map_err(|e| e.to_string())?;
  match picked {
    Some(fp) => {
      let pb = fp.into_path().map_err(|e| e.to_string())?;
      std::fs::write(&pb, content).map_err(|e| e.to_string())?;
      Ok(true)
    }
    None => Ok(false),
  }
}

// unique temp file path (for the recorder's intermediate video/wav/final)
#[tauri::command]
fn temp_path(suffix: String) -> Result<String, String> {
  let nanos = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_nanos();
  let mut p = std::env::temp_dir();
  p.push(format!("tgd_{}{}", nanos, suffix));
  Ok(p.to_string_lossy().into_owned())
}

// write raw bytes to a path (the recorder's built wav)
#[tauri::command]
fn write_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
  std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_file(path: String) {
  let _ = std::fs::remove_file(path);
}

// save-as: show a dialog and COPY a temp file (the final mp4) to the chosen path
#[tauri::command]
async fn save_file_as(app: tauri::AppHandle, src: String, default_name: String) -> Result<bool, String> {
  use tauri_plugin_dialog::DialogExt;
  let name = default_name.clone();
  let picked = tauri::async_runtime::spawn_blocking(move || {
    let ext = name.rsplit('.').next().unwrap_or("bin").to_string();
    app.dialog()
      .file()
      .set_file_name(&name)
      .add_filter(&ext, &[ext.as_str()])
      .blocking_save_file()
  })
  .await
  .map_err(|e| e.to_string())?;
  match picked {
    Some(fp) => {
      let dest = fp.into_path().map_err(|e| e.to_string())?;
      std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
      Ok(true)
    }
    None => Ok(false),
  }
}

// native clipboard read (the init script points navigator.clipboard.readText
// here so pasting level data doesn't trigger webview2's permission prompt)
#[tauri::command]
fn read_clipboard() -> Result<String, String> {
  arboard::Clipboard::new()
    .and_then(|mut c| c.get_text())
    .map_err(|e| e.to_string())
}

// toggle the window between windowed and OS fullscreen (the "Fullscreen Mode" setting,
// which the game stores but never applied to anything)
#[tauri::command]
fn set_fullscreen(app: tauri::AppHandle, full: bool) -> Result<(), String> {
  use tauri::Manager;
  if let Some(win) = app.get_webview_window("main") {
    win.set_fullscreen(full).map_err(|e| e.to_string())?;
    // never force always-on-top: a topmost borderless window blocks alt-tab (other
    // windows draw behind it) and, combined with minimize-on-blur, could deadlock the
    // window into an unfocusable state. borderless-windowed fullscreen covers the
    // taskbar while focused yet alt-tabs cleanly, which is what we want.
    let _ = win.set_always_on_top(false);
  }
  Ok(())
}

// read savedata.json (or "{}" if missing/corrupt) for the boot init script
fn load_savedata() -> String {
  if let Some(p) = savedata_path() {
    if let Ok(c) = std::fs::read_to_string(&p) {
      if serde_json::from_str::<serde_json::Value>(&c).is_ok() {
        return c;
      }
    }
  }
  "{}".to_string()
}

// runs BEFORE the game's scripts: load savedata.json into localStorage, then
// hook writes so changes are debounce-saved back to the json (pretty-printed).
fn init_script() -> String {
  let data = load_savedata();
  // embed the file content as a json string literal that JSON.parse can read
  let lit = serde_json::to_string(&data).unwrap_or_else(|_| "\"{}\"".to_string());
  // the .tgd level files, embedded the same way so the boot seed is synchronous
  let levels = read_levels();
  let levels_lit = serde_json::to_string(&levels).unwrap_or_else(|_| "\"{}\"".to_string());
  const TEMPLATE: &str = r#"(function(){
  var proto = Object.getPrototypeOf(localStorage);
  var _set = proto.setItem, _rem = proto.removeItem, _clr = proto.clear;
  try {
    var SAVE = JSON.parse(__SAVE__);
    // savedata.json is the single source of truth: wipe the webview's own
    // persisted localStorage first, then seed ONLY from the json, so deleting
    // the json genuinely resets the game instead of falling back to stale state.
    _clr.call(localStorage);
    for (var k in SAVE) { var v = SAVE[k]; _set.call(localStorage, k, (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)); }
  } catch (e) {}
  // user levels are backed by individual .tgd files in .levels/ (read_levels/
  // write_level/delete_level). files are authoritative and savedata.json no longer
  // carries levels. the FILE is named by the level name (collision-suffixed), but the
  // storage KEY stays a stable id (levelInfo.uuid) so renaming a level to a duplicate
  // name can't collide keys and wipe the original.
  var knownFiles=[], lastLevelContent={}, levelsReady=false;
  function genId(){ return 'lvl'+Date.now()+'_'+Math.floor(Math.random()*1e9); }
  function sanitizeName(nm){ return String(nm).replace(/[\/\\:*?"<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,80).replace(/[ .]+$/,'') || 'level'; }
  function levelOf(d){ try { return (typeof d==='string')?JSON.parse(d):d; } catch(e){ return null; } }
  function nameOf(d){ var L=levelOf(d); var nm=L&&L.levelInfo&&L.levelInfo.levelName; return nm?sanitizeName(nm):null; }
  function withUuid(d,id){ try { var L=levelOf(d); if(!L) return d; if(!L.levelInfo) L.levelInfo={}; L.levelInfo.uuid=id; return JSON.stringify(L); } catch(e){ return d; } }
  function readLevelsMap(){ try { var raw=localStorage.getItem('GDJS_trigonometrydash'); if(!raw) return null; var g=JSON.parse(raw); return (g.levels&&g.levels.str)?JSON.parse(g.levels.str):{}; } catch(e){ return null; } }
  function syncLevels(){ if(!(window.__TAURI__&&window.__TAURI__.core)) return; var map=readLevelsMap(); if(!map) return; var desired={},used={},key,nm,base,i,content; for(key in map){ content=withUuid(map[key],key); nm=nameOf(map[key])||sanitizeName(key); base=nm; i=1; while(used[nm]){ nm=base+' ('+(i++)+')'; } used[nm]=1; desired[nm]=content; } var writes=[],f,j; for(f in desired){ if(lastLevelContent[f]!==desired[f]){ writes.push(window.__TAURI__.core.invoke('write_level',{name:f,content:desired[f]})); } } for(j=0;j<knownFiles.length;j++){ if(!(knownFiles[j] in desired)){ window.__TAURI__.core.invoke('delete_level',{name:knownFiles[j]}); } } knownFiles=Object.keys(desired); lastLevelContent=desired; try { Promise.all(writes).then(function(){ levelsReady=true; }); } catch(e){ levelsReady=true; } }
  var lt=null; function scheduleLevels(){ if(lt) clearTimeout(lt); lt=setTimeout(syncLevels,300); }
  function snap(){ var o={}; for (var i=0;i<localStorage.length;i++){ var key=localStorage.key(i); var raw=localStorage.getItem(key); var val=raw; try { val=JSON.parse(raw); } catch(e){} o[key]=val; } if(levelsReady && o.GDJS_trigonometrydash && typeof o.GDJS_trigonometrydash==='object'){ try{ delete o.GDJS_trigonometrydash.levels; }catch(e){} } return o; }
  var t=null;
  function persist(){ if(t) clearTimeout(t); t=setTimeout(function(){ try { if(window.__TAURI__ && window.__TAURI__.core) window.__TAURI__.core.invoke('save_data',{ json: JSON.stringify(snap(),null,2) }); } catch(e){} }, 400); }
  // apply the "Fullscreen Mode" setting to the real window (the game never wired it up)
  var lastFs=null;
  function applyFs(){ try { var raw=localStorage.getItem('GDJS_trigonometrydash'); if(!raw) return false; var g=JSON.parse(raw); var s=(g&&g.settings&&g.settings.str)?JSON.parse(g.settings.str):null; if(!s) return false; var on=!!s.fullscreen; if(on===lastFs) return true; if(window.__TAURI__&&window.__TAURI__.core){ window.__TAURI__.core.invoke('set_fullscreen',{full:on}); lastFs=on; return true; } return false; } catch(e){ return false; } }
  proto.setItem=function(k,v){ _set.call(this,k,v); persist(); applyFs(); if(k==='GDJS_trigonometrydash') scheduleLevels(); };
  proto.removeItem=function(k){ _rem.call(this,k); persist(); };
  proto.clear=function(){ _clr.call(this); persist(); };
  // seed the levels map from the .tgd files (authoritative). first boot with no
  // files migrates whatever the save still holds, then snap() stops saving it.
  try {
    var FILES=JSON.parse(__LEVELS__);
    var fnames=Object.keys(FILES);
    var graw=localStorage.getItem('GDJS_trigonometrydash');
    var gobj=graw?JSON.parse(graw):null;
    if(fnames.length){ var lmap={},fi,fc,LL,id; for(fi=0;fi<fnames.length;fi++){ fc=FILES[fnames[fi]]; LL=levelOf(fc); id=(LL&&LL.levelInfo&&LL.levelInfo.uuid)?LL.levelInfo.uuid:genId(); lmap[id]=fc; } gobj=gobj||{}; gobj.levels={str:JSON.stringify(lmap)}; _set.call(localStorage,'GDJS_trigonometrydash',JSON.stringify(gobj)); knownFiles=fnames.slice(); lastLevelContent={}; for(fi=0;fi<fnames.length;fi++){ lastLevelContent[fnames[fi]]=FILES[fnames[fi]]; } levelsReady=true; (function m(n){ if(window.__TAURI__&&window.__TAURI__.core){ syncLevels(); } else if(n>0){ setTimeout(function(){m(n-1);},300); } })(20); }
    else if(gobj&&gobj.levels&&gobj.levels.str){ (function m(n){ if(window.__TAURI__&&window.__TAURI__.core){ syncLevels(); } else if(n>0){ setTimeout(function(){m(n-1);},300); } })(20); }
    else { levelsReady=true; }
  } catch(e){ levelsReady=true; }
  try {
    if (navigator.clipboard) {
      var _ct = function(){ return (window.__TAURI__ && window.__TAURI__.core) ? window.__TAURI__.core.invoke("read_clipboard") : Promise.reject("no tauri"); };
      try { navigator.clipboard.readText = _ct; } catch(e) { try { Object.defineProperty(navigator.clipboard, "readText", {value: _ct, configurable: true}); } catch(e2){} }
    }
  } catch(e) {}
  (function boot(n){ if(!applyFs()&&n>0) setTimeout(function(){boot(n-1);},300); })(20);
})();"#;
  TEMPLATE.replace("__SAVE__", &lit).replace("__LEVELS__", &levels_lit)
}

//////////////////////////////////////////////////////////////////////////
// recorder backend: spawn the ffmpeg sidecar, stream rawvideo to its stdin
//////////////////////////////////////////////////////////////////////////

#[derive(Default)]
struct Ffmpeg {
  jobs: Mutex<HashMap<u32, Child>>,
  next: Mutex<u32>,
}

fn ffmpeg_path() -> Result<PathBuf, String> {
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe.parent().ok_or("no exe dir")?;
  let p = dir.join("ffmpeg.exe");
  if p.exists() {
    return Ok(p);
  }
  Err("ffmpeg sidecar not found next to the exe".into())
}

fn make_cmd(path: &std::path::Path) -> Command {
  let mut c = Command::new(path);
  #[cfg(windows)]
  c.creation_flags(CREATE_NO_WINDOW);
  c
}

#[tauri::command]
fn ffmpeg_start(state: State<Ffmpeg>, args: Vec<String>) -> Result<u32, String> {
  let path = ffmpeg_path()?;
  let child = make_cmd(&path)
    .args(&args)
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|e| e.to_string())?;
  let mut next = state.next.lock().unwrap();
  *next += 1;
  let id = *next;
  state.jobs.lock().unwrap().insert(id, child);
  Ok(id)
}

// the recorder streams rawvideo frames here. the frame bytes come in as a RAW
// ipc body (InvokeBody::Raw) - NOT a json arg - so a 414KB frame isn't blown up
// into a ~1.5MB json number-array on every call (that serialization was what made
// video export take minutes). the ffmpeg job handle rides in a header.
#[tauri::command]
fn ffmpeg_write(request: tauri::ipc::Request<'_>, state: State<Ffmpeg>) -> Result<(), String> {
  let handle: u32 = request
    .headers()
    .get("handle")
    .and_then(|v| v.to_str().ok())
    .and_then(|s| s.parse().ok())
    .ok_or("missing handle header")?;
  let bytes: &[u8] = match request.body() {
    tauri::ipc::InvokeBody::Raw(b) => b,
    _ => return Err("expected raw frame body".into()),
  };
  let mut jobs = state.jobs.lock().unwrap();
  let child = jobs.get_mut(&handle).ok_or("no such ffmpeg job")?;
  let stdin = child.stdin.as_mut().ok_or("ffmpeg stdin closed")?;
  stdin.write_all(bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn ffmpeg_finish(state: State<Ffmpeg>, handle: u32) -> Result<i32, String> {
  let mut child = state
    .jobs
    .lock()
    .unwrap()
    .remove(&handle)
    .ok_or("no such ffmpeg job")?;
  drop(child.stdin.take());
  let status = child.wait().map_err(|e| e.to_string())?;
  Ok(status.code().unwrap_or(-1))
}

#[tauri::command]
fn ffmpeg_kill(state: State<Ffmpeg>, handle: u32) {
  if let Some(mut child) = state.jobs.lock().unwrap().remove(&handle) {
    let _ = child.kill();
  }
}

#[tauri::command]
fn ffmpeg_run(args: Vec<String>) -> Result<i32, String> {
  let path = ffmpeg_path()?;
  let status = make_cmd(&path)
    .args(&args)
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status()
    .map_err(|e| e.to_string())?;
  Ok(status.code().unwrap_or(-1))
}

//////////////////////////////////////////////////////////////////////////
// external game files: serve <exe dir>/game/ over a custom "game://" scheme so
// the json/assets/audio live as loose swappable files next to the exe instead
// of being baked into the binary (keeps the exe small; lets the music set be
// swapped without a rebuild).
//////////////////////////////////////////////////////////////////////////

fn game_dir() -> Option<PathBuf> {
  std::env::current_exe().ok()?.parent().map(|d| d.join("game"))
}

fn percent_decode(s: &str) -> String {
  let b = s.as_bytes();
  let mut out = Vec::with_capacity(b.len());
  let hex = |c: u8| -> Option<u8> {
    match c {
      b'0'..=b'9' => Some(c - b'0'),
      b'a'..=b'f' => Some(c - b'a' + 10),
      b'A'..=b'F' => Some(c - b'A' + 10),
      _ => None,
    }
  };
  let mut i = 0;
  while i < b.len() {
    if b[i] == b'%' && i + 2 < b.len() {
      if let (Some(hi), Some(lo)) = (hex(b[i + 1]), hex(b[i + 2])) {
        out.push(hi * 16 + lo);
        i += 3;
        continue;
      }
    }
    out.push(b[i]);
    i += 1;
  }
  String::from_utf8_lossy(&out).into_owned()
}

fn mime_for(path: &str) -> &'static str {
  match path.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
    "html" | "htm" => "text/html",
    "js" | "mjs" => "text/javascript",
    "css" => "text/css",
    "json" => "application/json",
    "wasm" => "application/wasm",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "gif" => "image/gif",
    "svg" => "image/svg+xml",
    "ico" => "image/x-icon",
    "webp" => "image/webp",
    "ogg" | "oga" => "audio/ogg",
    "mp3" => "audio/mpeg",
    "wav" => "audio/wav",
    "m4a" | "aac" => "audio/mp4",
    "ttf" => "font/ttf",
    "otf" => "font/otf",
    "woff" => "font/woff",
    "woff2" => "font/woff2",
    _ => "application/octet-stream",
  }
}

fn serve_game(uri_path: &str) -> tauri::http::Response<Vec<u8>> {
  let not_found = || tauri::http::Response::builder().status(404).body(Vec::new()).unwrap();
  let dir = match game_dir() {
    Some(d) => d,
    None => return not_found(),
  };
  let mut rel = percent_decode(uri_path.trim_start_matches('/'));
  if let Some(q) = rel.find('?') {
    rel.truncate(q);
  }
  if rel.is_empty() {
    rel = "index.html".to_string();
  }
  if rel.contains("..") {
    return not_found();
  }
  match std::fs::read(dir.join(&rel)) {
    Ok(bytes) => tauri::http::Response::builder()
      .status(200)
      .header("Content-Type", mime_for(&rel))
      .header("Access-Control-Allow-Origin", "*")
      .header("Cache-Control", "no-store")
      .body(bytes)
      .unwrap(),
    Err(_) => not_found(),
  }
}

//////////////////////////////////////////////////////////////////////////

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(Ffmpeg::default())
    .register_uri_scheme_protocol("game", |_ctx, request| serve_game(request.uri().path()))
    .invoke_handler(tauri::generate_handler![
      ffmpeg_start,
      ffmpeg_write,
      ffmpeg_finish,
      ffmpeg_kill,
      ffmpeg_run,
      save_data,
      save_text_file,
      temp_path,
      write_bytes,
      remove_file,
      save_file_as,
      read_clipboard,
      set_fullscreen,
      read_levels,
      write_level,
      delete_level
    ])
    .setup(|app| {
      // build the window in rust so we can inject the save-loading init script
      // before any of the game's scripts run
      let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::CustomProtocol("game://localhost/index.html".parse().unwrap()))
        .title("Trigonometry Dash")
        .inner_size(1620.0, 900.0)
        .min_inner_size(432.0, 240.0)
        .resizable(true)
        .initialization_script(&init_script())
        .build()?;

      // target ~1620 wide at 9:5, shrunk to fit ~92% of the monitor, centered
      let (mut w, mut h) = (1620.0_f64, 1620.0_f64 / ASPECT);
      if let Ok(Some(mon)) = win.current_monitor() {
        let sf = mon.scale_factor();
        let ms = mon.size();
        let mw = (ms.width as f64 / sf) * 0.92;
        let mh = (ms.height as f64 / sf) * 0.92;
        if w > mw { w = mw; h = w / ASPECT; }
        if h > mh { h = mh; w = h * ASPECT; }
      }
      let _ = win.set_size(LogicalSize::new(w, h));
      let _ = win.center();
      Ok(())
    })
    // force the 9:5 aspect on resize so the game always fills the window - but NOT
    // in fullscreen, where the window must cover the whole (often 16:9) monitor and
    // gdjs letterboxes the 9:5 game on the black body instead
    .on_window_event(|win, event| {
      if let WindowEvent::Resized(size) = event {
        if size.width == 0 || win.is_fullscreen().unwrap_or(false) {
          return;
        }
        let target_h = (size.width as f64 / ASPECT).round() as u32;
        if size.height.abs_diff(target_h) > 2 {
          let _ = win.set_size(PhysicalSize::new(size.width, target_h));
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running trigonometry dash");
}
