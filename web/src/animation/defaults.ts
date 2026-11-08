import {
  ANIMATION_FORMAT_VERSION,
  isRandomGenerator,
  type Animation,
  type GeneratorLayer,
  type GeneratorName,
  type GeneratorParams,
  type Keyframe,
  type KeyframeLayer,
  type Layer,
} from './types'

export const GENERATOR_LABELS: Record<GeneratorName, string> = {
  solid: 'Solid',
  bands: 'Bands',
  pulse: 'Pulse',
  chase: 'Chase',
  sparkle: 'Sparkle',
  noise: 'Noise',
  strike: 'Strike (lightning)',
  drops: 'Drops (rain)',
  ripple: 'Ripple',
}

const WARM = { r: 255, g: 140, b: 40 }

export function defaultParams<G extends GeneratorName>(generator: G): GeneratorParams[G] {
  const all: GeneratorParams = {
    solid: { color: WARM },
    bands: {
      colors: [
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 255, b: 255 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 255 },
      ],
      edge: 'smooth',
      repeat: 1,
      scroll: 1,
    },
    pulse: { color: WARM, min: 20, max: 255, curve: 'sine' },
    chase: { color: { r: 255, g: 255, b: 255 }, width: 0.04, tail: 0.25, count: 1, direction: 1, bounce: false },
    sparkle: { color: { r: 255, g: 255, b: 255 }, density: 0.15, fade: 0.15 },
    noise: {
      colors: [
        { r: 0, g: 0, b: 0 },
        { r: 180, g: 20, b: 0 },
        { r: 255, g: 120, b: 0 },
        { r: 255, g: 220, b: 120 },
      ],
      scale: 4,
      contrast: 1.8,
    },
    strike: { color: { r: 220, g: 225, b: 255 }, rate: 1.5, flickers: 3, width: 0.3, afterglowMs: 600, origin: 'random' },
    drops: { color: { r: 140, g: 180, b: 255 }, rate: 6, speed: 1.4, variation: 0.5, length: 0.1 },
    ripple: { color: { r: 80, g: 200, b: 255 }, rate: 3, speed: 0.6, width: 0.05, life: 0.8 },
  }
  return all[generator]
}

export const randomSeed = () => Math.floor(Math.random() * 0x7fffffff)

const BASE = { blend: 'normal', opacity: 1, speed: 1, hidden: false, mirror: false } as const

export function generatorLayer(generator: GeneratorName): GeneratorLayer {
  const random = isRandomGenerator(generator) ? { seed: randomSeed(), freeRunning: false } : {}
  return { ...BASE, generator, params: defaultParams(generator), ...random } as GeneratorLayer
}

export function defaultKeyframe(at: number): Keyframe {
  return {
    at,
    easing: 'ease-in-out',
    edge: 'smooth',
    stops: [
      { position: 0, color: { r: 255, g: 60, b: 0 } },
      { position: 0.5, color: { r: 0, g: 40, b: 255 } },
    ],
  }
}

export function keyframeLayer(): KeyframeLayer {
  const second = defaultKeyframe(0.5)
  second.stops = [
    { position: 0, color: { r: 0, g: 40, b: 255 } },
    { position: 0.5, color: { r: 255, g: 60, b: 0 } },
  ]
  return { ...BASE, keyframes: [defaultKeyframe(0), second] }
}

/** Keeps blend, opacity, speed and visibility when switching what a layer draws. */
export function withContent(layer: Layer, content: GeneratorName | 'keyframes'): Layer {
  const { blend, opacity, speed, hidden, mirror, region } = layer
  const fresh = content === 'keyframes' ? keyframeLayer() : generatorLayer(content)
  return { ...fresh, blend, opacity, speed, hidden, mirror, ...(region ? { region } : {}) }
}

/** Named arcs for the region picker. from === to means the whole ring. */
export const REGION_PRESETS = {
  whole: { from: 0, to: 0 },
  top: { from: 0.25, to: 0.75 },
  bottom: { from: 0.75, to: 0.25 },
  right: { from: 0, to: 0.5 },
  left: { from: 0.5, to: 1 },
} as const

export function defaultAnimation(): Animation {
  return { version: ANIMATION_FORMAT_VERSION, name: 'Untitled', loopMs: 4000, layers: [generatorLayer('solid')] }
}
