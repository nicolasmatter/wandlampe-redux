import type { RGB } from '../types'
import type { Animation, Layer } from './types'

const BLACK: RGB = { r: 0, g: 0, b: 0 }

/** Phase of a layer within its own cycle, in [0, 1). */
function layerPhase(timeMs: number, loopMs: number, layer: Layer): number {
  const p = ((timeMs / loopMs) * layer.speed) % 1
  return p < 0 ? p + 1 : p
}

function renderLayer(layer: Layer, _phase: number, ledCount: number): RGB[] {
  switch (layer.generator) {
    case 'solid':
      return Array.from({ length: ledCount }, () => layer.params.color)
  }
}

function blend(base: RGB, top: RGB, layer: Layer): RGB {
  const a = layer.opacity
  const mix = (b: number, t: number) =>
    layer.blend === 'add' ? Math.min(255, b + t * a) : b + (t - b) * a
  return { r: mix(base.r, top.r), g: mix(base.g, top.g), b: mix(base.b, top.b) }
}

const round = (c: RGB): RGB => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) })

/**
 * Colors of every LED at `timeMs`, before brightness and gamma.
 * Pure: the same inputs always give the same output.
 */
export function render(animation: Animation, timeMs: number, ledCount: number): RGB[] {
  let out: RGB[] = Array.from({ length: ledCount }, () => BLACK)
  for (const layer of animation.layers) {
    if (layer.hidden || layer.opacity <= 0) continue
    const colors = renderLayer(layer, layerPhase(timeMs, animation.loopMs, layer), ledCount)
    out = out.map((base, i) => blend(base, colors[i], layer))
  }
  return out.map(round)
}
