import type { RGB } from '../types'
import { ANIMATION_FORMAT_VERSION, MAX_LAYERS, type Animation, type Layer } from './types'

export type ParseResult = { ok: true; animation: Animation } | { ok: false; errors: string[] }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isByte = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255

function checkColor(v: unknown, path: string, errors: string[]): v is RGB {
  if (isObject(v) && isByte(v.r) && isByte(v.g) && isByte(v.b)) return true
  errors.push(`${path} must be {r,g,b} with integers 0–255`)
  return false
}

function parseLayer(v: unknown, path: string, errors: string[]): Layer | null {
  if (!isObject(v)) {
    errors.push(`${path} must be an object`)
    return null
  }
  const before = errors.length
  if (v.blend !== 'normal' && v.blend !== 'add') errors.push(`${path}.blend must be "normal" or "add"`)
  if (typeof v.opacity !== 'number' || v.opacity < 0 || v.opacity > 1) errors.push(`${path}.opacity must be 0–1`)
  if (![0.5, 1, 2, 4].includes(v.speed as number)) errors.push(`${path}.speed must be 0.5, 1, 2 or 4`)
  if (typeof v.hidden !== 'boolean') errors.push(`${path}.hidden must be a boolean`)
  if (v.generator !== 'solid') {
    errors.push(`${path}.generator "${String(v.generator)}" is unknown`)
  } else if (!isObject(v.params)) {
    errors.push(`${path}.params must be an object`)
  } else {
    checkColor(v.params.color, `${path}.params.color`, errors)
  }
  return errors.length === before ? (v as unknown as Layer) : null
}

/** Validates unknown JSON into an Animation, or lists every problem found. */
export function parseAnimation(v: unknown): ParseResult {
  const errors: string[] = []
  if (!isObject(v)) return { ok: false, errors: ['animation must be an object'] }
  if (v.version !== ANIMATION_FORMAT_VERSION) errors.push(`version must be ${ANIMATION_FORMAT_VERSION}`)
  if (typeof v.name !== 'string') errors.push('name must be a string')
  if (typeof v.loopMs !== 'number' || !(v.loopMs > 0)) errors.push('loopMs must be a positive number')
  const layers: Layer[] = []
  if (!Array.isArray(v.layers) || v.layers.length < 1 || v.layers.length > MAX_LAYERS) {
    errors.push(`layers must be an array of 1–${MAX_LAYERS} layers`)
  } else {
    v.layers.forEach((l, i) => {
      const layer = parseLayer(l, `layers[${i}]`, errors)
      if (layer) layers.push(layer)
    })
  }
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    animation: { version: ANIMATION_FORMAT_VERSION, name: v.name as string, loopMs: v.loopMs as number, layers },
  }
}

export function serializeAnimation(animation: Animation): string {
  return JSON.stringify(animation, null, 2) + '\n'
}
