import { describe, expect, it } from 'vitest'
import { animationFileName, parseAnimation } from './format'

const files = import.meta.glob('../../../animations/*.json', { eager: true, import: 'default' })

describe('committed animations', () => {
  it('exist', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0)
  })

  it.each(Object.entries(files))('%s is a valid animation named after its file', (path, json) => {
    const result = parseAnimation(json)
    expect(result.ok ? [] : result.errors).toEqual([])
    if (result.ok) expect(path.endsWith(`/${animationFileName(result.animation.name)}`)).toBe(true)
  })
})
