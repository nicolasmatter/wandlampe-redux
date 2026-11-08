import {
  ANIMATION_FORMAT_VERSION,
  MAX_KEYFRAMES,
  MAX_LAYERS,
  MAX_PALETTE_COLORS,
  MAX_STOPS,
  MIN_PALETTE_COLORS,
  RANDOM_GENERATORS,
  SPEEDS,
  type Animation,
  type Layer,
} from './types'

export type ParseResult = { ok: true; animation: Animation } | { ok: false; errors: string[] }

type Errors = string[]
type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIntIn = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isNumIn = (v: unknown, min: number, max: number) => typeof v === 'number' && v >= min && v <= max

function checkColor(v: unknown, path: string, errors: Errors) {
  if (!(isObject(v) && isIntIn(v.r, 0, 255) && isIntIn(v.g, 0, 255) && isIntIn(v.b, 0, 255))) {
    errors.push(`${path} must be {r,g,b} with integers 0–255`)
  }
}

function checkOneOf(v: unknown, allowed: readonly unknown[], path: string, errors: Errors) {
  if (!allowed.includes(v)) errors.push(`${path} must be one of ${allowed.map(a => JSON.stringify(a)).join(', ')}`)
}

function checkRange(v: unknown, min: number, max: number, path: string, errors: Errors, int = false) {
  if (!(int ? isIntIn(v, min, max) : isNumIn(v, min, max))) errors.push(`${path} must be ${int ? 'an integer' : 'a number'} ${min}–${max}`)
}

function checkPalette(v: unknown, path: string, errors: Errors) {
  if (!Array.isArray(v) || v.length < MIN_PALETTE_COLORS || v.length > MAX_PALETTE_COLORS) {
    errors.push(`${path} must hold ${MIN_PALETTE_COLORS}–${MAX_PALETTE_COLORS} colors`)
  } else {
    v.forEach((c, i) => checkColor(c, `${path}[${i}]`, errors))
  }
}

const PARAM_CHECKS: Record<string, (p: Obj, path: string, errors: Errors) => void> = {
  solid: (p, path, e) => checkColor(p.color, `${path}.color`, e),
  bands: (p, path, e) => {
    checkPalette(p.colors, `${path}.colors`, e)
    checkOneOf(p.edge, ['smooth', 'hard'], `${path}.edge`, e)
    checkRange(p.repeat, 1, 16, `${path}.repeat`, e, true)
    checkOneOf(p.scroll, [-1, 0, 1], `${path}.scroll`, e)
  },
  pulse: (p, path, e) => {
    checkColor(p.color, `${path}.color`, e)
    checkRange(p.min, 0, 255, `${path}.min`, e, true)
    checkRange(p.max, 0, 255, `${path}.max`, e, true)
    checkOneOf(p.curve, ['sine', 'sharp'], `${path}.curve`, e)
  },
  chase: (p, path, e) => {
    checkColor(p.color, `${path}.color`, e)
    checkRange(p.width, 0, 1, `${path}.width`, e)
    checkRange(p.tail, 0, 1, `${path}.tail`, e)
    checkRange(p.count, 1, 8, `${path}.count`, e, true)
    checkOneOf(p.direction, [1, -1], `${path}.direction`, e)
    checkOneOf(p.bounce, [true, false], `${path}.bounce`, e)
  },
  sparkle: (p, path, e) => {
    checkColor(p.color, `${path}.color`, e)
    checkRange(p.density, 0, 1, `${path}.density`, e)
    checkRange(p.fade, 0.01, 1, `${path}.fade`, e)
  },
  noise: (p, path, e) => {
    checkPalette(p.colors, `${path}.colors`, e)
    checkRange(p.scale, 1, 16, `${path}.scale`, e)
  },
}

function checkKeyframes(v: unknown, path: string, errors: Errors) {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_KEYFRAMES) {
    errors.push(`${path} must hold 1–${MAX_KEYFRAMES} keyframes`)
    return
  }
  v.forEach((k, i) => {
    const kp = `${path}[${i}]`
    if (!isObject(k)) return void errors.push(`${kp} must be an object`)
    checkRange(k.at, 0, 1, `${kp}.at`, errors)
    if (isNumIn(k.at, 0, 1) && v.some((o, j) => j < i && isObject(o) && o.at === k.at)) {
      errors.push(`${kp}.at duplicates another keyframe`)
    }
    checkOneOf(k.easing, ['linear', 'ease-in-out', 'step'], `${kp}.easing`, errors)
    checkOneOf(k.edge, ['smooth', 'hard'], `${kp}.edge`, errors)
    if (!Array.isArray(k.stops) || k.stops.length < 1 || k.stops.length > MAX_STOPS) {
      errors.push(`${kp}.stops must hold 1–${MAX_STOPS} color stops`)
      return
    }
    k.stops.forEach((s, j) => {
      const sp = `${kp}.stops[${j}]`
      if (!isObject(s)) return void errors.push(`${sp} must be an object`)
      checkRange(s.position, 0, 1, `${sp}.position`, errors)
      checkColor(s.color, `${sp}.color`, errors)
    })
  })
}

function parseLayer(v: unknown, path: string, errors: Errors): Layer | null {
  if (!isObject(v)) {
    errors.push(`${path} must be an object`)
    return null
  }
  const before = errors.length
  checkOneOf(v.blend, ['normal', 'add'], `${path}.blend`, errors)
  checkRange(v.opacity, 0, 1, `${path}.opacity`, errors)
  checkOneOf(v.speed, SPEEDS, `${path}.speed`, errors)
  checkOneOf(v.hidden, [true, false], `${path}.hidden`, errors)

  if ('keyframes' in v) {
    if ('generator' in v) errors.push(`${path} must have either "generator" or "keyframes", not both`)
    checkKeyframes(v.keyframes, `${path}.keyframes`, errors)
  } else {
    const check = PARAM_CHECKS[v.generator as string]
    if (!check) {
      errors.push(`${path}.generator "${String(v.generator)}" is unknown`)
    } else if (!isObject(v.params)) {
      errors.push(`${path}.params must be an object`)
    } else {
      check(v.params, `${path}.params`, errors)
    }
    if ((RANDOM_GENERATORS as readonly unknown[]).includes(v.generator)) {
      checkRange(v.seed, 0, 0xffffffff, `${path}.seed`, errors, true)
      checkOneOf(v.freeRunning, [true, false], `${path}.freeRunning`, errors)
    }
  }
  return errors.length === before ? (v as unknown as Layer) : null
}

/** Validates unknown JSON into an Animation, or lists every problem found. */
export function parseAnimation(v: unknown): ParseResult {
  const errors: Errors = []
  if (!isObject(v)) return { ok: false, errors: ['animation must be an object'] }
  if (v.version !== ANIMATION_FORMAT_VERSION) errors.push(`version must be ${ANIMATION_FORMAT_VERSION}`)
  if (typeof v.name !== 'string' || !v.name.trim()) errors.push('name must be a non-empty string')
  checkRange(v.loopMs, 100, 600000, 'loopMs', errors, true)
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

/** File name for an animation: lowercase letters, digits and dashes. */
export function animationFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'untitled'}.json`
}
