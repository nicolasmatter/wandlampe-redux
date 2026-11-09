import type { RGB } from '../types'

/** FastLED's scale8: brightness 0 is black, 255 leaves the value unchanged. */
const scale8 = (v: number, scale: number) => (v * (1 + scale)) >> 8

/**
 * LEDs emit light linearly with their PWM value, while screens encode values
 * with a ~2.2 gamma. Encoding makes dim LED values look as bright on screen
 * as they do on the strip.
 */
const encode = (v: number) => Math.round(255 * Math.pow(v / 255, 1 / 2.2))

/** How an engine color looks on the lamp at the given brightness, approximated for a screen. */
export function ledLook(c: RGB, brightness: number, gamma: boolean): RGB {
  const s = (v: number) => scale8(v, brightness)
  const out = { r: s(c.r), g: s(c.g), b: s(c.b) }
  return gamma ? { r: encode(out.r), g: encode(out.g), b: encode(out.b) } : out
}
