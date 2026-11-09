# Animations are declarative layered generators, not code or frames

Animations are described as data: a shared loop, up to six layers (raised from three so the ring's halves can each hold several) (`normal`/`add` blending with opacity), and each layer is either a parameterised generator (`solid`, `bands`, `pulse`, `chase`, `sparkle`, `noise`) or a sequence of color-stop keyframes with `linear`/`ease-in-out`/`step` easing. This keeps a mode's animation small enough for MQTT and NVS, independent of LED count, and reproducible identically by the browser preview and the firmware, so new animations eventually need no firmware flash.

## Considered Options

- **JS code per animation**: most flexible, but the ESP32 cannot run it, and baking it to frames gives up the small, count-independent format. We dropped it.
- **Per-pixel frames or keyframes**: simple, but payloads grow with LED count and frame count, and break when the strip length changes (24 → 46 → 48 already happened).
- **Hardcoded firmware presets only**: the status quo (`rainbow`, `pulse`, `breathe`); every new animation needs a flash.

## Consequences

- Browser and firmware must implement each generator, blend mode, easing curve, and the seeded pseudo-random/noise functions identically; committed `animations/*.json` files are the reference set.
- Random layers are seeded and loop exactly by default; free-running layers accept that the preview only approximates the lamp.
- Modes embed a full copy of their animation; there is no shared animation library in the config.
- Animations are defined on the lamp's ring: positions wrap (0 = bottom, counterclockwise, 0.5 = top), mirroring is about the vertical axis, and regions mask arcs rather than remapping them. Firmware must use the same geometry.
