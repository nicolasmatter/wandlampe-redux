import { useEffect, useRef } from 'react'

type Props = {
  colors: string[]
  halo: boolean
}

const SIZE = 420
const WALL = '#262626'

/**
 * The lamp as seen on the wall: LED 0 at the bottom, counterclockwise as you face
 * it. LEDs face outward, so their light spreads onto the wall outside the ring only.
 */
export function LabRing({ colors, halo }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    if (el.width !== SIZE * dpr) {
      el.width = SIZE * dpr
      el.height = SIZE * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const c = SIZE / 2
    const radius = SIZE * 0.3
    const n = colors.length
    // Screen y grows downward: angle 0 is the bottom, increasing toward the right (counterclockwise to a viewer).
    const at = (i: number, r: number) => {
      const a = (2 * Math.PI * i) / n
      return [c + r * Math.sin(a), c + r * Math.cos(a)] as const
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = WALL
    ctx.fillRect(0, 0, SIZE, SIZE)

    if (halo) {
      ctx.globalCompositeOperation = 'lighter'
      const reach = radius * 0.5
      // Neighbouring glows overlap and add up; scale each so a uniform ring stays below white.
      const overlap = (2 * reach) / ((2 * Math.PI * radius) / n)
      const alpha = Math.round(255 * Math.min(0.5, 0.9 / overlap))
        .toString(16)
        .padStart(2, '0')
      colors.forEach((hex, i) => {
        const [x, y] = at(i, radius + reach * 0.35)
        const g = ctx.createRadialGradient(x, y, 0, x, y, reach)
        g.addColorStop(0, hex + alpha)
        g.addColorStop(1, hex + '00')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, reach, 0, 2 * Math.PI)
        ctx.fill()
      })
      // The ring body blocks light toward the center.
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = WALL
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, 2 * Math.PI)
      ctx.fill()
    }

    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(c, c, radius, 0, 2 * Math.PI)
    ctx.stroke()

    const dot = Math.max(2, Math.min(6, (Math.PI * radius) / n / 1.6))
    colors.forEach((hex, i) => {
      const [x, y] = at(i, radius)
      ctx.fillStyle = hex
      ctx.beginPath()
      ctx.arc(x, y, dot, 0, 2 * Math.PI)
      ctx.fill()
    })

    ctx.fillStyle = '#8a8a8a'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('top', c, c - radius + 26)
    ctx.fillText('LED 0', c, c + radius - 18)
  }, [colors, halo])

  return <canvas ref={canvas} className="lab-ring" style={{ width: SIZE, height: SIZE }} aria-label="Ring preview" />
}
