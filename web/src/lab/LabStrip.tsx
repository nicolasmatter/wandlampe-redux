import { useEffect, useRef, useState } from 'react'
import { render } from '../animation/engine'
import type { Animation } from '../animation/types'
import { rgbToHex } from '../modeUtils'

type Props = {
  animation: Animation
  ledCount: number
  playing: boolean
}

/** Plays an animation on a simulated strip. Time keeps its position while paused. */
export function LabStrip({ animation, ledCount, playing }: Props) {
  const [timeMs, setTimeMs] = useState(0)
  const timeRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      timeRef.current = (timeRef.current + now - last) % animation.loopMs
      last = now
      setTimeMs(timeRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, animation.loopMs])

  const leds = render(animation, timeMs, ledCount)

  return (
    <div className="lab-strip" style={{ gridTemplateColumns: `repeat(${ledCount}, minmax(0, 1fr))` }}>
      {leds.map((c, i) => (
        <div key={i} className="lab-led" style={{ background: rgbToHex(c) }} />
      ))}
    </div>
  )
}
