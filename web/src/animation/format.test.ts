import { describe, expect, it } from 'vitest'
import { parseAnimation, serializeAnimation } from './format'
import { defaultAnimation } from './defaults'

describe('parseAnimation', () => {
  it('round-trips a valid animation', () => {
    const a = defaultAnimation()
    expect(parseAnimation(JSON.parse(serializeAnimation(a)))).toEqual({ ok: true, animation: a })
  })

  it('rejects more than three layers', () => {
    const a = defaultAnimation()
    const r = parseAnimation({ ...a, layers: [a.layers[0], a.layers[0], a.layers[0], a.layers[0]] })
    expect(r.ok).toBe(false)
  })

  it('rejects an unknown generator with a message naming it', () => {
    const a = defaultAnimation()
    const r = parseAnimation({ ...a, layers: [{ ...a.layers[0], generator: 'lava' }] })
    expect(r).toEqual({ ok: false, errors: ['layers[0].generator "lava" is unknown'] })
  })

  it('rejects out-of-range colors', () => {
    const a = defaultAnimation()
    const r = parseAnimation({ ...a, layers: [{ ...a.layers[0], params: { color: { r: 300, g: 0, b: 0 } } }] })
    expect(r.ok).toBe(false)
  })
})
