import { parseAnimation } from './animation/format'
import type { Animation } from './animation/types'
import type { RGB } from './types'

export type BundledAnimation = { file: string; animation: Animation }

const files = import.meta.glob('../../animations/*.json', { eager: true, import: 'default' })

/** The committed animations (repo `animations/`), sorted by name. Invalid files are left out. */
export const BUNDLED_ANIMATIONS: BundledAnimation[] = Object.entries(files)
  .flatMap(([path, json]) => {
    const result = parseAnimation(json)
    return result.ok ? [{ file: path.split('/').pop() ?? path, animation: result.animation }] : []
  })
  .sort((a, b) => a.animation.name.localeCompare(b.animation.name))

const sameAnimation = (a: Animation, b: Animation) => JSON.stringify(a) === JSON.stringify(b)

/** File name of the committed animation identical to `animation`, if any. */
export function bundledFile(animation: Animation): string | null {
  return BUNDLED_ANIMATIONS.find(b => sameAnimation(b.animation, animation))?.file ?? null
}

const WHITE: RGB = { r: 255, g: 255, b: 255 }

function pulseAnimation(name: string, loopMs: number, color: RGB): Animation {
  return {
    version: 1,
    name,
    loopMs,
    layers: [
      {
        blend: 'normal',
        opacity: 1,
        speed: 1,
        hidden: false,
        mirror: false,
        generator: 'pulse',
        params: { color, min: 0, max: 255, curve: 'sine' },
      },
    ],
  }
}

const RAINBOW: Animation = {
  version: 1,
  name: 'Rainbow',
  loopMs: 6000,
  layers: [
    {
      blend: 'normal',
      opacity: 1,
      speed: 1,
      hidden: false,
      mirror: false,
      generator: 'bands',
      params: {
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
    },
  ],
}

/** The animation a new animation mode starts with. */
export function defaultLampAnimation(): Animation {
  return BUNDLED_ANIMATIONS.find(b => b.file === 'rainbow.json')?.animation ?? RAINBOW
}

/**
 * Converts the lamp's former hardcoded animations (`"animation": "pulse"` with a
 * color) to equivalent Lab animations: pulse and breathe swing between off and
 * full color every 1 s and 3 s. Returns null for anything else.
 */
export function legacyAnimation(id: unknown, color: RGB = WHITE): Animation | null {
  switch (id) {
    case 'rainbow':
      return defaultLampAnimation()
    case 'pulse':
      return pulseAnimation('Pulse', 1000, color)
    case 'breathe':
      return pulseAnimation('Breathe', 3000, color)
    default:
      return null
  }
}
