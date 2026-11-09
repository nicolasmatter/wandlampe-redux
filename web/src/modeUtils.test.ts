import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Animation } from './animation/types'
import { MAX_CONFIG_BYTES } from './config'
import { BUNDLED_ANIMATIONS, bundledFile, legacyAnimation } from './lampAnimations'
import { configPayload, configSize, modeToPayload, parseMode } from './modeUtils'
import type { Mode } from './types'

const sunrise = BUNDLED_ANIMATIONS.find(b => b.file === 'sunrise-fields.json')!.animation

describe('animation modes', () => {
  it('round-trips a mode with an embedded animation', () => {
    const mode: Mode = { name: 'Morning', type: 'animation', brightness: 90, animation: sunrise }
    const parsed = parseMode(JSON.parse(JSON.stringify(modeToPayload(mode))), 0)
    expect(parsed).toEqual(mode)
    expect(bundledFile(parsed!.animation!)).toBe('sunrise-fields.json')
  })

  it('drops an animation mode whose animation is invalid', () => {
    const broken = { ...sunrise, loopMs: 5 }
    expect(parseMode({ type: 'animation', brightness: 1, animation: broken }, 0)).toBeNull()
  })

  it('bundles every committed animation', () => {
    const files = readdirSync(new URL('../../animations', import.meta.url)).filter(f => f.endsWith('.json'))
    expect(BUNDLED_ANIMATIONS.map(b => b.file).sort()).toEqual(files.sort())
    expect(BUNDLED_ANIMATIONS.map(b => b.file)).toContain('pulse.json')
  })
})

describe('legacy animations', () => {
  const color = { r: 10, g: 20, b: 30 }

  it('converts the former rainbow to the committed rainbow', () => {
    const mode = parseMode({ name: 'R', type: 'animation', brightness: 128, animation: 'rainbow' }, 0)
    expect(bundledFile(mode!.animation!)).toBe('rainbow.json')
  })

  it.each([
    ['pulse', 1000],
    ['breathe', 3000],
  ])('converts %s to a full-range sine pulse of the mode color', (id, loopMs) => {
    const mode = parseMode({ name: 'P', type: 'animation', brightness: 128, animation: id, color }, 0)
    const animation = mode!.animation as Animation
    expect(animation.loopMs).toBe(loopMs)
    expect(animation.layers).toEqual([
      expect.objectContaining({ generator: 'pulse', params: { color, min: 0, max: 255, curve: 'sine' } }),
    ])
  })

  it('publishes converted modes as embedded animations', () => {
    const mode = parseMode({ name: 'B', type: 'animation', brightness: 128, animation: 'breathe', color }, 0)!
    expect(modeToPayload(mode).animation).toEqual(legacyAnimation('breathe', color))
  })
})

describe('config size', () => {
  const mode = (animation: Animation): Mode => ({ name: 'M', type: 'animation', brightness: 128, animation })

  it('measures the published payload in bytes', () => {
    const modes = [mode(sunrise)]
    expect(configSize(modes)).toEqual({ bytes: new TextEncoder().encode(configPayload(modes)).length, fits: true })
  })

  it('refuses a config over the lamp limit', () => {
    const big = { ...sunrise, name: 'x'.repeat(MAX_CONFIG_BYTES) }
    expect(configSize([mode(big)]).fits).toBe(false)
  })
})
