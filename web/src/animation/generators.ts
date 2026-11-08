import type { RGB } from '../types'
import type { BandsParams, GeneratorLayer, PulseParams } from './types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) })
const scaleRgb = (c: RGB, s: number): RGB => ({ r: c.r * s, g: c.g * s, b: c.b * s })
const frac = (v: number) => v - Math.floor(v)

/** Center of LED i as a relative strip position, so every count samples the same 0–1 space. */
export const ledPosition = (i: number, ledCount: number) => (i + 0.5) / ledCount

function bands(p: BandsParams, phase: number, x: number): RGB {
  const k = p.colors.length
  const u = frac((x - p.scroll * phase) * p.repeat) * k
  const i = Math.floor(u) % k
  if (p.edge === 'hard') return p.colors[i]
  return mixRgb(p.colors[i], p.colors[(i + 1) % k], u - Math.floor(u))
}

/** 0 at the start and end of the cycle, 1 at its peak. */
function pulseLevel(curve: PulseParams['curve'], phase: number): number {
  if (curve === 'sine') return (1 - Math.cos(2 * Math.PI * phase)) / 2
  const attack = 0.1
  return phase < attack ? phase / attack : Math.pow(1 - (phase - attack) / (1 - attack), 2)
}

function pulse(p: PulseParams, phase: number): RGB {
  return scaleRgb(p.color, lerp(p.min, p.max, pulseLevel(p.curve, phase)) / 255)
}

/** Colors of one generator layer, unrounded. `phase` is the layer's position in its cycle, 0–1. */
export function renderGenerator(layer: GeneratorLayer, phase: number, ledCount: number): RGB[] {
  const each = (f: (x: number) => RGB) => Array.from({ length: ledCount }, (_, i) => f(ledPosition(i, ledCount)))
  switch (layer.generator) {
    case 'solid':
      return each(() => layer.params.color)
    case 'bands':
      return each(x => bands(layer.params, phase, x))
    case 'pulse': {
      const c = pulse(layer.params, phase)
      return each(() => c)
    }
  }
}
