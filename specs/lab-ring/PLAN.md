# Plan: Lab on the ring

> Source: [PRD](PRD.md)

## Architectural Decisions

- **Coordinates**: LED `i` of `n` at `i / n`, 0 = bottom, counterclockwise, 0.5 = top; all spatial maths wraps.
- **Layer fields**: `mirror: boolean` (required), `region?: { from, to, softness }`.
- **Generator context**: cycles, periodic, cycle length in ms, mirrored.

---

## Phase 1: Ring geometry and preview

**User stories**: 1, 2, 3, 4

- [x] LED positions at `i / n`; `noise` tiles with an integer scale; keyframe stops wrap
- [x] Ring preview with an outward halo, plus the unrolled strip with position labels
- [x] Tests: seamless at position 1 → 0 for every generator and for keyframes

## Phase 2: Mirror and regions

**User stories**: 5, 6

- [x] Mirror toggle and region presets/custom in the layer editor
- [x] Tests: mirror symmetry; region inside/outside/soft edge/wrapping arc; format validation

## Phase 3: `noise` contrast

**User stories**: 7

- [x] `contrast` parameter; a pool caustics reference animation

## Phase 4: `strike`

**User stories**: 8

- [x] Lightning with flickers and afterglow, a random or top origin; tests; a reference animation

## Phase 5: `drops`

**User stories**: 9

- [x] Falling particles with speed variation and tails; tests; a rain reference animation

## Phase 6: `ripple`

**User stories**: 10

- [x] Waves spreading both ways and fading; tests; a reference animation
