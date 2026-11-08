import { describe, expect, it } from 'vitest'
import { cycleMs, render } from './engine'
import { defaultAnimation, generatorLayer } from './defaults'
import type { Animation, Layer } from './types'

const solid = (r: number, g: number, b: number, over: Partial<Pick<Layer, 'blend' | 'opacity' | 'speed' | 'hidden'>> = {}): Layer => ({
  blend: 'normal', opacity: 1, speed: 1, hidden: false, generator: 'solid', params: { color: { r, g, b } }, ...over,
})
const anim = (...layers: Layer[]): Animation => ({ ...defaultAnimation(), layers })

describe('render', () => {
  it('returns one color per LED', () => {
    expect(render(anim(solid(1, 2, 3)), 0, 46)).toHaveLength(46)
    expect(render(anim(solid(1, 2, 3)), 0, 24)).toHaveLength(24)
  })

  it('solid fills every LED with its color', () => {
    const leds = render(anim(solid(10, 20, 30)), 1234, 46)
    expect(new Set(leds.map(c => `${c.r},${c.g},${c.b}`))).toEqual(new Set(['10,20,30']))
  })

  it('loops seamlessly: t=0 equals t=loopMs', () => {
    const a = anim(solid(10, 20, 30))
    expect(render(a, a.loopMs, 46)).toEqual(render(a, 0, 46))
  })

  it('hidden layers have no effect', () => {
    expect(render(anim(solid(10, 20, 30), solid(255, 0, 0, { hidden: true })), 0, 3)[0]).toEqual({ r: 10, g: 20, b: 30 })
  })

  it('normal blending mixes by opacity', () => {
    expect(render(anim(solid(0, 0, 0), solid(200, 100, 0, { opacity: 0.5 })), 0, 1)[0]).toEqual({ r: 100, g: 50, b: 0 })
  })

  it('add blending sums and clamps at 255', () => {
    expect(render(anim(solid(200, 10, 0), solid(100, 10, 0, { blend: 'add' })), 0, 1)[0]).toEqual({ r: 255, g: 20, b: 0 })
  })
})

describe('layers and timing', () => {
  const bandsLayer = (speed: Layer['speed']): Layer => ({
    ...generatorLayer('bands'),
    speed,
  })

  it.each([0.5, 1, 2, 4] as const)('loops seamlessly at speed ×%s over the full cycle', speed => {
    const a = { ...anim(bandsLayer(speed)), loopMs: 1000 }
    expect(render(a, cycleMs(a), 46)).toEqual(render(a, 0, 46))
    expect(render(a, 300, 46)).not.toEqual(render(a, 0, 46))
  })

  it('a ×½ layer doubles the cycle; other speeds keep the loop', () => {
    expect(cycleMs({ ...anim(bandsLayer(0.5)), loopMs: 1000 })).toBe(2000)
    expect(cycleMs({ ...anim(bandsLayer(4)), loopMs: 1000 })).toBe(1000)
  })

  it('a ×2 layer at half the loop matches a ×1 layer at the full cycle start', () => {
    const fast = { ...anim(bandsLayer(2)), loopMs: 1000 }
    const slow = { ...anim(bandsLayer(1)), loopMs: 1000 }
    expect(render(fast, 250, 46)).toEqual(render(slow, 500, 46))
  })

  it('the top layer covers lower ones with normal blending at full opacity', () => {
    expect(render(anim(solid(255, 0, 0), solid(0, 255, 0)), 0, 1)[0]).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('reordering layers changes the result', () => {
    const red = solid(255, 0, 0)
    const green = solid(0, 255, 0, { opacity: 0.5 })
    expect(render(anim(red, green), 0, 1)).not.toEqual(render(anim(green, red), 0, 1))
  })
})
