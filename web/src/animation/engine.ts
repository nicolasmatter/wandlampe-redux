import type { RGB } from '../types'
import { frac } from './color'
import { ledPosition, renderGenerator, type LayerContext } from './generators'
import { renderKeyframes } from './keyframes'
import { isKeyframeLayer, type Animation, type Layer, type Region } from './types'

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

function layerContext(layer: Layer, loopMs: number, timeMs: number, clockMs: number): LayerContext {
  const base = { cycleMs: loopMs / layer.speed, mirrored: layer.mirror }
  if (isFreeRunning(layer)) return { ...base, cycles: (clockMs / loopMs) * layer.speed, periodic: false }
  const c = ((timeMs / loopMs) * layer.speed) % 1
  return { ...base, cycles: c < 0 ? c + 1 : c, periodic: true }
}

/** Mirrored layers see bottom (0) → top (1), identical on both sides of the ring. */
export const mirrorPosition = (x: number) => (x <= 0.5 ? 2 * x : 2 * (1 - x))

/** 1 inside the region's arc, 0 outside, ramping over `softness` at its edges. */
export function regionMask(region: Region, x: number): number {
  if (region.from === region.to) return 1
  const length = frac(region.to - region.from)
  const into = frac(x - region.from)
  if (into > length) return 0
  if (region.softness <= 0) return 1
  return Math.min(1, Math.min(into, length - into) / region.softness)
}

function blend(base: RGB, top: RGB, layer: Layer, alpha: number): RGB {
  const mix = (b: number, t: number) => (layer.blend === 'add' ? Math.min(255, b + t * alpha) : b + (t - b) * alpha)
  return { r: mix(base.r, top.r), g: mix(base.g, top.g), b: mix(base.b, top.b) }
}

const round = (c: RGB): RGB => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) })

/**
 * Colors of every LED around the ring at `timeMs`, before brightness and gamma.
 * Layers are composited bottom first. Free-running layers follow `clockMs`
 * instead, a time that never wraps. Pure: the same inputs always give the same output.
 */
export function render(animation: Animation, timeMs: number, ledCount: number, clockMs = timeMs): RGB[] {
  const ring = Array.from({ length: ledCount }, (_, i) => ledPosition(i, ledCount))
  let out: RGB[] = ring.map(() => BLACK)
  for (const layer of animation.layers) {
    if (layer.hidden || layer.opacity <= 0) continue
    const ctx = layerContext(layer, animation.loopMs, timeMs, clockMs)
    const xs = layer.mirror ? ring.map(mirrorPosition) : ring
    const colors = isKeyframeLayer(layer)
      ? renderKeyframes(layer.keyframes, ctx.cycles, xs, !layer.mirror)
      : renderGenerator(layer, ctx, xs)
    const region = layer.region
    out = out.map((base, i) => blend(base, colors[i], layer, layer.opacity * (region ? regionMask(region, ring[i]) : 1)))
  }
  return out.map(round)
}
