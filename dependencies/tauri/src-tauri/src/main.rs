// prevents an extra console window on windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // saves live in savedata.json next to the exe (handled in lib.rs); webview2's
  // own cache can stay in appdata - it's regenerable and not part of the save.
  tgd_lib::run()
}
