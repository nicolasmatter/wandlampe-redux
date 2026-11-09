import { describe, expect, it } from 'vitest'
import { render } from './engine'
import { defaultAnimation, generatorLayer } from './defaults'
import type { Animation, Easing, Keyframe, Layer } from './types'

const RED = { r: 255, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 255 }
const kf = (at: number, color: typeof RED, easing: Easing = 'linear', extra: Partial<Keyframe> = {}): Keyframe => ({
  at, easing, edge: 'smooth', stops: [{ position: 0, color }], ...extra,
})
const anim = (...keyframes: Keyframe[]): Animation => ({
  ...defaultAnimation(),
  loopMs: 1000,
  layers: [{ blend: 'normal', opacity: 1, speed: 1, hidden: false, mirror: false, keyframes }],
})

describe('keyframes', () => {
  it('a single keyframe holds still', () => {
    const a = anim(kf(0.3, RED))
    expect(render(a, 0, 4)).toEqual(render(a, 700, 4))
  })

  it('linear easing moves evenly between keyframes', () => {
    expect(render(anim(kf(0, RED), kf(0.5, BLUE)), 125, 1)[0]).toEqual({ r: 191, g: 0, b: 64 })
  })

  it('ease-in-out starts slower than linear', () => {
    const linear = render(anim(kf(0, RED), kf(0.5, BLUE)), 100, 1)[0]
    const eased = render(anim(kf(0, RED, 'ease-in-out'), kf(0.5, BLUE)), 100, 1)[0]
    expect(eased.r).toBeGreaterThan(linear.r)
    expect(render(anim(kf(0, RED, 'ease-in-out'), kf(0.5, BLUE)), 250, 1)[0]).toEqual({ r: 128, g: 0, b: 128 })
  })

  it('step holds until the next keyframe', () => {
    const a = anim(kf(0, RED, 'step'), kf(0.5, BLUE, 'step'))
    expect(render(a, 499, 1)[0]).toEqual(RED)
    expect(render(a, 500, 1)[0]).toEqual(BLUE)
  })

  it('wraps from the last keyframe back into the first', () => {
    const a = anim(kf(0.25, RED), kf(0.75, BLUE))
    // Halfway from 0.75 (blue) to 1.25 (red) is phase 0.
    expect(render(a, 0, 1)[0]).toEqual({ r: 128, g: 0, b: 128 })
    expect(render(a, 1000, 1)).toEqual(render(a, 0, 1))
  })

  it('moves stop positions between keyframes with matching stop counts', () => {
    const stops = (p: number) => [
      { position: 0, color: RED },
      { position: p, color: BLUE },
    ]
    const a = anim(
      kf(0, RED, 'linear', { edge: 'hard', stops: stops(0.2) }),
      kf(0.5, RED, 'linear', { edge: 'hard', stops: stops(0.8) }),
    )
    // Halfway, the blue stop is at 0.5: red before it, blue from there to the end of the ring.
    const leds = render(a, 250, 10)
    expect(leds[4]).toEqual(RED)
    expect(leds[6]).toEqual(BLUE)
  })

  it('stops wrap around the ring: the last stop blends into the first across position 0', () => {
    const a = anim(kf(0, RED, 'linear', { stops: [{ position: 0.25, color: RED }, { position: 0.75, color: BLUE }] }))
    // Position 0 is halfway from blue (0.75) to red (1.25).
    expect(render(a, 0, 4)[0]).toEqual({ r: 128, g: 0, b: 128 })
  })

  it('is count independent', () => {
    const a = anim(kf(0, RED, 'linear', { stops: [{ position: 0, color: RED }, { position: 0.6, color: BLUE }] }), kf(0.5, BLUE))
    expect(render(a, 200, 4)[2]).toEqual(render(a, 200, 2)[1])
    expect(render(a, 200, 46)[23]).toEqual(render(a, 200, 2)[1])
  })

  it('combines with generator layers', () => {
    const a = anim(kf(0, { r: 100, g: 0, b: 0 }))
    const solid = { ...generatorLayer('solid'), params: { color: { r: 0, g: 50, b: 0 } }, blend: 'add' } as Layer
    a.layers.push(solid)
    expect(render(a, 0, 1)[0]).toEqual({ r: 100, g: 50, b: 0 })
  })
})
