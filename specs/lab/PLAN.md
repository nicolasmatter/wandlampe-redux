# Plan: Lab — animation test page

> Source: [PRD](PRD.md)

## Architectural Decisions

Durable decisions that apply across all phases:

- **Route**: the Lab is a second Vite entry in `web/`, served at `/lab.html`. It has no MQTT, and the controller is untouched.
- **Engine**: a pure `render(animation, time, ledCount) → RGB[]` with no DOM or React. The preview applies brightness, gamma and glow on top of it.
- **Format**: parse unknown JSON → `Animation` or errors; serialize back. The schema is `{ version, name, loopMs, layers[1..3] }`. A layer is `{ blend: normal|add, opacity 0–1, speed 0.5|1|2|4, hidden }` plus either `{ generator, params, seed?, freeRunning? }` or `{ keyframes: [{ at 0–1, easing: linear|ease-in-out|step, edge: smooth|hard, stops: [{ position 0–1, color }] }] }`.
- **Generators**: `solid`, `bands`, `pulse`, `chase`, `sparkle`, `noise`. All positions and widths are relative to the strip (0–1).
- **Storage**: `animations/*.json` at the repo root, written only through a dev-server API. The deployed Lab uses download/upload. Local storage keeps the current work.
- **Defaults**: 46 LEDs, glow on.
- **Tests**: Vitest, behavior-level, covering only the engine and the format.

---

## Phase 1: First working Lab

**User stories**: 1, 6, 11, 27

### What to build

Opening `/lab.html` shows a 46-LED strip playing a one-layer `solid` animation with an editable loop length and color, and play/pause. The engine and a minimal format parser exist with their first tests. The current animation survives a page reload.

### Acceptance criteria

- [x] `/lab.html` works in dev and in the production build; the controller is unchanged
- [x] Vitest runs via an npm script; engine tests cover `solid` and loop seamlessness
- [x] Editing the color or loop length updates the preview live
- [x] Reloading restores the last animation from local storage
- [x] `npm run build` and the tests pass

---

## Phase 2: Preview realism

**User stories**: 2, 3, 4, 5

### What to build

Preview controls: LED count (46 by default), brightness scaled like FastLED, gamma correction, a glow toggle (on by default), and a scrubber across the loop while paused.

### Acceptance criteria

- [x] Changing the LED count re-renders without changing the animation
- [x] Brightness 0 shows black, and 255 shows the engine output gamma-corrected
- [x] Glow toggle blurs neighbouring LEDs visually
- [x] Scrubbing shows the exact frame for that time

---

## Phase 3: `bands` and `pulse`

**User stories**: 12, 13

### What to build

A generator picker on the layer, with parameter editors for `bands` (2–8 color stops, smooth/hard edges, repeat, scroll) and `pulse` (color, min/max, sine/sharp).

### Acceptance criteria

- [x] A rainbow, a wave and hard stripes can each be built with `bands`
- [x] Breathe-like and sharp pulses can be built with `pulse`
- [x] Tests cover count independence for `bands`, and the loop and min/max properties for `pulse`

---

## Phase 4: Layers

**User stories**: 7, 8, 9, 10

### What to build

A layer stack of up to three layers, with blend mode, opacity, speed multiplier, and reorder, duplicate, hide and remove.

### Acceptance criteria

- [x] A fourth layer can't be added
- [x] Tests cover `normal` vs `add` blending, opacity, hidden layers, and seamless loops at each speed
- [x] Reordering changes the composite as expected

---

## Phase 5: `chase`

**User stories**: 14

### What to build

A `chase` generator with color, width, tail, count, direction and bounce.

### Acceptance criteria

- [x] Comets with tails, multiple dots, and bouncing all work
- [x] Tests cover position over time, and that bounce is seamless at the loop boundary

---

## Phase 6: Random generators

**User stories**: 15, 16, 17, 18, 19

### What to build

`sparkle` and `noise`, driven by a seeded pseudo-random source and loopable noise, with a reseed button and a free-running toggle.

### Acceptance criteria

- [x] For seeded layers, the same seed gives identical output, and t=0 equals t=loop
- [x] Reseeding visibly changes the pattern
- [x] Free-running layers don't repeat at the loop boundary, and the Lab marks them as approximate
- [x] Fire-like and water-like effects are achievable with `noise`

---

## Phase 7: Keyframe layers

**User stories**: 20, 21, 22, 23

### What to build

A keyframe layer type: a timeline to add, move and delete keyframes; a strip editor to place, drag, recolor and delete stops; and per-keyframe easing and edge settings.

### Acceptance criteria

- [x] Colors and stop positions interpolate between keyframes
- [x] Tests cover `linear`, `ease-in-out`, `step` (holds until the next keyframe), and wrap-around from the last keyframe to the first
- [x] Keyframe layers combine with generator layers via blending

---

## Phase 8: Saving

**User stories**: 24, 25, 26, 28

### What to build

Full format validation with readable errors. A dev-server API to list, open and save `animations/*.json`. Download/upload on the deployed Lab. A few reference animations committed, and parsed in tests.

### Acceptance criteria

- [x] In dev, save writes `animations/<name>.json`, and open lists and loads the files
- [x] The production build has no save API; download/upload works instead
- [x] Invalid files show specific errors and don't replace the current animation
- [x] Tests: valid files round-trip unchanged; invalid shapes are rejected; all committed animations parse
