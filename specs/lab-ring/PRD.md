# PRD: Lab on the ring — geometry, mirror, regions, new effects

> Builds on [Lab PRD](../lab/PRD.md). Vocabulary: [GLOSSARY.md](../../GLOSSARY.md). Rationale: [ADR 0001](../../docs/adr/0001-declarative-layered-animations.md).

## Problem Statement

The lamp's strip is a ring mounted flat on the wall, with LEDs facing outward onto the wall. The Lab treats it as a straight line: `noise` and keyframes show a seam where the strip's ends meet, the preview doesn't look like the lamp, and effects that depend on up and down (rain, lightning, a rising sunrise) or on halves of the ring can't be expressed.

## Solution

Treat every animation as a ring. Preview it as the lamp looks on the wall. Add per-layer mirroring and regions, a contrast control for `noise`, and three new effects: `strike` (lightning), `drops` (rain) and `ripple`.

## User Stories

1. As the lamp owner, I want every effect to wrap around the ring without a seam.
2. As the lamp owner, I want the preview to show a ring with LED 0 at the bottom and counterclockwise order, so it matches the lamp.
3. As the lamp owner, I want an outward-only halo around the ring preview, on by default, so I see the light on the wall.
4. As the lamp owner, I want an unrolled strip under the ring, marked bottom/right/top/left, so I can relate editor positions to the ring.
5. As the lamp owner, I want to mirror a layer, so it runs from bottom to top identically on both sides.
6. As the lamp owner, I want to limit a layer to a region such as the top or bottom half, with an optional soft edge, so different halves can show different effects.
7. As the lamp owner, I want a contrast control on `noise`, so I can make crisp caustic lines for pool refraction.
8. As the lamp owner, I want a `strike` generator with random flickering strikes and an afterglow, so I can make lightning.
9. As the lamp owner, I want a `drops` generator with particles falling toward the bottom, so I can make rain, snow and meteors.
10. As the lamp owner, I want a `ripple` generator with waves spreading both ways from random spots, so I can make drops landing on water.

## Implementation Decisions

- **Ring coordinates.** LED `i` of `n` sits at position `i / n`: LED 0 at the bottom, counterclockwise as you face the lamp, 0.5 at the top. All spatial maths wraps at 1.
- **Seamless `noise`.** The spatial lattice tiles around the ring, so `scale` becomes an integer. `contrast` (0.5–8) stretches values around the middle.
- **Wrapping keyframe stops.** Before the first stop, colors blend from the last stop around the ring. Hard edges hold the previous stop's color, counting around the ring.
- **Mirror.** An optional `mirror` boolean per layer. A mirrored layer is rendered along a half-ring coordinate, 0 at the bottom and 1 at the top, and shown identically on both sides.
- **Regions.** An optional `region: { from, to, softness }` per layer. It covers the arc from `from` counterclockwise to `to` and masks the layer outside it; `softness` (0–0.5) fades it in from the edges. Regions mask; they do not remap, so the layer still renders across the full ring. Presets in the Lab: whole, top, bottom, left and right halves.
- **Random generators** (`strike`, `drops`, `ripple`) follow the `sparkle`/`noise` rules: seeded and looping by default, with an optional free-running mode. Timings that should feel physical, such as lightning flicker, are in milliseconds; the engine passes the layer's cycle length to generators.
- **`strike`:** color, rate (expected strikes per cycle), maximum flickers, width, afterglow (ms), origin (`random` or `top`).
- **`drops`:** color, rate (an integer number of drops per cycle), speed (ring lengths per cycle), speed variation, length. Drops fall toward position 0.
- **`ripple`:** color, rate (an integer number of ripples per cycle), speed, width, lifetime (in cycles).
- **Preview.** A canvas ring with an outward-only halo replaces the glow toggle. The unrolled strip stays below it.
- **Layer limit** is four (previously three), so each half can hold two layers.
- **Format** stays at version 1. `mirror` is required on every layer. `noise` gains `contrast`. Committed animations are updated.

## Testing Decisions

- Every generator, mirrored or not, is seamless across position 1 → 0.
- A mirrored layer gives equal colors at positions `x` and `1 − x`.
- Regions: zero outside the arc, full inside, a softness ramp at the edges, and correct behavior for arcs that wrap through 0.
- Keyframe stops wrap.
- The new generators are deterministic per seed, loop seamlessly, and each has its defining behavior: strikes are mostly dark and flash; drops move toward 0; ripples spread symmetrically from their center.
- Format: new fields are validated.

## Out of Scope

- Regions that remap a layer onto an arc, and nested layer stacks per region.
- Any firmware or MQTT change.

## Open Questions

- Resolved: the layer limit is raised from three to four, so each half can hold two layers.
