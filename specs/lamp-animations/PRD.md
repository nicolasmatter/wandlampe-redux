# PRD: Lamp plays Lab animations

> Status: draft. Stage 2 of the Lab. Vocabulary: [GLOSSARY.md](../../GLOSSARY.md). Rationale: [ADR 0001](../../docs/adr/0001-declarative-layered-animations.md). Stage 1: [specs/lab](../lab/PRD.md), [specs/lab-ring](../lab-ring/PRD.md).

## Problem Statement

Animations built in the Lab only play in the browser. The lamp still knows three hardcoded animations (`rainbow`, `pulse`, `breathe`), and every new one needs C++ and a flash.

## Solution

The firmware gets a C++ port of the animation engine. A mode of type `animation` embeds a full Lab animation in the retained config. The controller's mode editor picks an animation from the committed set or from an uploaded file, previews it with the shared engine, and publishes it. The hardcoded presets are replaced by equivalent animations. Mode changes crossfade.

## User Stories

### Choosing animations

1. As the lamp owner, I want to pick any committed animation for a mode in the controller, so that good Lab work reaches the lamp without copying files around.
2. As the lamp owner, I want to upload an animation JSON into a mode, so that animations made on the deployed Lab can be used too.
3. As the lamp owner, I want the controller to preview an animation mode with the same engine as the Lab, so that I see what the lamp will show.
4. As the lamp owner, I want invalid animation files rejected in the controller with the Lab's error messages, so that I don't send something broken.
5. As the lamp owner, I want brightness to stay a mode setting, so that the same animation can be dim in one mode and bright in another.

### Playing on the lamp

6. As the lamp owner, I want the lamp to play an embedded animation, so that new animations need no firmware flash.
7. As the lamp owner, I want the lamp to look like the Lab preview, so that I can design in the browser; the lamp has the final say on looks.
8. As the lamp owner, I want an animation to start from its beginning when its mode is selected, so that sequences like sunrise play from the start.
9. As the lamp owner, I want mode changes, including on and off, to crossfade, so that switching feels smooth.
10. As the lamp owner, I want animations to play smoothly at about 60 fps without stuttering when Wi-Fi or MQTT is busy.
11. As the lamp owner, I want the lamp to keep its animations across reboots and OTA updates, so that it works without the broker.

### Migration

12. As the lamp owner, I want existing `rainbow`, `pulse` and `breathe` modes converted to equivalent animations, so that my current config keeps working.
13. As the lamp owner, I want the alarm clock's wake-up glow unchanged.

### Errors

14. As the lamp owner, I want a mode the lamp can't play (unknown generator, newer version, too large) to show black while the other modes still update, so that one bad mode doesn't block the rest.
15. As the lamp owner, I want the lamp to report skipped modes and why on its status topic, and the controller to show it, so that a black mode is never a mystery.

## Implementation Decisions

- **Transport (ADR 0001).** Animations travel inside the single retained `wandlampe/config` message. An `animation` mode becomes `{ type: "animation", brightness, name?, animation: <Lab animation JSON> }`; the old `animation: "rainbow" | "pulse" | "breathe"` string form is legacy.
- **Size.** Firmware MQTT buffer raised to 32 KB; the controller refuses to publish a config larger than that. Committed animations are ≤3.5 KB minified.
- **Persistence.** The firmware stores the last accepted config as a JSON file on the board's existing FAT flash partition (FFat) instead of a fixed struct in NVS, and re-parses it at boot.
- **Firmware engine (deep module).** A C++ port of `render(animation, time, ledCount, clock) → RGB[]` with the same generators, keyframes, easing, blending, mirror, regions, seeded hash and loopable noise as the TypeScript engine. Pure: no Arduino, FastLED or ArduinoJson dependency, so it builds and tests on the host. It uses `float`; looser agreement with the browser is accepted.
- **Firmware animation parser (deep module).** Parses an animation JSON object into the engine's structures, or returns a path-specific error. Mirrors the TypeScript format rules.
- **Config handling.** A bad animation mode is skipped (shown black); other modes apply. Errors are published on `wandlampe/status` as a list of `{ mode, error }`.
- **Playback.** Rendering runs at about 60 fps on its own core, separate from Wi-Fi/MQTT. An animation's loop time starts at 0 when its mode is selected; free-running layers use the uptime clock. Mode brightness is applied with FastLED scaling after the engine. No gamma on the lamp.
- **Crossfade.** Every mode change, including on/off, blends the outgoing and incoming frames over about 300 ms.
- **Presets.** Firmware drops `rainbow`/`pulse`/`breathe`. The controller converts legacy modes to equivalent animations (using the committed `rainbow`/`breathe` files and a new `pulse`) when loading a config. The alarm clock stays as is.
- **Controller.** The mode editor gets an animation picker: the committed `animations/*.json` bundled at build time, plus file upload. Validation and preview reuse the Lab's format module and engine.
- **LED count.** 48, from firmware config; animation files never contain a count.

## Testing Decisions

- Tests exercise public interfaces only.
- **Reference frames.** A script renders every committed animation with the TypeScript engine at several times and LED counts and writes the frames as fixtures.
- **C++ engine** (PlatformIO `native` env): matches the fixtures within ±3 per channel, with up to 2% of samples allowed to differ more (random events firing slightly differently).
- **Firmware config parser** (`native`): valid configs, embedded animations, skipped modes with error messages, legacy short LED arrays.
- **Controller** (Vitest): legacy preset conversion, round trip of a mode with an animation, rejection of invalid or oversized configs.
- Prior art: Vitest engine/format tests in the web app; no firmware tests exist yet.
- No UI tests; final verification is by eye on the lamp.

## Out of Scope

- A "send to lamp" button in the Lab, or MQTT in the Lab
- Streaming frames from the browser
- Changing the alarm clock
- Animation libraries shared between modes (each mode embeds a copy)
- Gamma or color calibration on the lamp
- Bit-exact agreement between browser and lamp

## Open Questions

- Exact crossfade duration; tune on the lamp.
- Whether the controller should also preview on a ring, like the Lab.
