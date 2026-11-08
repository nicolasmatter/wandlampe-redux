import { ANIMATION_FORMAT_VERSION, type Animation, type GeneratorLayer, type GeneratorName, type GeneratorParams } from './types'

export const GENERATOR_LABELS: Record<GeneratorName, string> = {
  solid: 'Solid',
  bands: 'Bands',
  pulse: 'Pulse',
}

export function defaultParams<G extends GeneratorName>(generator: G): GeneratorParams[G] {
  const all: GeneratorParams = {
    solid: { color: { r: 255, g: 140, b: 40 } },
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
    pulse: { color: { r: 255, g: 140, b: 40 }, min: 20, max: 255, curve: 'sine' },
  }
  return all[generator]
}

export function generatorLayer<G extends GeneratorName>(generator: G): GeneratorLayer {
  return { blend: 'normal', opacity: 1, speed: 1, hidden: false, generator, params: defaultParams(generator) } as GeneratorLayer
}

export function defaultAnimation(): Animation {
  return { version: ANIMATION_FORMAT_VERSION, name: 'Untitled', loopMs: 4000, layers: [generatorLayer('solid')] }
}
