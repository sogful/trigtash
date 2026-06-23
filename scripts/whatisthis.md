well, scripts of course!

they're injected scripts within the game, as lots of this logic is borderline impossible within gdevelop block events (some is very easily possible, some is possible with addons, but it's whatever for now..)
since you likely only care about the TAS folder,

## chunks
- `1setup.js` - install guard, `t.*` state init, helpers, snapshot save/restore
- `2practice.js` - practice checkpoints, respawn, u-backtrack
- `3recordplayback.js` - input record/playback, the patched scenestack.step, macro file io
- `4video.js` - video recorder (+ very cool audio muxing)
- `5hud.js` - hud rendering, hitbox overlay
- `6listeners.js` - dom listeners
- `7housekeeping.js` - scene housekeeping

the chunks are slices of a single file, so please don't mind the syntax error at the end, patching it would break the final output!

## building
`node ~build.js` reassembles the chunks and fills placeholders then inserts the result into that gdevelop project json.