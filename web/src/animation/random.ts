/**
 * Integer hashing and value noise that firmware can reproduce exactly with
 * uint32 arithmetic. Everything is derived from (seed, coordinates), with no state.
 */

/** lowbias32 by Chris Wellons: a well-mixed 32-bit integer hash. */
function mix32(x: number): number {
  x = (x ^ (x >>> 16)) >>> 0
  x = Math.imul(x, 0x7feb352d) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  x = Math.imul(x, 0x846ca68b) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

/** Uniform value in [0, 1) for a seed and up to three integer coordinates. */
export function hash01(seed: number, a: number, b = 0, c = 0): number {
  let h = mix32(seed >>> 0)
  h = mix32((h ^ (a | 0)) >>> 0)
  h = mix32((h ^ (b | 0)) >>> 0)
  h = mix32((h ^ (c | 0)) >>> 0)
  return h / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 3D value noise in [0, 1]: random values on the integer lattice, smoothly interpolated. */
export function valueNoise3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const tx = smooth(x - xi), ty = smooth(y - yi), tz = smooth(z - zi)
  const v = (dx: number, dy: number, dz: number) => hash01(seed, xi + dx, yi + dy, zi + dz)
  const x00 = lerp(v(0, 0, 0), v(1, 0, 0), tx)
  const x10 = lerp(v(0, 1, 0), v(1, 1, 0), tx)
  const x01 = lerp(v(0, 0, 1), v(1, 0, 1), tx)
  const x11 = lerp(v(0, 1, 1), v(1, 1, 1), tx)
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz)
}
