# Plan: Lamp plays Lab animations

> Source: [PRD](PRD.md)

## Architectural Decisions

Durable decisions that apply across all phases:

- **Transport**: animations ride inside the single retained `wandlampe/config` message. Animation mode: `{ type: "animation", brightness, name?, animation: <Lab animation JSON> }`. The string form `animation: "rainbow" | "pulse" | "breathe"` is legacy and converted by the controller.
- **Limits**: config ≤ 32 KB (firmware MQTT buffer and controller check); 48 LEDs.
- **Persistence**: last accepted config stored as JSON on the existing FAT flash partition (FFat), re-parsed at boot.
- **Engine**: C++ port of `render(animation, time, ledCount, clock) → RGB[]`, pure (no Arduino/FastLED/ArduinoJson), `float` math, testable in a PlatformIO `native` env.
- **Reference**: fixtures of frames rendered by the TypeScript engine for every committed animation; C++ must match within ±3 per channel, ≤2% of samples allowed beyond.
- **Errors**: bad animation mode is skipped (black); `wandlampe/status` carries `errors: [{ mode, error }]`.
- **Playback**: ~60 fps, loop time starts at 0 on mode select, free-running layers use uptime, ~300 ms crossfade on every mode change.

---

## Phase 1: Engine port tracer

**User stories**: 6, 7

### What to build

A pure C++ engine on the host that renders `solid` and `bands` layers, a script that exports reference frames from the TypeScript engine, and a native test comparing the two.

### Acceptance criteria

- [x] Reference-frame export script runs from `web/` and writes fixtures for chosen animations, times and LED counts
- [x] PlatformIO `native` test env builds the engine without Arduino
- [x] `solid` and `bands` animations match their fixtures within tolerance
- [x] Firmware builds for the board unchanged in behavior

---

## Phase 2: Lamp plays an embedded animation

**User stories**: 6, 8, 11

### What to build

The firmware accepts the new animation mode shape, parses the embedded animation into engine structures, and plays it at ~60 fps from t=0 on mode select. The MQTT buffer grows to 32 KB and the config persists as a file in flash.

### Acceptance criteria

- [ ] A hand-published config with a `solid`/`bands` animation mode plays on the lamp
- [ ] Config survives reboot and OTA; first boot after this change falls back to the retained MQTT config
- [x] Native tests cover parsing an animation mode and a 30 KB config
- [ ] Other mode types behave as before

---

## Phase 3: All generators and keyframes

**User stories**: 6, 7

### What to build

Port `pulse`, `chase`, `sparkle`, `noise`, `strike`, `drops`, `ripple`, the seeded hash and loopable noise, keyframe layers with easing and edges, speeds and free-running.

### Acceptance criteria

- [x] Fixtures for single-region committed animations pass
- [x] Parser rejects unknown generators and out-of-range values with path-specific errors
- [ ] Free-running layers run on the lamp without repeating at the loop

---

## Phase 4: Mirror, regions and blending

**User stories**: 6, 7

### What to build

Port mirror, regions with softness, `normal`/`add` blending, opacity and up to six layers.

### Acceptance criteria

- [x] Fixtures for every committed animation pass, including the split ones
- [ ] Render time for the heaviest committed animation is measured on the lamp and stays well under a 16 ms frame

---

## Phase 5: Controller animation picker

**User stories**: 1, 2, 3, 4, 5

### What to build

The mode editor's animation type offers the committed animations bundled at build time and JSON upload, validates with the Lab's format module, previews with the shared engine, and publishes the embedded animation.

### Acceptance criteria

- [ ] Picking a committed animation and applying it plays it on the lamp
- [x] Uploading an invalid file shows the Lab's errors and changes nothing
- [x] Publishing a config over 32 KB is refused with a clear message
- [x] Vitest covers the round trip of a mode with an animation and the size check

---

## Phase 6: Preset migration

**User stories**: 12, 13

### What to build

The controller converts legacy `rainbow`/`pulse`/`breathe` modes to equivalent animations on load (new `pulse` animation committed). The firmware drops its preset code.

### Acceptance criteria

- [x] Loading a legacy config shows animation modes that look like the old presets
- [x] Firmware has no preset animation code; alarm clock unchanged
- [x] Vitest covers legacy conversion

---

## Phase 7: Skipped modes and status errors

**User stories**: 14, 15

### What to build

Firmware skips modes it can't play, shows them black, and publishes the reasons on `wandlampe/status`. The controller shows them on the affected modes.

### Acceptance criteria

- [ ] A config with one bad mode applies the others and reports `{ mode, error }`
- [x] The controller marks the bad mode with the lamp's error
- [x] Native tests cover skipped modes and error texts; `docs/mqtt.md` documents the status field

---

## Phase 8: Crossfade and smooth playback

**User stories**: 9, 10

### What to build

Rendering moves to its own core. Every mode change, including on and off, crossfades over ~300 ms.

### Acceptance criteria

- [ ] Switching modes and on/off fades smoothly on the lamp
- [ ] No visible stutter during MQTT reconnects or config updates
- [ ] Alarm clock still rings and dismisses correctly
