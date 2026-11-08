# PRD: Lab — animation test page

> Status: draft. Vocabulary: [GLOSSARY.md](../../GLOSSARY.md). Rationale: [ADR 0001](../../docs/adr/0001-declarative-layered-animations.md).

## Problem Statement

The lamp only knows three hardcoded animations (`rainbow`, `pulse`, `breathe`). Every new animation means writing C++ and flashing the ESP32, and there is no way to try ideas, compare variations, or see how an animation looks before committing to firmware work.

## Solution

A separate **Lab** page next to the controller where animations are built from layers of generators and keyframes, previewed live on a simulated strip, and saved as JSON files in the repo. The animation format is declarative and LED-count independent, so a later stage can send it to the lamp as part of a mode without a firmware flash per animation.

This PRD covers stage 1 only: the Lab and its animation engine. Firmware and protocol are unchanged.

## User Stories

### Previewing

1. As the lamp owner, I want to see an animation play on a simulated strip, so that I can judge it without touching the lamp.
2. As the lamp owner, I want the preview to default to 46 LEDs and let me pick another count, so that I see the real lamp and can check animations stay correct on other strips.
3. As the lamp owner, I want a brightness slider applied like FastLED applies it, so that dim animations look the way they will on the lamp.
4. As the lamp owner, I want gamma correction and a glow toggle (on by default), so that the preview resembles diffused WS2812B LEDs more than raw screen pixels.
5. As the lamp owner, I want to play, pause, and scrub through the loop, so that I can inspect a specific moment.

### Composing

6. As the lamp owner, I want to set an animation's loop length, so that it repeats seamlessly.
7. As the lamp owner, I want to stack up to three layers, so that I can combine effects like a gradient with sparkles.
8. As the lamp owner, I want to set each layer's blend mode (`normal` or `add`) and opacity, so that I control how layers combine.
9. As the lamp owner, I want to set each layer's speed as ×½, ×1, ×2 or ×4 of the loop, so that layers move at different tempos and still loop seamlessly.
10. As the lamp owner, I want to reorder, duplicate, hide, and remove layers, so that I can experiment quickly.

### Generators

11. As the lamp owner, I want a `solid` generator, so that I have a plain base layer.
12. As the lamp owner, I want a `bands` generator with 2–8 color stops, smooth or hard edges, a repeat count and scrolling, so that I can make rainbows, waves, stripes and shifting gradients.
13. As the lamp owner, I want a `pulse` generator with color, min/max brightness and a sine or sharp curve, so that I can make breathing and pulsing effects.
14. As the lamp owner, I want a `chase` generator with color, width, tail, count, direction and bounce, so that I can make moving dots and comets.
15. As the lamp owner, I want a `sparkle` generator with color, density and fade time, so that I can add twinkles.
16. As the lamp owner, I want a `noise` generator with color stops, scale and speed, so that I can make organic effects like fire or water.
17. As the lamp owner, I want random layers (`sparkle`, `noise`) to use a seed and repeat exactly every loop by default, so that the preview matches what the lamp will show.
18. As the lamp owner, I want to reseed a random layer, so that I can try variations.
19. As the lamp owner, I want to mark a random layer as free-running, so that slow organic effects never visibly repeat.

### Keyframes

20. As the lamp owner, I want a keyframe layer where each keyframe is a set of color stops at a point in the loop, so that I can design custom color movements.
21. As the lamp owner, I want to add, move, and delete keyframes on a timeline, so that I can shape the sequence.
22. As the lamp owner, I want to place, drag, recolor and delete color stops on a keyframe, so that I can edit it directly on a strip.
23. As the lamp owner, I want to choose `linear`, `ease-in-out` or `step` easing into the next keyframe, so that transitions feel right or cut hard.

### Saving

24. As the lamp owner, I want to name an animation and save it to the repo's `animations/` folder while running the dev server, so that good animations are versioned and become reference fixtures.
25. As the lamp owner, I want to open any animation from `animations/` in the dev server, so that I can keep editing it.
26. As the lamp owner, I want to download and upload animation JSON on the deployed Lab, so that I can work without the dev server.
27. As the lamp owner, I want my current work kept in local storage, so that a reload doesn't lose it.
28. As the lamp owner, I want invalid files rejected with a clear message, so that I don't silently load broken animations.

## Implementation Decisions

- **Separate entry point.** The Lab is a second Vite entry in `web/`, deployed at `/lab.html`. It shares components and utilities with the controller but has no MQTT connection and does not change the controller.
- **Animation engine (deep module).** A pure function `render(animation, time, ledCount) → RGB[]` encapsulating loop timing, layer speed multipliers, all generators, keyframe interpolation and easing, the seeded pseudo-random and loopable noise, blending and opacity. It has no DOM or React dependency. The preview, any future streaming, and the stage-2 firmware port all treat it as the reference.
- **Brightness and gamma are outside the engine.** The engine outputs the animation's colors; the preview applies brightness (matching FastLED scaling), gamma and glow. In a mode, brightness stays a mode property.
- **Animation format (deep module).** It parses and validates unknown JSON into an `Animation` or a list of errors, and serializes back. The schema:
  - `version`, `name`, `loopMs`
  - `layers`: 1–3, each with `blend` (`normal` | `add`), `opacity` (0–1), `speed` (0.5 | 1 | 2 | 4), `hidden`, and either `generator` + `params`, or `keyframes`
  - random generators add `seed` and `freeRunning`
  - `keyframes`: each has `at` (0–1 of the loop), `easing` (`linear` | `ease-in-out` | `step`), and `stops` (≥1 `{ position 0–1, color }`), with `edge` (`smooth` | `hard`)
  - All positions and widths are relative to the strip (0–1). Colors are 8-bit RGB.
- **Seamless looping.** For any animation that isn't free-running, render at `t = 0` equals render at `t = loopMs`. Noise is sampled on a closed path so it wraps.
- **Free-running layers** use the wall-clock time instead of loop time, and a non-fixed seed. The engine stays pure because time and seed are inputs.
- **Dev-only save API.** A small Vite dev-server plugin lists, reads and writes `animations/*.json` at the repo root. The production build doesn't include it; the Lab detects its absence and falls back to download and upload.
- **LED count** is a Lab setting, 46 by default, in shared config. Animation files never contain a count.
- **Relation to modes (stage 2, informative).** A mode will embed a full copy of an animation; there's no animation library in the config.

## Testing Decisions

- Add Vitest to `web/`; there is no existing test setup or prior art.
- Tests exercise behavior through public interfaces only: `render` and parse/serialize. They don't test private helpers.
- **Engine tests:**
  - Loop seamlessness
  - Determinism for a fixed seed
  - Count independence: the same animation at 24 and 46 LEDs samples consistently at matching relative positions
  - Each generator's defining property, such as `solid` being uniform and `step` easing holding until the next keyframe
  - `normal` vs `add` blending and opacity
  - Hidden layers have no effect
  - Speed multipliers
- **Format tests:** valid files round-trip unchanged; each invalid shape is rejected with a useful error, such as too many layers, an out-of-range position or an unknown generator.
- The committed `animations/*.json` files are parsed in tests, so a broken fixture fails CI.
- No UI tests.

## Out of Scope

- Firmware changes, a firmware animation player, and new MQTT topics or payloads (stage 2)
- Streaming frames to the real lamp
- Sending animations to the lamp, or using them in the controller's modes
- Code-based (JS) animations
- Per-pixel painting or per-LED keyframes
- Blend modes other than `normal`/`add`, more than three layers, and custom easing curves
- Calibrating the preview colors against the real LEDs
- Authentication for the deployed Lab

## Open Questions

- Exact parameter ranges and defaults per generator; to be tuned while building.
- Maximum serialized size for an animation, once stage 2 knows the MQTT and NVS limits.
- Whether to port the controller's existing `rainbow`/`pulse`/`breathe` presets to engine-based animations once stage 2 exists.
