import { useEffect, useState } from 'react'

type Clock = { timeMs: number; clockMs: number }

/**
 * Playback position within the animation's cycle (`timeMs`), plus a clock that
 * never wraps (`clockMs`) for free-running layers. Both stop while paused.
 */
export function usePlayback(cycleMs: number) {
  const [playing, setPlaying] = useState(true)
  const [clock, setClock] = useState<Clock>({ timeMs: 0, clockMs: 0 })

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      setClock(c => ({ timeMs: (c.timeMs + dt) % cycleMs, clockMs: c.clockMs + dt }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, cycleMs])

  const seek = (ms: number) => setClock(c => ({ ...c, timeMs: Math.min(Math.max(ms, 0), cycleMs) }))

  return { playing, setPlaying, timeMs: Math.min(clock.timeMs, cycleMs), clockMs: clock.clockMs, seek }
}
