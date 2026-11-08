import { describe, expect, it } from 'vitest'
import { parseAnimation, serializeAnimation } from './format'
import { defaultAnimation, generatorLayer } from './defaults'

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

describe('generator params', () => {
  const withLayer = (layer: unknown) => ({ ...defaultAnimation(), layers: [layer] })

  it('accepts every generator with default params', () => {
    for (const g of ['solid', 'bands', 'pulse'] as const) {
      expect(parseAnimation(withLayer(generatorLayer(g))).ok).toBe(true)
    }
  })

  it('rejects bands with a single color', () => {
    const layer = generatorLayer('bands')
    const r = parseAnimation(withLayer({ ...layer, params: { ...layer.params, colors: [{ r: 0, g: 0, b: 0 }] } }))
    expect(r).toEqual({ ok: false, errors: ['layers[0].params.colors must hold 2–8 colors'] })
  })

  it('rejects an unknown pulse curve', () => {
    const layer = generatorLayer('pulse')
    const r = parseAnimation(withLayer({ ...layer, params: { ...layer.params, curve: 'square' } }))
    expect(r.ok).toBe(false)
  })
})
