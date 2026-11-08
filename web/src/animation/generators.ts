import type { RGB } from '../types'
import { clamp01, frac, lerp, mixRgb, paletteAt, scaleRgb } from './color'
import { hash01, valueNoise3 } from './random'
import type { BandsParams, ChaseParams, GeneratorLayer, NoiseParams, PulseParams, SparkleParams } from './types'

/** Center of LED i as a relative strip position, so every count samples the same 0–1 space. */
export const ledPosition = (i: number, ledCount: number) => (i + 0.5) / ledCount

/**
 * Where a layer is in time. `cycles` counts layer cycles: within [0, 1) for
 * looping layers, unbounded for free-running ones, where `periodic` is false.
 */
export type LayerTime = { cycles: number; periodic: boolean }

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

/** Brightness 0–1 of one chase dot whose head is at `head`, moving in `dir`. */
function dotLevel(p: ChaseParams, head: number, dir: number, x: number, wrap: boolean): number {
  let behind = (head - x) * dir
  if (wrap) behind = frac(behind + 0.5) - 0.5
  const half = p.width / 2
  if (Math.abs(behind) <= half) return 1
  if (behind < 0 || p.tail <= 0) return 0
  return clamp01(1 - (behind - half) / p.tail)
}

function chase(p: ChaseParams, phase: number, x: number): number {
  let level = 0
  for (let k = 0; k < p.count; k++) {
    const t = frac(phase + k / p.count)
    if (p.bounce) {
      const forward = t < 0.5
      const pos = forward ? t * 2 : 2 - t * 2
      const head = p.direction === 1 ? pos : 1 - pos
      const dir = (forward ? 1 : -1) * p.direction
      level = Math.max(level, dotLevel(p, head, dir, x, false))
    } else {
      const head = p.direction === 1 ? t : 1 - t
      level = Math.max(level, dotLevel(p, head, p.direction, x, true))
    }
  }
  return level
}

/** Sparkle slots per layer cycle. Each LED may start one sparkle per slot. */
const SPARKLE_SLOTS = 16

function sparkle(p: SparkleParams, seed: number, time: LayerTime, led: number): number {
  const fade = Math.max(p.fade, 0.01)
  const c = time.cycles
  let level = 0
  for (let g = Math.floor((c - fade) * SPARKLE_SLOTS) - 1; g <= Math.floor(c * SPARKLE_SLOTS); g++) {
    // Looping layers reuse the same slots every cycle, so the pattern repeats exactly.
    const key = time.periodic ? ((g % SPARKLE_SLOTS) + SPARKLE_SLOTS) % SPARKLE_SLOTS : g
    if (hash01(seed, led, key, 1) >= p.density) continue
    const start = (g + hash01(seed, led, key, 2)) / SPARKLE_SLOTS
    const age = c - start
    if (age >= 0 && age < fade) level = Math.max(level, 1 - age / fade)
  }
  return level
}

/** Radius of the circle that looping noise travels around; larger means more change per cycle. */
const NOISE_LOOP_RADIUS = 1.2

function noise(p: NoiseParams, seed: number, time: LayerTime, x: number): RGB {
  const angle = 2 * Math.PI * time.cycles
  // Looping layers walk a circle through the noise field, which closes exactly after one cycle.
  const [y, z] = time.periodic
    ? [NOISE_LOOP_RADIUS * Math.cos(angle), NOISE_LOOP_RADIUS * Math.sin(angle)]
    : [time.cycles * 2 * NOISE_LOOP_RADIUS, 0]
  const sx = x * p.scale
  const v = 0.65 * valueNoise3(seed, sx, y, z) + 0.35 * valueNoise3(seed + 1, sx * 2, y * 2, z * 2)
  // Two octaves cluster around the middle; stretch to use the whole palette.
  return paletteAt(p.colors, clamp01((v - 0.5) * 1.8 + 0.5))
}

/** Colors of one generator layer, unrounded. */
export function renderGenerator(layer: GeneratorLayer, time: LayerTime, ledCount: number): RGB[] {
  const each = (f: (x: number, i: number) => RGB) =>
    Array.from({ length: ledCount }, (_, i) => f(ledPosition(i, ledCount), i))
  const phase = frac(time.cycles)
  switch (layer.generator) {
    case 'solid':
      return each(() => layer.params.color)
    case 'bands':
      return each(x => bands(layer.params, phase, x))
    case 'pulse': {
      const c = pulse(layer.params, phase)
      return each(() => c)
    }
    case 'chase':
      return each(x => scaleRgb(layer.params.color, chase(layer.params, phase, x)))
    case 'sparkle':
      // Each LED sparkles independently, so the exact pattern depends on the LED count.
      return each((_, i) => scaleRgb(layer.params.color, sparkle(layer.params, layer.seed, time, i)))
    case 'noise':
      return each(x => noise(layer.params, layer.seed, time, x))
  }
}
