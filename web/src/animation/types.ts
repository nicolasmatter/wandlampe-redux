import type { RGB } from '../types'

export const ANIMATION_FORMAT_VERSION = 1
export const MAX_LAYERS = 3
export const MIN_BAND_COLORS = 2
export const MAX_BAND_COLORS = 8

export type Blend = 'normal' | 'add'
export type Speed = 0.5 | 1 | 2 | 4

export type SolidParams = { color: RGB }

/** Colors spread evenly along one period and repeat cyclically, so the last blends back into the first. */
export type BandsParams = {
  colors: RGB[]
  edge: 'smooth' | 'hard'
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

export type GeneratorParams = {
  solid: SolidParams
  bands: BandsParams
  pulse: PulseParams
}

export type GeneratorName = keyof GeneratorParams

type LayerBase = {
  blend: Blend
  opacity: number
  speed: Speed
  hidden: boolean
}

export type GeneratorLayer = {
  [G in GeneratorName]: LayerBase & { generator: G; params: GeneratorParams[G] }
}[GeneratorName]

export type Layer = GeneratorLayer

/** Bottom layer first. */
export type Animation = {
  version: number
  name: string
  loopMs: number
  layers: Layer[]
}
