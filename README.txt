if you just want to play the game, extract the whole zip and run `/game/Trigonometry Dash.exe`!
don't move the exe out by itself (and don't delete this file: `/game/game/index.html`)

if the launcher says "Game files not found", extract the whole zip again instead of
opening or dragging only the exe out of the zip.

for the gdevelop project, see `/project/`
for javascript injected into the project, see `/scripts`
`/dependencies/` is just stuff that's used for general tasks:
  - ffmpeg source code for bundling a stripped down version of it for video exports
  - adjusted tauri as an alternative to electron
  - gdexporter to package the game without having to do it 
so realistically you don't even have to open the gdevelop ide to edit this mod :p

to rebuild the game, run `build.bat`.
for a smaller 40mb build without hq audio, run `build (small).bat`.
