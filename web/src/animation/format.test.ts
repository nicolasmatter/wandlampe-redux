import { describe, expect, it } from 'vitest'
import { animationFileName, parseAnimation, serializeAnimation } from './format'
import { defaultAnimation, generatorLayer, keyframeLayer } from './defaults'

describe('parseAnimation', () => {
  it('round-trips a valid animation', () => {
    const a = defaultAnimation()
    expect(parseAnimation(JSON.parse(serializeAnimation(a)))).toEqual({ ok: true, animation: a })
  })

  it('accepts six layers and rejects a seventh', () => {
    const a = defaultAnimation()
    expect(parseAnimation({ ...a, layers: Array(6).fill(a.layers[0]) }).ok).toBe(true)
    const r = parseAnimation({ ...a, layers: Array(7).fill(a.layers[0]) })
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

describe('full format', () => {
  const withLayer = (layer: unknown) => ({ ...defaultAnimation(), layers: [layer] })

  it('round-trips every generator and a keyframe layer', () => {
    const a = {
      ...defaultAnimation(),
      layers: [generatorLayer('noise'), keyframeLayer(), { ...generatorLayer('chase'), blend: 'add' as const, opacity: 0.5, speed: 2 as const }],
    }
    expect(parseAnimation(JSON.parse(serializeAnimation(a)))).toEqual({ ok: true, animation: a })
    for (const g of ['sparkle', 'noise', 'chase'] as const) expect(parseAnimation(withLayer(generatorLayer(g))).ok).toBe(true)
  })

  it('requires a seed on random layers', () => {
    const layer = generatorLayer('sparkle') as Partial<{ seed: number }>
    delete layer.seed
    const r = parseAnimation(withLayer(layer))
    expect(r).toEqual({ ok: false, errors: ['layers[0].seed must be an integer 0–4294967295'] })
  })

  it('rejects keyframe stops outside the strip', () => {
    const layer = keyframeLayer()
    layer.keyframes[0].stops[0].position = 1.5
    expect(parseAnimation(withLayer(layer))).toEqual({
      ok: false,
      errors: ['layers[0].keyframes[0].stops[0].position must be a number 0–1'],
    })
  })

  it('rejects two keyframes at the same time', () => {
    const layer = keyframeLayer()
    layer.keyframes[1].at = 0
    const r = parseAnimation(withLayer(layer))
    expect(r.ok === false && r.errors).toEqual(['layers[0].keyframes[1].at duplicates another keyframe'])
  })

  it('rejects an unknown speed and a missing name', () => {
    const r = parseAnimation({ ...defaultAnimation(), name: '', layers: [{ ...generatorLayer('solid'), speed: 3 }] })
    expect(r.ok === false && r.errors).toEqual([
      'name must be a non-empty string',
      'layers[0].speed must be one of 0.5, 1, 2, 4',
    ])
  })
})

describe('animationFileName', () => {
  it('makes a safe slug', () => {
    expect(animationFileName('Fire & Ice / Ü')).toBe('fire-ice-u.json')
    expect(animationFileName('../../etc')).toBe('etc.json')
    expect(animationFileName('  ')).toBe('untitled.json')
  })
})

describe('ring fields', () => {
  const withLayer = (layer: unknown) => ({ ...defaultAnimation(), layers: [layer] })

  it('requires mirror on every layer', () => {
    const layer: Partial<{ mirror: boolean }> = { ...generatorLayer('solid') }
    delete layer.mirror
    expect(parseAnimation(withLayer(layer))).toEqual({ ok: false, errors: ['layers[0].mirror must be one of true, false'] })
  })

  it('validates regions', () => {
    const r = parseAnimation(withLayer({ ...generatorLayer('solid'), region: { from: 0.25, to: 1.2, softness: 0 } }))
    expect(r).toEqual({ ok: false, errors: ['layers[0].region.to must be a number 0–1'] })
    expect(parseAnimation(withLayer({ ...generatorLayer('solid'), region: { from: 0.25, to: 0.75, softness: 0.1 } })).ok).toBe(true)
  })

  it('accepts the new generators and requires an integer noise scale', () => {
    for (const g of ['strike', 'drops', 'ripple'] as const) expect(parseAnimation(withLayer(generatorLayer(g))).ok).toBe(true)
    const noise = generatorLayer('noise')
    const r = parseAnimation(withLayer({ ...noise, params: { ...noise.params, scale: 2.5 } }))
    expect(r.ok === false && r.errors).toEqual(['layers[0].params.scale must be an integer 1–16'])
  })
})
