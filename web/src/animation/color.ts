import type { RGB } from '../types'

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) })
export const scaleRgb = (c: RGB, s: number): RGB => ({ r: c.r * s, g: c.g * s, b: c.b * s })
export const frac = (v: number) => v - Math.floor(v)
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Colors spread evenly over 0–1, from the first color to the last, without wrapping. */
export function paletteAt(colors: RGB[], v: number): RGB {
  const u = clamp01(v) * (colors.length - 1)
  const i = Math.min(Math.floor(u), colors.length - 2)
  return mixRgb(colors[i], colors[i + 1], u - i)
}
