# Plan: Lab on the ring

> Source: [PRD](PRD.md)

## Architectural Decisions

- **Coordinates**: LED `i` of `n` at `i / n`, 0 = bottom, counterclockwise, 0.5 = top; all spatial maths wraps.
- **Layer fields**: `mirror: boolean` (required), `region?: { from, to, softness }`.
- **Generator context**: cycles, periodic, cycle length in ms, mirrored.

---

## Phase 1: Ring geometry and preview

**User stories**: 1, 2, 3, 4

- [ ] LED positions at `i / n`; `noise` tiles with an integer scale; keyframe stops wrap
- [ ] Ring preview with an outward halo, plus the unrolled strip with position labels
- [ ] Tests: seamless at position 1 → 0 for every generator and for keyframes

## Phase 2: Mirror and regions

**User stories**: 5, 6

- [ ] Mirror toggle and region presets/custom in the layer editor
- [ ] Tests: mirror symmetry; region inside/outside/soft edge/wrapping arc; format validation

## Phase 3: `noise` contrast

**User stories**: 7

- [ ] `contrast` parameter; a pool caustics reference animation

## Phase 4: `strike`

**User stories**: 8

- [ ] Lightning with flickers and afterglow, a random or top origin; tests; a reference animation

## Phase 5: `drops`

**User stories**: 9

- [ ] Falling particles with speed variation and tails; tests; a rain reference animation

## Phase 6: `ripple`

**User stories**: 10

- [ ] Waves spreading both ways and fading; tests; a reference animation
