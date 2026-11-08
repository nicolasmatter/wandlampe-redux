import { useEffect, useRef, useState } from 'react'

/** Loop-relative playback time in ms. Keeps its position while paused. */
export function usePlayback(loopMs: number) {
  const [playing, setPlaying] = useState(true)
  const [timeMs, setTime] = useState(0)
  const timeRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      timeRef.current = (timeRef.current + now - last) % loopMs
      last = now
      setTime(timeRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, loopMs])

  const seek = (ms: number) => {
    timeRef.current = Math.min(Math.max(ms, 0), loopMs)
    setTime(timeRef.current)
  }

  return { playing, setPlaying, timeMs: Math.min(timeMs, loopMs), seek }
}
