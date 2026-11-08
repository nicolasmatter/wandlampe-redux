import { describe, expect, it } from 'vitest'
import { render } from './engine'
import { defaultAnimation, generatorLayer } from './defaults'
import type { Animation, BandsParams, ChaseParams, Layer, PulseParams, RandomFields, SparkleParams } from './types'

const RED = { r: 255, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 255 }
const WHITE = { r: 255, g: 255, b: 255 }
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

const chase = (p: Partial<ChaseParams>): Animation =>
  anim({ ...generatorLayer('chase'), params: { color: WHITE, width: 0.1, tail: 0, count: 1, direction: 1, bounce: false, ...p } } as Layer)
const lit = (leds: { r: number }[]) => leds.flatMap((c, i) => (c.r > 0 ? [i] : []))

describe('chase', () => {
  // With 20 LEDs, LED i is centered at 0.025 + 0.05 i. Heads are placed on centers to avoid boundary rounding.
  it('moves its head one strip length per cycle', () => {
    const a = chase({ width: 0.04 })
    expect(lit(render(a, 25, 20))).toEqual([0])
    expect(lit(render(a, 525, 20))).toEqual([10])
    expect(render(a, 1000, 20)).toEqual(render(a, 0, 20))
  })

  it('runs backward with direction -1', () => {
    expect(lit(render(chase({ width: 0.04, direction: -1 }), 475, 20))).toEqual([10])
  })

  it('fades a tail behind the head only', () => {
    const leds = render(chase({ width: 0.04, tail: 0.3 }), 525, 20)
    expect(leds[10].r).toBe(255)
    expect(leds[7].r).toBeGreaterThan(0)
    expect(leds[7].r).toBeLessThan(leds[9].r)
    expect(leds[12].r).toBe(0)
  })

  it('spaces several dots evenly', () => {
    expect(lit(render(chase({ count: 2, width: 0.04 }), 275, 20))).toEqual([5, 15])
  })

  it('bounces back and loops seamlessly', () => {
    const a = chase({ bounce: true, width: 0.06 })
    expect(lit(render(a, 262.5, 20))).toEqual([10])
    expect(lit(render(a, 737.5, 20))).toEqual([10])
    expect(lit(render(a, 500, 20))).toEqual([19])
    expect(render(a, 1000, 20)).toEqual(render(a, 0, 20))
  })

  it('the tail follows the travel direction when bouncing', () => {
    const a = chase({ bounce: true, width: 0.04, tail: 0.2 })
    expect(render(a, 262.5, 20)[8].r).toBeGreaterThan(0)
    expect(render(a, 262.5, 20)[12].r).toBe(0)
    expect(render(a, 737.5, 20)[12].r).toBeGreaterThan(0)
    expect(render(a, 737.5, 20)[8].r).toBe(0)
  })
})

const sparkle = (over: Partial<SparkleParams> = {}, layer: Partial<RandomFields> = {}): Animation =>
  anim({ ...generatorLayer('sparkle'), seed: 42, freeRunning: false, params: { color: WHITE, density: 0.3, fade: 0.2, ...over }, ...layer } as Layer)
const noise = (layer: Partial<RandomFields> = {}): Animation =>
  anim({ ...generatorLayer('noise'), seed: 7, freeRunning: false, ...layer } as Layer)

describe('random generators', () => {
  it.each([['sparkle', sparkle()], ['noise', noise()]])('%s is deterministic for a seed', (_, a) => {
    expect(render(a, 321, 46)).toEqual(render(a, 321, 46))
  })

  it.each([['sparkle', sparkle()], ['noise', noise()]])('%s loops seamlessly', (_, a) => {
    expect(render(a, 1000, 46)).toEqual(render(a, 0, 46))
    expect(render(a, 1250, 46)).toEqual(render(a, 250, 46))
  })

  it.each([
    ['sparkle', sparkle({}, { seed: 1 }), sparkle({}, { seed: 2 })],
    ['noise', noise({ seed: 1 }), noise({ seed: 2 })],
  ])('%s changes with the seed', (_, a, b) => {
    expect(render(a, 300, 46)).not.toEqual(render(b, 300, 46))
  })

  it('sparkle density 0 stays dark and higher density lights more LEDs', () => {
    const count = (a: Animation) => {
      let n = 0
      for (let t = 0; t < 1000; t += 50) n += lit(render(a, t, 46)).length
      return n
    }
    expect(count(sparkle({ density: 0 }))).toBe(0)
    expect(count(sparkle({ density: 0.6 }))).toBeGreaterThan(count(sparkle({ density: 0.1 })))
  })

  it('noise stays within the palette brightness range', () => {
    const leds = render(noise(), 400, 46)
    expect(Math.max(...leds.map(c => c.r))).toBeLessThanOrEqual(255)
    expect(new Set(leds.map(c => c.r)).size).toBeGreaterThan(5)
  })

  it.each([['sparkle', sparkle({}, { freeRunning: true })], ['noise', noise({ freeRunning: true })]])(
    'free-running %s follows the clock and does not repeat per loop',
    (_, a) => {
      expect(render(a, 0, 46, 250)).not.toEqual(render(a, 0, 46, 1250))
      expect(render(a, 0, 46, 250)).toEqual(render(a, 500, 46, 250))
    },
  )
})
