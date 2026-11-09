import type { RGB } from '../types'
import { frac, lerp, mixRgb } from './color'
import type { ColorStop, Easing, Edge, Keyframe } from './types'

function ease(easing: Easing, t: number): number {
  if (easing === 'step') return 0
  if (easing === 'ease-in-out') return t * t * (3 - 2 * t)
  return t
}

/**
 * Color at x for stops sorted by position. With `wrap` (around the ring), the
 * last stop blends into the first across position 1 → 0. Without it (a mirrored
 * half), colors hold beyond the first and last stops.
 */
export function stopsAt(stops: ColorStop[], edge: Edge, x: number, wrap = true): RGB {
  const n = stops.length
  if (n === 1) return stops[0].color
  let i = -1
  for (let k = 0; k < n; k++) if (stops[k].position <= x) i = k
  if (!wrap) {
    if (i < 0) return stops[0].color
    if (i === n - 1) return stops[i].color
  }
  const prev = i < 0 ? stops[n - 1] : stops[i]
  const next = i < 0 ? stops[0] : stops[(i + 1) % n]
  if (edge === 'hard') return prev.color
  const span = frac(next.position - prev.position) || 1
  return mixRgb(prev.color, next.color, frac(x - prev.position) / span)
}

const byPosition = (stops: ColorStop[]) => [...stops].sort((a, b) => a.position - b.position)

/**
 * Colors at the given positions when the layer is at `phase` (0–1). Between two
 * keyframes with the same number of stops, both stop positions and colors move;
 * otherwise the two strips crossfade. After the last keyframe, the layer moves
 * into the first one again.
 */
export function renderKeyframes(keyframes: Keyframe[], phase: number, xs: number[], wrap = true): RGB[] {
  const sorted = [...keyframes].sort((a, b) => a.at - b.at)
  let i = sorted.length - 1
  for (let k = 0; k < sorted.length; k++) if (sorted[k].at <= phase) i = k
  const from = sorted[i]
  const to = sorted[(i + 1) % sorted.length]
  const span = frac(to.at - from.at) || 1
  const t = sorted.length === 1 ? 0 : ease(from.easing, frac(phase - from.at) / span)

  const a = byPosition(from.stops)
  const b = byPosition(to.stops)

  if (a.length === b.length) {
    const stops = byPosition(
      a.map((s, n) => ({ position: lerp(s.position, b[n].position, t), color: mixRgb(s.color, b[n].color, t) })),
    )
    return xs.map(x => stopsAt(stops, from.edge, x, wrap))
  }
  return xs.map(x => mixRgb(stopsAt(a, from.edge, x, wrap), stopsAt(b, to.edge, x, wrap), t))
}
