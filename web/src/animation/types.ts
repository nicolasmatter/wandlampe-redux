import type { RGB } from '../types'

export const ANIMATION_FORMAT_VERSION = 1
export const MAX_LAYERS = 3

export type Blend = 'normal' | 'add'
export type Speed = 0.5 | 1 | 2 | 4

export type SolidParams = { color: RGB }

export type GeneratorLayer = {
  blend: Blend
  opacity: number
  speed: Speed
  hidden: boolean
  generator: 'solid'
  params: SolidParams
}

export type Layer = GeneratorLayer

/** Bottom layer first. */
export type Animation = {
  version: number
  name: string
  loopMs: number
  layers: Layer[]
}
