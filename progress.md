Original prompt: tamam hadi başlayalım. gözle görülür bişey oluşsun. geliştirelim

## Task 3 — Reviewer polish pass (2026-11-14)

- Request: fix eleven visual/UI issues, regenerate and critically inspect every render-QA PNG; no physics constant changes or commits.
- Baked a permanent reclined seated NASA suit derivative with Blender CLI; retained the original GLB and reproducible `scripts/pose-crew.py`. Camera 2 now sees all three faces, bent knees, lowered arms, fitted seat backs, restraints and footrests.
- Stage silhouette follows actual attached SRB/core/LAS state, then upper stack, transit and lander. Apsis UI handles suborbital/open trajectories without changing sim values. Timeline/system labels are Turkish.
- Clearer Florida sky/fog, stronger engine/pad/smoke lighting and visible Atlantic horizon. Identified dashed row as subpixel lightning-protection wire triangles; removed those wires. Corrected upper-stack origin/nozzle offset after core separation.
- Added a 4096² NASA BMNG Florida/Atlantic region from the public-domain 500 m B1 tile (download/crop script and ASSETS attribution), fixed launch-longitude alignment, increased sphere tessellation and added near-surface procedural detail/normal contribution. Clouds use seeded multiscale texture at 10.5 km with parallax/drift.
- Distinct faceted human Mars lander with entry aeroshell, four exposed bell nozzles, persistent SRP-triggered gear, hatch/ladder, existing plumes and dust.
- Cruise map: full dashed transfer ellipse, solid completed arc, arrival ring, screen-space label collision checks and legend. Fixed deterministic rendering at alpha=1 so analytical coast jumps display current ship/planet positions; RAF interpolation remains.
- Added cinematic title/start menu, controls, about/sources/team screen and Q wrist device. Wrist days use current supply kg / actual crew consumption; power comes from the new sim telemetry boolean (explicit game assumption, no electrical load model). Landing payload/flight dynamics/constants remain unchanged.
- Expanded QA with title/about/help, Q early/late resource displays, both separations, departure conjunction and rendered-time assertions. First full browser pass passed with no errors; visual inspection prompted seat/camera, wire, map-time and Earth corrections. Latest 42 tests and production build pass; final production-preview QA and per-image review are underway.

## Task 2 — Rendering rebuild (2026-11-14)

- Requested professional sim-driven renderer, LC-39B, planetary textures, staging/VFX, six cameras, cabin, Turkish HUD, WebAudio, quality settings and eight verified screenshots; no commits.
- Replaced legacy render monoliths with scene lifecycle manager, double-precision floating-origin radial frame, log depth, ACES/sRGB, bloom/FXAA/grain/vignette; metre-scale NASA SLS mesh split into stages.
- Added tested pure terminal countdown / ballistic detached hardware; exposed existing physics ambient pressure / density / thrust / heat flux. Existing flight dynamics and landing payload are unchanged.
- Implemented pad, Earth/Mars, atmosphere, seated cabin crew/dashboard, pressure-expanding six-engine plumes, world-anchored smoke, plasma, terrain, six cameras, maps, HUD, audio and controls. First build and 36 tests pass. Browser QA and visual corrections underway.
- Assets: official NASA Blue Marble July / Black Marble downloaded via assets.science.nasa.gov; NASA SVS star-map preview downloaded. USGS direct download blocked; trying a public-domain mirror before recording a procedural fallback.

### Task 2 completion notes

- Final assets: 4K NASA Blue Marble July, 3.6K NASA Black Marble, 4K NASA/JPL/USGS Viking MDIM via Planetary Society public-domain mirror, full 4K NASA SVS EXR converted to JPEG. Eight OFL Barlow fonts are hosted locally. ASSETS.md records all shipped files, credits, processing and optional cloud/DEM gaps. Source/assets/screenshots are about 21.3 MiB, excluding dependencies/build/test scratch output.
- Visual QA corrected globe/local-ground occlusion, long-lens LOD selection, upper-atmosphere shell clipping, cabin horizon and T-pose, flat-edged exhaust, stage propellant HUD after LEO, cruise exterior distances, Mars retro plume offset and plasma capture threshold. Plumes now use soft shader billboards; SRB smoke emission samples originate in the fixed loop.
- Pure countdown and ballistic separation physics, snapshot/interpolation and EDL thrust-inclusive proper acceleration are covered by tests. Final npm test: 10 files / 39 tests pass; production build passes (Three.js chunk-size advisory remains). Landing payload shape and main flight dynamics are unchanged.
- Global develop-web-game Playwright client ran on the dev server. Full command-only Playwright QA uses SwiftShader on preview :5177, checks cameras/drag/zoom, help, pause, quality, mute, manual cut/full/held throttle, warp guards, all real mission phases, landing payload and reset. Screenshots + corresponding SI telemetry are in docs/screenshots; no phase/position injection is used. Final browser run after the exhaust correction passed with an empty browser-errors.json; touchdown was 1.50 m/s. All requested frames were visually inspected and corrected.
- Known limits: approximate LC-39B/cabin/seated suit deformation and concept lander, procedural clouds and unsurveyed terrain, approximate rim atmosphere and sprite particles, no detailed exterior NTR model, original patched-conic TMI/MOI approach. 60 FPS is a target, not verified on real midrange laptop hardware; software rendering ran around 19–25 FPS in representative views. No commits or pushes.
- Next integration: use window.missionControl commands / render_game_to_text or import bootstrap and the core store pattern; landingPayload.js contract is unchanged. Optional future work: surveyed Mars DEM, high-resolution cloud/ocean masks, rigged crew, volumetric scattering, NTR exterior and actual laptop GPU profiling. Controls and architecture are documented in README.md and docs/RENDERING.md.

- SLS, Orion ve NASA astronot modelleriyle 3D kalkış ve kabin prototipi.
- Sırada Mars inişi, ortak iniş verisi ve koloni kaynakları.

- Playwright ile GLB yükleme, kalkış ve transfer geçişi kontrol edildi. NASA astronot modeli yerel Draco çözücüsü ile yükleniyor.
- Birinci şahıs kamera, WASD, klavyeyle bakış, mesafeye bağlı E etkileşimi, kabin güç görevi ve Q ile kol bilgisayarı eklendi. Playwright yürüyüş, panel mesafesi, kalkış, güç ve sıfırlamayı doğruladı.
- Dış, kabin ve rota kameraları, egzoz, hesaplanan Hohmann transferi ve temsili Mars inişi eklendi. Playwright kamera, duraklatma ve tam uçuş akışını doğruladı.

## Task 1 — Foundation (2026-11-14)

- Request: replace fake launch/timed phases with deterministic 50 Hz physics, architecture boundaries, real SLS data, atmospheres, orbital mechanics, Hohmann transfer, lifting Mars EDL, mission/consumables and README landing payload; meaningful Vitest tests and Turkish PHYSICS.md; no visual polish or commits.
- Added core loop/store/rebindable input; pure sim modules; sourced SLS/Orion and explicit transit/lander assumptions. Moved Three.js into src/render and HUD into src/ui. Removed src/flight.js and fixed-duration phase animation. main.js is the application composition root.
- Reference ascent: max-Q 56.58 s / 29.008 kPa; SRB separation 126.02 s; insertion 469.02 s into 180.04 x 195.87 km; max 3.8006 g. Core shuts down early by guidance; approximately 49.3 t remains in discarded core. Approximate SRB envelope leaves ~2.2 t residual.
- Standalone EDL: touchdown 1.5003 m/s, ~4.96 t propellant remaining. Full mission including deorbit: ~4.39 t. Gross 3-crew metabolic consumption over 259 d: 652.68 kg oxygen, 2735.04 kg water, 481.74 kg food.
- Important source discrepancy: actual NASA Glenn Mars fit gives 0.01503 kg/m³ surface density, not generic 0.020. Test verifies the published equation; docs explain the difference.
- Browser client from develop-web-game skill ran. Full separate Playwright flow also passed launch, safe warp, orbit, pause, cabin power/watch, TMI, actual ~259 d cruise consumption, MOI warp downgrade, deorbit/EDL, landing payload, reset; no new console/page errors. Screenshots inspected under ignored output/.
- Fixed initial RAF negative delta under virtual-time tooling, deterministic advanceTime request completion, and high-warp residual time safety at engine ignition.
- Next task: visuals only. Existing Orion GLB temporarily represents the Mars lander; planet/landing visuals remain scaled. Finite TMI/MOI trajectory integration, real ephemerides, 3D inclination, weather, heat-shield sizing, terrain and closed-loop life support remain out of scope. Patched-conic maneuver fuel/time and ideal engines are documented assumptions, not validated hardware.
- Controls: B starts TMI in parking orbit or deorbit in Mars orbit; MOI starts at calculated arrival; T cycles allowed warp, P pauses. README JSON shape unchanged; 1 supply game unit = 1 whole-crew day for that resource.
- Final verification: 8 Vitest files / 33 tests passed; npm run build passed (existing Three.js bundle-size advisory only); git diff --check passed. Latest full browser run passed with no errors. No commit or push performed. Dev server for this session is http://127.0.0.1:5175/.

## KERK and live colony systems (2026-11-15)

- Renamed the tablet to KERK and added live electricity overview and detailed consumption. The live grid now starts from the landing payload, uses the scene sun, and accounts for storage, devices, cabling, conversion, unused PV, maintenance and rover charging.
- Initialized lighting before the first visible scene frame and deferred the first local dust front past the arrival window. Habitat and greenhouse airlocks use manual walk-through passages after the pressure interlock.
- Full water and MOXIE reserves stop production. Greenhouse lighting follows sunset and sunrise, with irrigation running by default. Live resource stocks advance only through the microgrid during sol changes.

- Verification: 178 Vitest tests across 37 files, production build and diff check passed. Playwright exercised the first frame, KERK energy panel and forecast, both ways through both airlocks, and automatic lighting through sunset and sunrise. Browser errors: none.

## KERK light display and NASA source audit (2026-11-15)

- Alt, Q and Tab open KERK on the surface. Esc opens a paused surface settings dialog with audio, headlamp, day/night and flight navigation. Transfer starts from the nominal mission at TMI cutoff.
- Relabeled the three physical MOXIE bank displays. Rebuilt the walking and seated EVA suits from the original NASA-published mesh without cutting the joints. Rendered KERK’s gloves in Blender from the same original geometry.
- Added NASA sources to KERK applications and docs/NASA-KAYNAKLARI.md. Verified the exact consumable values against NASA Ames Table 1 and used NASA GISS’s Octavia E. Butler landing coordinates for the surface sun.

## Samet menu and handheld controls (2026-11-15)

- Connected Samet's menu, Mars backdrop and portraits to launch, transfer, landing and colony. The root opens the main menu, and the selected astronaut controls the colony start.
- Added Auto, Manual On and Manual Off greenhouse LED modes, clean water irrigation metering, and a shared automatic/manual solar sweep cycle with a single energy debit. Kept the tablet footer out of the content area and shortened the surface toggle to Esc.

- Verification: 183 Vitest tests passed. Playwright exercised the production main menu, settings, portrait choice, transfer and colony links, manual/automatic LED controls, irrigation water balance and the full manual sweep. Browser errors: none.

- Flight entry hides the legacy chapter card before asset loading when entered through a selected chapter. The launch countdown, transfer and Mars orbit start were checked with the SLS asset deliberately held in the browser.

- Hid the landing CTA during normal touchdown and kept a retry only for a storage failure. Playwright flew the Mars landing and confirmed automatic colony navigation received the exact flight payload.

## KERK field analysis (2026-11-15)

- Slowed the shared manual/automatic solar sweep to about 3.7 seconds at normal speed. Animated airborne dust and added warmer diffuse lighting without changing the PV weather model.
- Added radiation, on-demand game-frame analysis and local Ollama tabs. The dosimeter integrates Gale RAD reference rates on the Mars simulation clock with explicit game shielding. The field tablet sends summarized telemetry and optional image metrics to local Ollama.
