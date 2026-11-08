import { describe, expect, it } from 'vitest'
import { render } from './engine'
import { defaultAnimation, generatorLayer } from './defaults'
import type { Animation, BandsParams, Layer, PulseParams } from './types'

const RED = { r: 255, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 255 }
const anim = (layer: Layer): Animation => ({ ...defaultAnimation(), loopMs: 1000, layers: [layer] })
const bands = (p: Partial<BandsParams>): Animation =>
  anim({ ...generatorLayer('bands'), params: { colors: [RED, BLUE], edge: 'hard', repeat: 1, scroll: 0, ...p } } as Layer)
const pulse = (p: Partial<PulseParams>): Animation =>
  anim({ ...generatorLayer('pulse'), params: { color: { r: 200, g: 100, b: 0 }, min: 0, max: 255, curve: 'sine', ...p } } as Layer)

describe('bands', () => {
  it('hard edges split the strip evenly between colors', () => {
    const leds = render(bands({}), 0, 4)
    expect(leds).toEqual([RED, RED, BLUE, BLUE])
  })

  it('repeat tiles the pattern across the strip', () => {
    expect(render(bands({ repeat: 2 }), 0, 4)).toEqual([RED, BLUE, RED, BLUE])
  })

  it('is count independent: LEDs at the same relative position match', () => {
    const a = bands({ edge: 'smooth', repeat: 3, scroll: 1 })
    // Centers of LED 0 of 1, LED 1 of 3, LED 4 of 9 and LED 22 of 45 are all at 0.5.
    const expected = render(a, 250, 1)[0]
    expect(render(a, 250, 3)[1]).toEqual(expected)
    expect(render(a, 250, 9)[4]).toEqual(expected)
    expect(render(a, 250, 45)[22]).toEqual(expected)
  })

  it('smooth edges blend into the next color and wrap back to the first', () => {
    const leds = render(bands({ edge: 'smooth' }), 0, 4)
    // Position 0.125 is a quarter of the way from red to blue; 0.875 is three quarters from blue back to red.
    expect(leds[0]).toEqual({ r: 191, g: 0, b: 64 })
    expect(leds[3]).toEqual({ r: 191, g: 0, b: 64 })
    expect(leds[1]).toEqual({ r: 64, g: 0, b: 191 })
  })

  it('scrolling moves the pattern and loops seamlessly', () => {
    const a = bands({ scroll: 1, repeat: 2, edge: 'smooth' })
    expect(render(a, 300, 46)).not.toEqual(render(a, 0, 46))
    expect(render(a, 1000, 46)).toEqual(render(a, 0, 46))
  })

  it('scrolling backward mirrors scrolling forward in time', () => {
    const fwd = bands({ scroll: 1, edge: 'smooth' })
    const back = bands({ scroll: -1, edge: 'smooth' })
    expect(render(back, 250, 8)).toEqual(render(fwd, 750, 8))
  })
})

describe('pulse', () => {
  it('sits at min at the cycle start and max at its peak', () => {
    expect(render(pulse({ min: 0 }), 0, 1)[0]).toEqual({ r: 0, g: 0, b: 0 })
    expect(render(pulse({ min: 0 }), 500, 1)[0]).toEqual({ r: 200, g: 100, b: 0 })
  })

  it('never leaves the min–max range', () => {
    const a = pulse({ min: 51, max: 102, curve: 'sharp' })
    for (let t = 0; t < 1000; t += 37) {
      const { r } = render(a, t, 1)[0]
      expect(r).toBeGreaterThanOrEqual(40)
      expect(r).toBeLessThanOrEqual(80)
    }
  })

  it('sharp peaks early and decays', () => {
    const a = pulse({ curve: 'sharp' })
    expect(render(a, 100, 1)[0].r).toBe(200)
    expect(render(a, 500, 1)[0].r).toBeLessThan(render(a, 200, 1)[0].r)
  })

  it('is uniform across the strip and loops seamlessly', () => {
    const a = pulse({})
    expect(new Set(render(a, 300, 46).map(c => c.r)).size).toBe(1)
    expect(render(a, 1000, 46)).toEqual(render(a, 0, 46))
  })
})
