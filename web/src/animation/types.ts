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
  /** Feature count across the strip, 1–16. */
  scale: number
}

export type GeneratorParams = {
  solid: SolidParams
  bands: BandsParams
  pulse: PulseParams
  chase: ChaseParams
  sparkle: SparkleParams
  noise: NoiseParams
}

export type GeneratorName = keyof GeneratorParams
export const RANDOM_GENERATORS = ['sparkle', 'noise'] as const
export type RandomGeneratorName = (typeof RANDOM_GENERATORS)[number]

export const isRandomGenerator = (g: GeneratorName): g is RandomGeneratorName =>
  (RANDOM_GENERATORS as readonly string[]).includes(g)

export type LayerBase = {
  blend: Blend
  opacity: number
  speed: Speed
  hidden: boolean
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
