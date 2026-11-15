# First Colony on Mars

**NASA Space Apps 2026 · Sivas**

An interactive 3D browser game connecting Earth launch, interplanetary flight, Mars landing and a colony for three astronauts.

## Play locally

Install Node.js 24 or later, then run:

```sh
npm install
npm run dev
```

Open the local address printed by Vite. Select **New Game**, choose an astronaut and select a mission chapter.

- **Main menu:** `index.html`
- **Flight:** `flight.html?bolum=kalkis`
- **Mars colony:** `colony.html`

This repository contains the complete source and game assets. No account or paid service is needed to run the core game. GitHub displays the source; it does not execute the game on this repository page.

## Explore the colony

Manage solar power, batteries, water extraction and recovery, oxygen production, and greenhouse lighting and irrigation. Explore the habitat and greenhouse through airlocks. Monitor and recall an autonomous rover. Facility tablets display live readings and controls.

**Controls:** WASD to move, Shift to sprint, hold the left mouse button and drag to look, E to interact while looking at a target, Tab for the tablet, Esc for settings, L for the headlamp. Fullscreen is available from the menu settings, F11 or Alt+Enter where the browser permits it.

The interface is in English. The optional local KERK AI advisor remains in Turkish and requires a separately running Ollama instance; the rest of the game works without it.

## Science and assumptions

NASA references inform orbital flight, the Martian environment, crew consumption and technology explanations. The colony currently models 3 banks of 9 MOXIE modules: 162 g O2/hour at 8.1 kW when fully powered. Existing daylight and storage limits still apply. Greenhouse biological oxygen outputs are estimates, not validated life-support performance. Conceptual hardware and simplified models are educational game assumptions.

See [asset sources and licenses](ASSETS.md), [physics documentation](docs/PHYSICS.md), and [detailed original technical notes](README-technical-tr.md). The original notes describe earlier configurations and remain for development context. NASA endorsement is not claimed.

## Validation

```sh
npm test
npm run build
npm run preview
```

Submission snapshot: **186 passing tests** and a successful production build.

## Team

- **Emre:** launch, flight and Mars landing
- **İhan:** colony systems and resource management
- **Samet:** integration, interface and demo
