import type { RGB } from '../types'
import { renderGenerator, type LayerTime } from './generators'
import { renderKeyframes } from './keyframes'
import { isKeyframeLayer, type Animation, type Layer } from './types'

const BLACK: RGB = { r: 0, g: 0, b: 0 }

/**
 * How long until the whole animation repeats. Equal to the loop, except that a
 * ×½ layer needs two loops to finish its cycle.
 */
export function cycleMs(animation: Animation): number {
  return animation.layers.some(l => l.speed < 1) ? animation.loopMs * 2 : animation.loopMs
}

function isFreeRunning(layer: Layer): boolean {
  return !isKeyframeLayer(layer) && 'freeRunning' in layer && layer.freeRunning
}

function layerTime(layer: Layer, loopMs: number, timeMs: number, clockMs: number): LayerTime {
  if (isFreeRunning(layer)) return { cycles: (clockMs / loopMs) * layer.speed, periodic: false }
  const c = ((timeMs / loopMs) * layer.speed) % 1
  return { cycles: c < 0 ? c + 1 : c, periodic: true }
}

function blend(base: RGB, top: RGB, layer: Layer): RGB {
  const a = layer.opacity
  const mix = (b: number, t: number) => (layer.blend === 'add' ? Math.min(255, b + t * a) : b + (t - b) * a)
  return { r: mix(base.r, top.r), g: mix(base.g, top.g), b: mix(base.b, top.b) }
}

const round = (c: RGB): RGB => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) })

/**
 * Colors of every LED at `timeMs`, before brightness and gamma. Layers are
 * composited bottom first. Free-running layers follow `clockMs` instead, a
 * time that never wraps. Pure: the same inputs always give the same output.
 */
export function render(animation: Animation, timeMs: number, ledCount: number, clockMs = timeMs): RGB[] {
  let out: RGB[] = Array.from({ length: ledCount }, () => BLACK)
  for (const layer of animation.layers) {
    if (layer.hidden || layer.opacity <= 0) continue
    const time = layerTime(layer, animation.loopMs, timeMs, clockMs)
    const colors = isKeyframeLayer(layer)
      ? renderKeyframes(layer.keyframes, time.cycles, ledCount)
      : renderGenerator(layer, time, ledCount)
    out = out.map((base, i) => blend(base, colors[i], layer))
  }
  return out.map(round)
}
