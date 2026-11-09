import type { RGB } from '../types'
import { clamp01, frac, lerp, mixRgb, paletteAt, scaleRgb } from './color'
import { hash01, valueNoise3 } from './random'
import type {
  BandsParams,
  ChaseParams,
  DropsParams,
  GeneratorLayer,
  NoiseParams,
  PulseParams,
  RippleParams,
  SparkleParams,
  StrikeParams,
} from './types'

/** Position of LED i on the ring: LED 0 at the bottom (0), counterclockwise, 0.5 at the top. */
export const ledPosition = (i: number, ledCount: number) => i / ledCount

/**
 * What a generator knows about time and space. `cycles` counts layer cycles:
 * within [0, 1) for looping layers, unbounded for free-running ones (`periodic`
 * false). `cycleMs` is how long one layer cycle takes. When `mirrored`,
 * positions run 0 (bottom) → 1 (top) along one side and do not wrap.
 */
export type LayerContext = { cycles: number; periodic: boolean; cycleMs: number; mirrored: boolean }

/** Signed distance from `from` to `to`; around the ring it takes the shorter way. */
function offset(ctx: LayerContext, from: number, to: number): number {
  const d = to - from
  return ctx.mirrored ? d : frac(d + 0.5) - 0.5
}

const periodicKey = (ctx: LayerContext, g: number, slots: number) =>
  ctx.periodic ? ((g % slots) + slots) % slots : g

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
function dotLevel(ctx: LayerContext, p: ChaseParams, head: number, dir: number, x: number): number {
  const behind = offset(ctx, x, head) * dir
  const half = p.width / 2
  if (Math.abs(behind) <= half) return 1
  if (behind < 0 || p.tail <= 0) return 0
  return clamp01(1 - (behind - half) / p.tail)
}

function chase(ctx: LayerContext, p: ChaseParams, phase: number, x: number): number {
  let level = 0
  for (let k = 0; k < p.count; k++) {
    const t = frac(phase + k / p.count)
    if (p.bounce) {
      const forward = t < 0.5
      const pos = forward ? t * 2 : 2 - t * 2
      const head = p.direction === 1 ? pos : 1 - pos
      level = Math.max(level, dotLevel(ctx, p, head, (forward ? 1 : -1) * p.direction, x))
    } else {
      const head = p.direction === 1 ? t : 1 - t
      level = Math.max(level, dotLevel(ctx, p, head, p.direction, x))
    }
  }
  return level
}

/** Sparkle slots per layer cycle. Each position may start one sparkle per slot. */
const SPARKLE_SLOTS = 16

function sparkle(ctx: LayerContext, p: SparkleParams, seed: number, x: number): number {
  const fade = Math.max(p.fade, 0.01)
  const c = ctx.cycles
  // Keyed by position, so mirrored LEDs sparkle together.
  const spot = Math.round(x * 100000)
  let level = 0
  for (let g = Math.floor((c - fade) * SPARKLE_SLOTS) - 1; g <= Math.floor(c * SPARKLE_SLOTS); g++) {
    const key = periodicKey(ctx, g, SPARKLE_SLOTS)
    if (hash01(seed, spot, key, 1) >= p.density) continue
    const age = c - (g + hash01(seed, spot, key, 2)) / SPARKLE_SLOTS
    if (age >= 0 && age < fade) level = Math.max(level, 1 - age / fade)
  }
  return level
}

/** Radius of the circle that looping noise travels around; larger means more change per cycle. */
const NOISE_LOOP_RADIUS = 1.2

function noise(ctx: LayerContext, p: NoiseParams, seed: number, x: number): RGB {
  const angle = 2 * Math.PI * ctx.cycles
  // Looping layers walk a circle through the noise field, which closes exactly after one cycle.
  const [y, z] = ctx.periodic
    ? [NOISE_LOOP_RADIUS * Math.cos(angle), NOISE_LOOP_RADIUS * Math.sin(angle)]
    : [ctx.cycles * 2 * NOISE_LOOP_RADIUS, 0]
  const scale = Math.max(1, Math.round(p.scale))
  const sx = x * scale
  const v =
    0.65 * valueNoise3(seed, sx, y, z, scale) + 0.35 * valueNoise3(seed + 1, sx * 2, y * 2, z * 2, scale * 2)
  return paletteAt(p.colors, clamp01((v - 0.5) * p.contrast + 0.5))
}

/** A short-lived light source: brightness 0–1 with a center and a lit half-width. */
type Spot = { center: number; level: number }

const STRIKE_SLOTS = 8
const FLASH_MS = 50
const FLICKER_GAP_MS = 90

function strikes(ctx: LayerContext, p: StrikeParams, seed: number): Spot[] {
  const durMs = p.flickers * FLICKER_GAP_MS + p.afterglowMs
  const c = ctx.cycles
  const spots: Spot[] = []
  for (let g = Math.floor((c - durMs / ctx.cycleMs) * STRIKE_SLOTS) - 1; g <= Math.floor(c * STRIKE_SLOTS); g++) {
    const key = periodicKey(ctx, g, STRIKE_SLOTS)
    if (hash01(seed, key, 1) >= p.rate / STRIKE_SLOTS) continue
    const ageMs = (c - (g + hash01(seed, key, 2)) / STRIKE_SLOTS) * ctx.cycleMs
    if (ageMs < 0 || ageMs > durMs) continue
    const flashes = 1 + Math.floor(hash01(seed, key, 3) * p.flickers)
    let level = 0
    for (let j = 0; j < flashes; j++) {
      const t = ageMs - j * FLICKER_GAP_MS
      if (t >= 0 && t < FLASH_MS) level = 0.6 + 0.4 * hash01(seed, key, 10 + j)
    }
    const end = (flashes - 1) * FLICKER_GAP_MS + FLASH_MS
    if (ageMs < end) level = Math.max(level, 0.08)
    else if (p.afterglowMs > 0) level = Math.max(level, 0.35 * Math.pow(clamp01(1 - (ageMs - end) / p.afterglowMs), 2))
    const center = p.origin === 'top' ? (ctx.mirrored ? 1 : 0.5) : hash01(seed, key, 4)
    if (level > 0) spots.push({ center, level })
  }
  return spots
}

function strikeAt(ctx: LayerContext, p: StrikeParams, spots: Spot[], x: number): number {
  const half = p.width / 2
  const edge = Math.max(half, 0.05)
  let level = 0
  for (const s of spots) {
    const d = Math.abs(offset(ctx, s.center, x))
    const shape = p.width >= 1 || d <= half ? 1 : clamp01(1 - (d - half) / edge)
    level = Math.max(level, s.level * shape)
  }
  return level
}

/** Soft half-width of a drop's head, so it lights at least one LED at any count. */
const DROP_HEAD = 0.03

function drops(ctx: LayerContext, p: DropsParams, seed: number): number[] {
  const rate = Math.max(1, Math.round(p.rate))
  const slowest = p.speed * (1 - p.variation)
  const maxLife = (1 + p.length + DROP_HEAD) / slowest
  const c = ctx.cycles
  const heads: number[] = []
  for (let g = Math.floor((c - maxLife) * rate) - 1; g <= Math.floor(c * rate); g++) {
    const key = periodicKey(ctx, g, rate)
    const age = c - (g + hash01(seed, key, 1)) / rate
    if (age < 0) continue
    const speed = p.speed * (1 - p.variation * hash01(seed, key, 2))
    const head = 1 - 0.3 * hash01(seed, key, 3) - speed * age
    if (head >= -(p.length + DROP_HEAD)) heads.push(head)
  }
  return heads
}

function dropAt(ctx: LayerContext, p: DropsParams, heads: number[], x: number): number {
  let level = 0
  for (const head of heads) {
    const behind = offset(ctx, head, x)
    const lit = behind < 0 ? 1 - -behind / DROP_HEAD : Math.max(1 - behind / DROP_HEAD, p.length > 0 ? 1 - behind / p.length : 0)
    level = Math.max(level, clamp01(lit))
  }
  return level
}

type Ring = { center: number; radius: number; amp: number }

function ripples(ctx: LayerContext, p: RippleParams, seed: number): Ring[] {
  const rate = Math.max(1, Math.round(p.rate))
  const c = ctx.cycles
  const rings: Ring[] = []
  for (let g = Math.floor((c - p.life) * rate) - 1; g <= Math.floor(c * rate); g++) {
    const key = periodicKey(ctx, g, rate)
    const age = c - (g + hash01(seed, key, 1)) / rate
    if (age < 0 || age > p.life) continue
    rings.push({ center: hash01(seed, key, 2), radius: p.speed * age, amp: 1 - age / p.life })
  }
  return rings
}

function rippleAt(ctx: LayerContext, p: RippleParams, rings: Ring[], x: number): number {
  let level = 0
  for (const r of rings) {
    const d = Math.abs(offset(ctx, r.center, x))
    level = Math.max(level, r.amp * clamp01(1 - Math.abs(d - r.radius) / p.width))
  }
  return level
}

/** Colors of one generator layer at the given positions, unrounded. */
export function renderGenerator(layer: GeneratorLayer, ctx: LayerContext, xs: number[]): RGB[] {
  const phase = frac(ctx.cycles)
  switch (layer.generator) {
    case 'solid':
      return xs.map(() => layer.params.color)
    case 'bands':
      return xs.map(x => bands(layer.params, phase, x))
    case 'pulse': {
      const c = pulse(layer.params, phase)
      return xs.map(() => c)
    }
    case 'chase':
      return xs.map(x => scaleRgb(layer.params.color, chase(ctx, layer.params, phase, x)))
    case 'sparkle':
      return xs.map(x => scaleRgb(layer.params.color, sparkle(ctx, layer.params, layer.seed, x)))
    case 'noise':
      return xs.map(x => noise(ctx, layer.params, layer.seed, x))
    case 'strike': {
      const spots = strikes(ctx, layer.params, layer.seed)
      return xs.map(x => scaleRgb(layer.params.color, strikeAt(ctx, layer.params, spots, x)))
    }
    case 'drops': {
      const heads = drops(ctx, layer.params, layer.seed)
      return xs.map(x => scaleRgb(layer.params.color, dropAt(ctx, layer.params, heads, x)))
    }
    case 'ripple': {
      const rings = ripples(ctx, layer.params, layer.seed)
      return xs.map(x => scaleRgb(layer.params.color, rippleAt(ctx, layer.params, rings, x)))
    }
  }
}
