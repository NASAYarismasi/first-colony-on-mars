# Düz Ova recovery / integration

Source: İhan's `vendor-ihan/MARS-KOLONISI-DUZ-OVA.html`, NASAYarismasi/-lhan commit d6caf78. No original module sources were present. No packages installed, no commits/pushes, no edits to the three colony rule files or `environment.mjs`.

## Recovery

`node scripts/recover-ova.mjs` uses the installed Rolldown/Oxc formatter/parser (esbuild is absent in this Vite 8 tree). It locates the standalone application after the bundled controls by DOM IDs / Turkish labels, resolves bundled Three.js aliases from the bundle's export table, and writes the separated readable application to `output/ova/app-readable.js`. Hand-integrated, named modules are in `src/colony/ova/`: `terrain.mjs`, `habitat.mjs`, `solar.mjs`, `world.mjs`, `navigation.mjs`, `eclss.mjs`, and `assets.mjs`. Each credits İhan and the source commit. They use npm Three.js 0.187 APIs, with the existing GLTF/Draco loaders in mars-demo.

The embedded rover and suit were base64-decoded and compared byte-for-byte with every existing colony model. Both are identical, so no duplicate binaries were added (hashes in ASSETS.md). The embedded decoder is superseded by BASE_URL + `draco/`.

## Integration boundary for source replacement

`createOvaWorld(scene)` returns ground (with triangle-exact `ground.userData.heightAt`), habitat, obstacle boxes, floorY, entryZ, interior floor / exterior collision checks, footprint overlap, views, and a cleanup method for shader-only resources. `mars-demo.mjs` owns scene resource disposal and the render loop. `createOvaNavigation(world)` tracks airlock state. `createFirstPerson.teleport(position,pitch,yaw)` resets suit vertical motion during the transition. View buttons use `data-ova-view`; all pre-existing gameplay element IDs remain.

No second renderer, loop, sky, sun, controls, wrist device or application state was imported. Existing rules, cargo manifest, module placement, roof access, crew assignment, sols, workshop, agriculture, report, landing payload, colony:state and ARES terminal remain authoritative. The recovered habitat and 420-panel field are demonstration scenery; they do not silently credit gameplay resources. Players still deploy their cargo modules on clear ground around the base. Wide placements are blocked against dome/tunnel, airlock, tower and solar footprints.

## Intentional differences from the single-file demo

- Full-screen colony HUD/drawers and ARES, shared Mars24 sun/sky/fog/night/headlamp/audio replace its layout, fixed lights and static Mars sky. The Moon reference toggle and illustrative large Earth are omitted because the active mission is on Mars.
- Our landed crew vehicle remains west of the base, with a ladder spawn. Small spawn clearance/heading edits in mars-demo must be reconciled with the parallel environment/spawn worker.
- Three gameplay crew are used: the selected player starts at the lander; the other two use the original suit placements. Source NASA models and source rover scale/rotation are retained.
- Same dome shell vertices, windows, interior equipment, tunnels, tower and solar layout. Fewer rocks (6,550 vs 36,600), 96² vs 320² ground subdivisions, capped DPR 1.35, five instanced solar batches. Three interior point lights remain allocated; only the shared environment sun casts shadows.
- Source panorama/base/solar cameras live in Görünüm; an extra construction overview is included. The ECLSS illustration lives in its own drawer with original defaults (10 days, 85% water recovery), reference rates and solar 420/413 kWh/sol examples. It never changes game resources.

## Verification

New Vitest coverage checks source layout/cameras, instanced counts, no extra shadow lights, exact ground height, footprint clearance, proximity-gated entry/exit, both tunnels and original ECLSS calculations. FPS teleport has a support/heading regression test. Browser artifacts are `docs/screenshots/ova-*.png`; browser actions use real controls and the preserved advanceTime/render_game_to_text hooks. See progress.md for final run results and remaining limits.

Final validation: **23 test files / 106 tests passed**, production build passed (existing large Three.js chunk advisory only). Full browser control flow passed without console/page errors. Ten original/integrated screenshots were inspected. `scripts/ova-qa.mjs` preserves the real-control walkthrough; it uses the same installed skill Playwright import as `scripts/render-qa.mjs`, :5175, one browser, SwiftShader and 120 s capture timeouts.

The source rover's three transmitting lens materials are adapted in `assets.mjs` to ordinary translucent glass; the original GLB remains byte-identical. This removes the extra scene-refraction pass. A representative ladder view fell from 1,761 to 1,186 render calls and from 1.62 M to 1.07 M submitted triangles (including shadow passes). These are render counters, not a hardware FPS benchmark.


> **2026-11-14 22:15 — superseded.** İhan pushed his readable source (NASAYarismasi/-lhan a7d5ce6). The game now uses it from `src/colony/ihan/`; the recovered `src/colony/ova/` modules were removed.
