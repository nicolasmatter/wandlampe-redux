import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HexColorPicker } from 'react-colorful'
import { stopsAt } from '../animation/keyframes'
import { MAX_KEYFRAMES, MAX_STOPS, type ColorStop, type Easing, type Edge, type Keyframe } from '../animation/types'
import { hexToRgb, rgbToHex } from '../modeUtils'

type Props = {
  keyframes: Keyframe[]
  /** Where the layer currently is in its cycle, 0–1. */
  phase: number
  /** Stops wrap around the ring, unless the layer is mirrored (bottom → top). */
  wrap: boolean
  onChange: (keyframes: Keyframe[]) => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Relative 0–1 position of a pointer within an element. */
function relativeX(e: { clientX: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return clamp01((e.clientX - r.left) / r.width)
}

/** Drags with pointer capture, reporting the 0–1 position within `track`. */
function startDrag(e: ReactPointerEvent, track: HTMLElement | null, onMove: (x: number) => void) {
  if (!track) return
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => onMove(relativeX(ev, track))
  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}

function cssGradient(stops: ColorStop[], edge: Edge, wrap: boolean) {
  const samples = Array.from({ length: 49 }, (_, i) => i / 48)
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const parts = samples.map(x => {
    const c = stopsAt(sorted, edge, x, wrap)
    return `${rgbToHex({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) })} ${x * 100}%`
  })
  return `linear-gradient(to right, ${parts.join(', ')})`
}

export function KeyframeEditor({ keyframes, phase, wrap, onChange }: Props) {
  const [selected, setSelected] = useState(0)
  const [selectedStop, setSelectedStop] = useState(0)
  const timeline = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  const index = Math.min(selected, keyframes.length - 1)
  const kf = keyframes[index]
  const stopIndex = Math.min(selectedStop, kf.stops.length - 1)

  const setKeyframe = (patch: Partial<Keyframe>) => onChange(keyframes.map((k, i) => (i === index ? { ...k, ...patch } : k)))
  const setStops = (stops: ColorStop[]) => setKeyframe({ stops })

  const moveKeyframe = (i: number, at: number) => {
    const taken = keyframes.some((k, j) => j !== i && Math.abs(k.at - at) < 0.001)
    if (taken || at >= 1) return
    onChange(keyframes.map((k, j) => (j === i ? { ...k, at: round3(at) } : k)))
  }

  const addKeyframe = () => {
    const later = keyframes.filter(k => k.at > kf.at).map(k => k.at)
    const next = later.length ? Math.min(...later) : 1
    const at = round3((kf.at + next) / 2)
    if (keyframes.some(k => k.at === at)) return
    onChange([...keyframes, structuredClone({ ...kf, at })])
    setSelected(keyframes.length)
  }

  const removeKeyframe = () => {
    onChange(keyframes.filter((_, i) => i !== index))
    setSelected(Math.max(0, index - 1))
  }

  const addStop = (x: number) => {
    if (kf.stops.length >= MAX_STOPS) return
    const sorted = [...kf.stops].sort((a, b) => a.position - b.position)
    setStops([...kf.stops, { position: round3(x), color: stopsAt(sorted, kf.edge, x, wrap) }])
    setSelectedStop(kf.stops.length)
  }

  const moveStop = (i: number, x: number) =>
    setStops(kf.stops.map((s, j) => (j === i ? { ...s, position: round3(x) } : s)))

  return (
    <div className="lab-keyframes">
      <div className="lab-timeline" ref={timeline}>
        <div className="lab-playhead" style={{ left: `${phase * 100}%` }} />
        {keyframes.map((k, i) => (
          <button
            key={i}
            type="button"
            className={`lab-kf-marker ${i === index ? 'selected' : ''}`}
            style={{ left: `${k.at * 100}%`, background: cssGradient(k.stops, k.edge, wrap) }}
            aria-label={`Keyframe at ${Math.round(k.at * 100)}%`}
            onPointerDown={e => {
              setSelected(i)
              startDrag(e, timeline.current, x => moveKeyframe(i, x))
            }}
          />
        ))}
      </div>

      <div className="lab-params">
        <button type="button" onClick={addKeyframe} disabled={keyframes.length >= MAX_KEYFRAMES}>
          Add keyframe
        </button>
        <button type="button" className="danger" onClick={removeKeyframe} disabled={keyframes.length <= 1}>
          Delete keyframe
        </button>
        <label className="lab-inline">
          <span>At %</span>
          <input
            type="number"
            min={0}
            max={99.9}
            step={0.1}
            value={round3(kf.at * 100)}
            onChange={e => moveKeyframe(index, Number(e.target.value) / 100)}
          />
        </label>
        <label className="lab-inline">
          <span>Into next</span>
          <select value={kf.easing} onChange={e => setKeyframe({ easing: e.target.value as Easing })}>
            <option value="linear">Linear</option>
            <option value="ease-in-out">Ease in-out</option>
            <option value="step">Step (hard cut)</option>
          </select>
        </label>
        <label className="lab-inline">
          <span>Edges</span>
          <select value={kf.edge} onChange={e => setKeyframe({ edge: e.target.value as Edge })}>
            <option value="smooth">Smooth</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>

      <p className="lab-hint">
        {wrap
          ? 'Ring from bottom, counterclockwise, back to bottom. Click to add a color stop, drag handles to move them.'
          : 'Mirrored: bottom on the left, top on the right. Click to add a color stop, drag handles to move them.'}
      </p>
      <div
        className="lab-stop-bar"
        ref={bar}
        style={{ background: cssGradient(kf.stops, kf.edge, wrap) }}
        onPointerDown={e => {
          if (e.target === bar.current) addStop(relativeX(e, bar.current))
        }}
      >
        {kf.stops.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`lab-stop ${i === stopIndex ? 'selected' : ''}`}
            style={{ left: `${s.position * 100}%`, background: rgbToHex(s.color) }}
            aria-label={`Color stop at ${Math.round(s.position * 100)}%`}
            onPointerDown={e => {
              setSelectedStop(i)
              startDrag(e, bar.current, x => moveStop(i, x))
            }}
          />
        ))}
      </div>

      <div className="lab-params">
        <HexColorPicker
          color={rgbToHex(kf.stops[stopIndex].color)}
          onChange={hex => setStops(kf.stops.map((s, i) => (i === stopIndex ? { ...s, color: hexToRgb(hex) } : s)))}
        />
        <button
          type="button"
          className="danger"
          onClick={() => {
            setStops(kf.stops.filter((_, i) => i !== stopIndex))
            setSelectedStop(Math.max(0, stopIndex - 1))
          }}
          disabled={kf.stops.length <= 1}
        >
          Delete stop
        </button>
      </div>
    </div>
  )
}
