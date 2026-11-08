import { describe, expect, it } from 'vitest'
import { render, regionMask } from './engine'
import { defaultAnimation, generatorLayer, keyframeLayer } from './defaults'
import type { RGB } from '../types'
import type { Animation, GeneratorName, Layer } from './types'

const anim = (layer: Layer, loopMs = 1000): Animation => ({ ...defaultAnimation(), loopMs, layers: [layer] })
const seeded = (g: GeneratorName, over: object = {}): Layer => ({ ...generatorLayer(g), seed: 5, ...over }) as Layer
const diff = (a: RGB, b: RGB) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
const ALL: GeneratorName[] = ['solid', 'bands', 'pulse', 'chase', 'sparkle', 'noise', 'strike', 'drops', 'ripple']

describe('ring geometry', () => {
  it.each([
    ['bands', seeded('bands')],
    ['noise', seeded('noise')],
    ['keyframes', keyframeLayer()],
  ])('%s has no seam where the ring closes', (_, layer) => {
    const a = anim(layer)
    for (const t of [0, 130, 420, 770]) {
      const leds = render(a, t, 2000)
      expect(diff(leds[1999], leds[0])).toBeLessThanOrEqual(3)
    }
  })

  it('noise rounds its scale to a whole number of features', () => {
    const a = anim(seeded('noise', { params: { ...generatorLayer('noise').params, scale: 3.4 } }))
    const b = anim(seeded('noise', { params: { ...generatorLayer('noise').params, scale: 3 } }))
    expect(render(a, 200, 46)).toEqual(render(b, 200, 46))
  })
})

describe('mirror', () => {
  it.each(ALL)('%s looks the same on both sides of the ring', g => {
    const a = anim(seeded(g, { mirror: true }))
    for (const t of [0, 90, 333, 610, 900]) {
      const leds = render(a, t, 46)
      for (let k = 1; k < 23; k++) expect(diff(leds[k], leds[46 - k])).toBeLessThanOrEqual(1)
    }
  })

  it('maps bottom to the start and top to the end of the layer', () => {
    const red = { r: 255, g: 0, b: 0 }
    const blue = { r: 0, g: 0, b: 255 }
    const layer = { ...generatorLayer('bands'), mirror: true, params: { colors: [red, blue], edge: 'hard', repeat: 1, scroll: 0 } } as Layer
    const leds = render(anim(layer), 0, 8)
    // Half-ring coordinate: LED 0 → 0, LED 1 → 0.25, LED 2 → 0.5, LED 4 → 1 (top, wraps to red).
    expect([leds[0], leds[1], leds[2], leds[3]]).toEqual([red, red, blue, blue])
  })

  it('a mirrored keyframe layer does not wrap from top to bottom', () => {
    const layer = keyframeLayer()
    layer.mirror = true
    layer.keyframes = [{ at: 0, easing: 'linear', edge: 'smooth', stops: [{ position: 0, color: { r: 255, g: 0, b: 0 } }, { position: 1, color: { r: 0, g: 0, b: 255 } }] }]
    const leds = render(anim(layer), 0, 46)
    expect(leds[0]).toEqual({ r: 255, g: 0, b: 0 })
    expect(leds[23]).toEqual({ r: 0, g: 0, b: 255 })
  })
})

describe('regions', () => {
  it('whole ring when from equals to', () => {
    expect(regionMask({ from: 0.3, to: 0.3, softness: 0 }, 0.9)).toBe(1)
  })

  it('top half covers 0.25–0.75 only', () => {
    const top = { from: 0.25, to: 0.75, softness: 0 }
    expect(regionMask(top, 0.5)).toBe(1)
    expect(regionMask(top, 0.3)).toBe(1)
    expect(regionMask(top, 0.1)).toBe(0)
    expect(regionMask(top, 0.9)).toBe(0)
  })

  it('bottom half wraps through position 0', () => {
    const bottom = { from: 0.75, to: 0.25, softness: 0 }
    expect(regionMask(bottom, 0)).toBe(1)
    expect(regionMask(bottom, 0.9)).toBe(1)
    expect(regionMask(bottom, 0.5)).toBe(0)
  })

  it('softness ramps in from the edges', () => {
    const r = { from: 0.25, to: 0.75, softness: 0.1 }
    expect(regionMask(r, 0.3)).toBeCloseTo(0.5)
    expect(regionMask(r, 0.4)).toBe(1)
    expect(regionMask(r, 0.7)).toBeCloseTo(0.5)
  })

  it('top and bottom halves show different layers', () => {
    const solid = (r: number, b: number, region: Layer['region']) =>
      ({ ...generatorLayer('solid'), params: { color: { r, g: 0, b } }, region }) as Layer
    const a: Animation = {
      ...defaultAnimation(),
      layers: [solid(255, 0, { from: 0.75, to: 0.25, softness: 0 }), solid(0, 255, { from: 0.25, to: 0.75, softness: 0 })],
    }
    const leds = render(a, 0, 46)
    expect(leds[0]).toEqual({ r: 255, g: 0, b: 0 })
    expect(leds[23]).toEqual({ r: 0, g: 0, b: 255 })
  })
})

describe('new random generators', () => {
  it.each(['strike', 'drops', 'ripple'] as const)('%s is deterministic and loops seamlessly', g => {
    const a = anim(seeded(g, { params: { ...generatorLayer(g).params, rate: 4 } }))
    expect(render(a, 321, 46)).toEqual(render(a, 321, 46))
    for (const t of [0, 10, 500]) expect(render(a, 1000 + t, 46)).toEqual(render(a, t, 46))
  })

  it.each(['strike', 'drops', 'ripple'] as const)('%s changes with the seed', g => {
    const params = { ...generatorLayer(g).params, rate: 4 }
    const frames = (seed: number) => [0, 200, 400, 600, 800].map(t => render(anim(seeded(g, { seed, params })), t, 46))
    expect(frames(1)).not.toEqual(frames(2))
  })

  it.each(['strike', 'drops', 'ripple'] as const)('free-running %s follows the clock', g => {
    const a = anim(seeded(g, { freeRunning: true, params: { ...generatorLayer(g).params, rate: 4 } }))
    expect(render(a, 0, 46, 300)).toEqual(render(a, 700, 46, 300))
  })
})

const lit = (leds: RGB[]) => leds.flatMap((c, i) => (c.r + c.g + c.b > 0 ? [i] : []))

describe('strike', () => {
  const strike = (over: object) =>
    anim(seeded('strike', { params: { ...generatorLayer('strike').params, ...over } }), 10000)

  it('is mostly dark and sometimes flashes brightly', () => {
    const a = strike({ rate: 2 })
    const peaks = Array.from({ length: 1000 }, (_, k) => Math.max(...render(a, k * 10, 46).map(c => c.b)))
    const dark = peaks.filter(p => p === 0).length
    expect(dark).toBeGreaterThan(500)
    expect(Math.max(...peaks)).toBeGreaterThan(150)
  })

  it('rate 0 never strikes', () => {
    const a = strike({ rate: 0 })
    for (let t = 0; t < 10000; t += 97) expect(lit(render(a, t, 46))).toEqual([])
  })

  it('origin top centers strikes at the top', () => {
    const a = strike({ rate: 8, origin: 'top', width: 0.05 })
    for (let t = 0; t < 10000; t += 13) {
      const leds = lit(render(a, t, 46))
      for (const i of leds) expect(Math.abs(i - 23)).toBeLessThanOrEqual(4)
    }
  })
})

describe('drops', () => {
  it('fall toward position 0', () => {
    const a = anim(seeded('drops', { params: { ...generatorLayer('drops').params, rate: 1, variation: 0, length: 0, speed: 1 } }))
    const brightest = (t: number) => {
      const leds = render(a, t, 100)
      return leds.reduce((best, c, i) => (c.b > leds[best].b ? i : best), 0)
    }
    let moved = 0
    for (let t = 100; t < 900; t += 100) {
      const before = brightest(t)
      const after = brightest(t + 50)
      if (render(a, t, 100)[before].b > 0 && render(a, t + 50, 100)[after].b > 0) {
        expect((before - after + 100) % 100).toBeGreaterThan(0)
        expect((before - after + 100) % 100).toBeLessThan(10)
        moved++
      }
    }
    expect(moved).toBeGreaterThan(0)
  })
})

describe('ripple', () => {
  it('sends two fronts outward in opposite directions', () => {
    const a = anim(seeded('ripple', { params: { ...generatorLayer('ripple').params, rate: 1, life: 0.9, width: 0.02 } }))
    // With seed 5 the ripple starts near LED 92 of 200 at about 0.55 s, away from the ring's 0/1 join.
    const fronts = (t: number) => {
      const on = lit(render(a, t, 200))
      return [Math.min(...on), Math.max(...on)]
    }
    const [lo1, hi1] = fronts(600)
    const [lo2, hi2] = fronts(900)
    expect(lo2).toBeLessThan(lo1)
    expect(hi2).toBeGreaterThan(hi1)
    expect(92 - lo2).toBeCloseTo(hi2 - 92, -1)
  })
})
