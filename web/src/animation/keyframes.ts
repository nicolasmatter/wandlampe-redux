import type { RGB } from '../types'
import { frac, lerp, mixRgb } from './color'
import { ledPosition } from './generators'
import type { ColorStop, Easing, Edge, Keyframe } from './types'

function ease(easing: Easing, t: number): number {
  if (easing === 'step') return 0
  if (easing === 'ease-in-out') return t * t * (3 - 2 * t)
  return t
}

/** Color at x for stops sorted by position. Outside the stops, the nearest stop's color holds. */
export function stopsAt(stops: ColorStop[], edge: Edge, x: number): RGB {
  if (x <= stops[0].position) return stops[0].color
  for (let i = stops.length - 1; i >= 0; i--) {
    if (x < stops[i].position) continue
    const next = stops[i + 1]
    if (!next || edge === 'hard') return stops[i].color
    const span = next.position - stops[i].position
    return span <= 0 ? next.color : mixRgb(stops[i].color, next.color, (x - stops[i].position) / span)
  }
  return stops[0].color
}

const byPosition = (stops: ColorStop[]) => [...stops].sort((a, b) => a.position - b.position)

/**
 * The strip at `phase` (0–1). Between two keyframes with the same number of
 * stops, both stop positions and colors move; otherwise the two strips crossfade.
 * After the last keyframe, the layer moves into the first one again.
 */
export function renderKeyframes(keyframes: Keyframe[], phase: number, ledCount: number): RGB[] {
  const sorted = [...keyframes].sort((a, b) => a.at - b.at)
  let i = sorted.length - 1
  for (let k = 0; k < sorted.length; k++) if (sorted[k].at <= phase) i = k
  const from = sorted[i]
  const to = sorted[(i + 1) % sorted.length]
  const span = frac(to.at - from.at) || 1
  const t = sorted.length === 1 ? 0 : ease(from.easing, frac(phase - from.at) / span)

  const a = byPosition(from.stops)
  const b = byPosition(to.stops)
  const xs = Array.from({ length: ledCount }, (_, n) => ledPosition(n, ledCount))

  if (a.length === b.length) {
    const stops = byPosition(
      a.map((s, n) => ({ position: lerp(s.position, b[n].position, t), color: mixRgb(s.color, b[n].color, t) })),
    )
    return xs.map(x => stopsAt(stops, from.edge, x))
  }
  return xs.map(x => mixRgb(stopsAt(a, from.edge, x), stopsAt(b, to.edge, x), t))
}
