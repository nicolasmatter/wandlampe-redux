import type { RGB } from '../types'

export const ANIMATION_FORMAT_VERSION = 1
export const MAX_LAYERS = 3
export const MIN_PALETTE_COLORS = 2
export const MAX_PALETTE_COLORS = 8
export const MAX_KEYFRAMES = 16
export const MAX_STOPS = 8
export const SPEEDS = [0.5, 1, 2, 4] as const

export type Blend = 'normal' | 'add'
export type Speed = (typeof SPEEDS)[number]
export type Edge = 'smooth' | 'hard'
export type Easing = 'linear' | 'ease-in-out' | 'step'

export type SolidParams = { color: RGB }

/** Colors spread evenly along one period and repeat cyclically, so the last blends back into the first. */
export type BandsParams = {
  colors: RGB[]
  edge: Edge
  /** Periods across the strip, 1–16. */
  repeat: number
  /** Strip lengths moved per layer cycle: 1 forward, -1 backward, 0 static. */
  scroll: -1 | 0 | 1
}

/** Brightness rises and falls once per layer cycle. min/max scale the color, 0–255. */
export type PulseParams = {
  color: RGB
  min: number
  max: number
  curve: 'sine' | 'sharp'
}

/** Dots travelling along the strip, one strip length per layer cycle. Sizes are relative to the strip. */
export type ChaseParams = {
  color: RGB
  /** Fully lit head, 0–1. */
  width: number
  /** Fading trail behind the head, 0–1. */
  tail: number
  /** Evenly spaced dots, 1–8. */
  count: number
  direction: 1 | -1
  /** Travel there and back instead of wrapping around. */
  bounce: boolean
}

/** LEDs flash and fade at random moments. */
export type SparkleParams = {
  color: RGB
  /** Chance per LED per sparkle slot, 0–1. */
  density: number
  /** How long a sparkle fades, as a fraction of the layer cycle, 0.01–1. */
  fade: number
}

/** Smooth random field mapped onto a palette, from the first color (low) to the last (high). */
export type NoiseParams = {
  colors: RGB[]
  /** Whole number of features around the ring, 1–16, so the field tiles without a seam. */
  scale: number
  /** Stretches values away from the middle, 0.5–8. High values give crisp lines. */
  contrast: number
}

/** Lightning: mostly dark, with random strikes that flicker and leave an afterglow. */
export type StrikeParams = {
  color: RGB
  /** Expected strikes per layer cycle, 0–8. */
  rate: number
  /** Most flashes per strike, 1–4. */
  flickers: number
  /** Lit arc around the strike center, 0.02–1 (1 lights everything). */
  width: number
  /** How long the glow lingers after the last flash, 0–3000 ms. */
  afterglowMs: number
  /** Where strikes hit: anywhere, or the top (with mirror, the top of both sides). */
  origin: 'random' | 'top'
}

/** Particles that fall toward position 0, each with a fading tail behind it. */
export type DropsParams = {
  color: RGB
  /** Drops per layer cycle, an integer 1–40. */
  rate: number
  /** Positions travelled per layer cycle, 0.2–8. */
  speed: number
  /** Random slow-down per drop, 0–0.9. */
  variation: number
  /** Tail length, 0–0.5. */
  length: number
}

/** Waves that spread both ways from random spots and fade. */
export type RippleParams = {
  color: RGB
  /** Ripples per layer cycle, an integer 1–16. */
  rate: number
  /** Positions a wave travels per layer cycle, 0.1–4. */
  speed: number
  /** Wave thickness, 0.01–0.3. */
  width: number
  /** How long a ripple lasts, in layer cycles, 0.05–2. */
  life: number
}

export type GeneratorParams = {
  solid: SolidParams
  bands: BandsParams
  pulse: PulseParams
  chase: ChaseParams
  sparkle: SparkleParams
  noise: NoiseParams
  strike: StrikeParams
  drops: DropsParams
  ripple: RippleParams
}

export type GeneratorName = keyof GeneratorParams
export const RANDOM_GENERATORS = ['sparkle', 'noise', 'strike', 'drops', 'ripple'] as const
export type RandomGeneratorName = (typeof RANDOM_GENERATORS)[number]

export const isRandomGenerator = (g: GeneratorName): g is RandomGeneratorName =>
  (RANDOM_GENERATORS as readonly string[]).includes(g)

/**
 * The arc from `from` counterclockwise to `to`. Outside it the layer is hidden;
 * `softness` (0–0.5) fades it in from the edges. from === to covers the whole ring.
 */
export type Region = { from: number; to: number; softness: number }

export type LayerBase = {
  blend: Blend
  opacity: number
  speed: Speed
  hidden: boolean
  /** Draw along bottom (0) → top (1) and show it identically on both sides of the ring. */
  mirror: boolean
  region?: Region
}

/** Random layers repeat exactly per cycle for a given seed, unless free-running. */
export type RandomFields = { seed: number; freeRunning: boolean }

export type GeneratorLayer = {
  [G in GeneratorName]: LayerBase & { generator: G; params: GeneratorParams[G] } & (G extends RandomGeneratorName
      ? RandomFields
      : unknown)
}[GeneratorName]

export type ColorStop = { position: number; color: RGB }

export type Keyframe = {
  /** Position in the layer cycle, 0–1. */
  at: number
  /** How the strip moves from this keyframe into the next one. */
  easing: Easing
  edge: Edge
  stops: ColorStop[]
}

export type KeyframeLayer = LayerBase & { keyframes: Keyframe[] }

export type Layer = GeneratorLayer | KeyframeLayer

export const isKeyframeLayer = (l: Layer): l is KeyframeLayer => 'keyframes' in l

/** Bottom layer first. */
export type Animation = {
  version: number
  name: string
  loopMs: number
  layers: Layer[]
}
