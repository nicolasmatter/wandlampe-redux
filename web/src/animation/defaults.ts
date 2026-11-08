import { ANIMATION_FORMAT_VERSION, type Animation } from './types'

export function defaultAnimation(): Animation {
  return {
    version: ANIMATION_FORMAT_VERSION,
    name: 'Untitled',
    loopMs: 4000,
    layers: [
      { blend: 'normal', opacity: 1, speed: 1, hidden: false, generator: 'solid', params: { color: { r: 255, g: 140, b: 40 } } },
    ],
  }
}
