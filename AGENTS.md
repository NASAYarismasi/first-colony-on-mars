# AGENTS.md — Mars'a İlk Koloni (NASA Space Apps 2026, Space Mission Design Game)

Team of 3: Emre (flight: launch → orbit → transfer → Mars EDL), İhan (Mars colony & resources), Samet (integration, UI, final demo). UI text is Turkish; code, identifiers and comments are English.

## Stack
- Vite + Three.js (ES modules, plain JavaScript with JSDoc types). Vitest for tests.
- Units: SI everywhere in simulation code (m, s, kg, N, rad). Convert only at the UI layer (km, km/s, t, °).
- Rendering: metres, Y-up. Large distances use a floating origin / scaled scenes — never put raw 1e11 m coordinates into Three.js.

## Architecture (keep these boundaries)
- `src/sim/` — pure physics & mission logic. **No Three.js, no DOM.** Deterministic, fixed-timestep, fully unit-tested.
- `src/data/` — vehicle/planet constants. Every real-world number has a source URL comment; every invented/game value is marked `// GAME ASSUMPTION`.
- `src/render/` — Three.js scenes, cameras, VFX. Reads sim state, never mutates it.
- `src/ui/` — HUD, wrist computer, menus (DOM). Reads sim state, sends commands.
- `src/core/` — game loop, state store, event bus, input, scene manager.
- Shared landing payload (handoff to colony) lives in `src/sim/landingPayload.js`; its shape must match the README JSON. Do not change the shape without team agreement.

## Rules
- Physics must be correct and testable: add/extend tests in `tests/` for every sim change. `npm test` and `npm run build` must pass before you finish.
- Never fake motion with ad-hoc formulas (e.g. `y = k*t^2`) when a sim value exists — render from sim state.
- Dispose Three.js geometries/materials/textures and remove listeners when a scene is torn down.
- Only use assets with a clear licence (NASA public domain, CC0, CC-BY with attribution in `ASSETS.md`).
- Keep `window.render_game_to_text()` and `window.advanceTime(ms)` working (used by automated browser tests).
- Do not commit or push; the orchestrator (Claude) reviews and commits.
