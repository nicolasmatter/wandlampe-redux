import { LED_COUNT, MAX_MODES } from './config'
import type { AnimationId, Mode, ModeType, RGB } from './types'

const BLACK: RGB = { r: 0, g: 0, b: 0 }
const WHITE: RGB = { r: 255, g: 255, b: 255 }
const ORANGE: RGB = { r: 255, g: 180, b: 60 }
const TAU = Math.PI * 2

export function emptyLeds(): RGB[] {
  return Array(LED_COUNT).fill(BLACK)
}

function parseRgb(raw: unknown): RGB | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    r: typeof o.r === 'number' ? o.r : 0,
    g: typeof o.g === 'number' ? o.g : 0,
    b: typeof o.b === 'number' ? o.b : 0,
  }
}

function parseLeds(raw: unknown): RGB[] | null {
  if (!Array.isArray(raw) || raw.length < LED_COUNT) return null
  return raw.slice(0, LED_COUNT).map(led => parseRgb(led) ?? BLACK)
}

function parseModeType(raw: unknown): ModeType {
  if (
    raw === 'single-color' || raw === 'gradient' || raw === 'animation'
    || raw === 'alarm-clock' || raw === 'static'
  ) {
    return raw
  }
  return 'static'
}

function parseAnimation(raw: unknown): AnimationId {
  if (raw === 'rainbow' || raw === 'pulse' || raw === 'breathe') return raw
  return 'rainbow'
}

export function parseMode(raw: unknown, index: number): Mode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const type = parseModeType(o.type)
  const base: Mode = {
    name: typeof o.name === 'string' ? o.name : `Mode ${index + 1}`,
    type,
    brightness: typeof o.brightness === 'number' ? o.brightness : 255,
  }

  switch (type) {
    case 'single-color': {
      const color = parseRgb(o.color)
      if (!color) return null
      return { ...base, color }
    }
    case 'gradient': {
      const from = parseRgb(o.from)
      const to = parseRgb(o.to)
      if (!from || !to) return null
      return { ...base, from, to }
    }
    case 'animation':
      return {
        ...base,
        animation: parseAnimation(o.animation),
        color: parseRgb(o.color) ?? WHITE,
      }
    case 'alarm-clock':
      return {
        ...base,
        hour: typeof o.hour === 'number' ? clamp(o.hour, 0, 23) : 7,
        minute: typeof o.minute === 'number' ? clamp(o.minute, 0, 59) : 0,
        color: parseRgb(o.color) ?? ORANGE,
      }
    case 'static':
    default: {
      const leds = parseLeds(o.leds)
      if (!leds) return null
      return { ...base, type: 'static', leds }
    }
  }
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function isAlarmDue(mode: Mode, now = new Date()) {
  return now.getHours() === (mode.hour ?? 7) && now.getMinutes() === (mode.minute ?? 0)
}

function lerpRgb(from: RGB, to: RGB, t: number): RGB {
  return {
    r: lerp(from.r, to.r, t),
    g: lerp(from.g, to.g, t),
    b: lerp(from.b, to.b, t),
  }
}

function scaleRgb(color: RGB, scale: number): RGB {
  return {
    r: Math.round(color.r * scale),
    g: Math.round(color.g * scale),
    b: Math.round(color.b * scale),
  }
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = (v * s) / 255 / 255
  const x = c * (1 - Math.abs(((h / 255) * 6) % 2 - 1))
  const m = v / 255 - c
  let r = 0, g = 0, b = 0
  const sector = Math.floor(h / 255 * 6)
  switch (sector) {
    case 0: r = c; g = x; break
    case 1: r = x; g = c; break
    case 2: g = c; b = x; break
    case 3: g = x; b = c; break
    case 4: r = x; b = c; break
    default: r = c; b = x; break
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

export function modePreviewLeds(mode: Mode, tick = 0): RGB[] {
  switch (mode.type) {
    case 'single-color':
      return Array(LED_COUNT).fill(mode.color ?? BLACK)
    case 'gradient': {
      const from = mode.from ?? BLACK
      const to = mode.to ?? WHITE
      return Array.from({ length: LED_COUNT }, (_, i) => {
        const t = LED_COUNT <= 1 ? 0 : i / (LED_COUNT - 1)
        return lerpRgb(from, to, t)
      })
    }
    case 'animation': {
      const color = mode.color ?? WHITE
      if (mode.animation === 'rainbow') {
        const offset = Math.floor(tick / 20) % 256
        return Array.from({ length: LED_COUNT }, (_, i) => {
          const hue = (offset + Math.round((i / LED_COUNT) * 255)) % 256
          return hsvToRgb(hue, 255, 255)
        })
      }
      if (mode.animation === 'pulse') {
        const scale = 0.5 + 0.5 * Math.sin(TAU * tick / 1000)
        const c = scaleRgb(color, scale)
        return Array(LED_COUNT).fill(c)
      }
      if (mode.animation === 'breathe') {
        const scale = 0.5 + 0.5 * Math.sin(TAU * tick / 3000)
        const c = scaleRgb(color, scale)
        return Array(LED_COUNT).fill(c)
      }
      return Array(LED_COUNT).fill(color)
    }
    case 'alarm-clock': {
      const color = mode.color ?? ORANGE
      if (isAlarmDue(mode)) {
        const scale = 0.5 + 0.5 * Math.sin(TAU * tick / 500)
        return Array(LED_COUNT).fill(scaleRgb(color, scale))
      }
      return Array(LED_COUNT).fill(scaleRgb(color, 0.08))
    }
    case 'static':
    default:
      return mode.leds ?? emptyLeds()
  }
}

export function cloneMode(mode: Mode): Mode {
  const copy = { ...mode }
  if (mode.color) copy.color = { ...mode.color }
  if (mode.from) copy.from = { ...mode.from }
  if (mode.to) copy.to = { ...mode.to }
  if (mode.leds) copy.leds = mode.leds.map(led => ({ ...led }))
  return copy
}

export function cloneModes(modes: Mode[]): Mode[] {
  return modes.map(cloneMode)
}

export function modeToPayload(mode: Mode): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: mode.name,
    type: mode.type,
    brightness: mode.brightness,
  }

  switch (mode.type) {
    case 'single-color':
      payload.color = mode.color
      break
    case 'gradient':
      payload.from = mode.from
      payload.to = mode.to
      break
    case 'animation':
      payload.animation = mode.animation ?? 'rainbow'
      if (mode.animation !== 'rainbow') payload.color = mode.color ?? WHITE
      break
    case 'alarm-clock':
      payload.hour = mode.hour ?? 7
      payload.minute = mode.minute ?? 0
      payload.color = mode.color ?? ORANGE
      break
    case 'static':
      payload.leds = mode.leds
      break
  }

  return payload
}

export function changeModeType(mode: Mode, type: ModeType): Mode {
  const preview = modePreviewLeds(mode)
  const base = { name: mode.name, brightness: mode.brightness, type }

  switch (type) {
    case 'single-color':
      return { ...base, color: preview[0] }
    case 'gradient':
      return { ...base, from: preview[0], to: preview[preview.length - 1] }
    case 'animation':
      return { ...base, animation: 'rainbow', color: preview[0] }
    case 'alarm-clock':
      return { ...base, hour: 7, minute: 0, color: preview[0] }
    case 'static':
      return { ...base, leds: preview }
  }
}

export function createMode(type: ModeType, index: number): Mode {
  const base = { name: `Mode ${index + 1}`, brightness: 255, type }
  switch (type) {
    case 'single-color':
      return { ...base, color: WHITE }
    case 'gradient':
      return { ...base, from: { r: 255, g: 0, b: 0 }, to: { r: 0, g: 0, b: 255 } }
    case 'animation':
      return { ...base, animation: 'rainbow', color: WHITE }
    case 'alarm-clock':
      return { ...base, hour: 7, minute: 0, color: ORANGE }
    case 'static':
      return { ...base, leds: emptyLeds() }
  }
}

export function defaultModes(): Mode[] {
  return [
    { name: 'White', type: 'single-color', brightness: 128, color: WHITE },
    { name: 'Rainbow', type: 'animation', brightness: 128, animation: 'rainbow', color: WHITE },
  ]
}

export function emptyMode(index: number): Mode {
  return createMode('static', index)
}

export function formatAlarmTime(hour = 7, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const LOCAL_MODES_KEY = 'wandlampe_modes'

export function loadLocalModes(): Mode[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_MODES_KEY)
    if (!raw) return null
    const doc = JSON.parse(raw)
    if (!Array.isArray(doc)) return null
    const modes: Mode[] = []
    for (const item of doc.slice(0, MAX_MODES)) {
      const mode = parseMode(item, modes.length)
      if (mode) modes.push(mode)
    }
    return modes.length > 0 ? modes : null
  } catch {
    return null
  }
}

export function saveLocalModes(modes: Mode[]) {
  localStorage.setItem(LOCAL_MODES_KEY, JSON.stringify(modes.map(modeToPayload)))
}
