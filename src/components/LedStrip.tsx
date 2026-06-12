import { useEffect, useState } from 'react'
import { modePreviewLeds, rgbToHex } from '../modeUtils'
import type { Mode, RGB } from '../types'

type Props = {
  mode: Mode
  editable?: boolean
  onPaint?: (index: number) => void
  onPaintStart?: () => void
  onPaintEnd?: () => void
  compact?: boolean
}

export function LedStrip({ mode, editable, onPaint, onPaintStart, onPaintEnd, compact }: Props) {
  const [tick, setTick] = useState(0)
  const animated = mode.type === 'animation' || mode.type === 'alarm-clock'

  useEffect(() => {
    if (!animated) return
    let raf = 0
    const loop = (t: number) => {
      setTick(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [animated, mode.type, mode.animation, mode.color, mode.brightness, mode.hour, mode.minute])

  const leds = modePreviewLeds(mode, tick)

  return (
    <div
      className={`led-strip ${editable ? 'editable' : 'preview'} ${compact ? 'compact' : ''}`}
      onPointerLeave={onPaintEnd}
    >
      {leds.map((led: RGB, i) => (
        <div
          key={i}
          className="led-cell"
          style={{ background: rgbToHex(led) }}
          onPointerDown={e => {
            if (!editable || !onPaint) return
            e.preventDefault()
            onPaintStart?.()
            onPaint(i)
          }}
          onPointerEnter={() => {
            if (editable && onPaint) onPaint(i)
          }}
        >
          {!compact && <span>{i + 1}</span>}
        </div>
      ))}
    </div>
  )
}
