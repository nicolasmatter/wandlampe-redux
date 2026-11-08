import { useEffect, useState } from 'react'
import { LAB_DEFAULT_LED_COUNT } from '../config'
import type { Animation, Layer } from '../animation/types'
import { LayerEditor } from './LayerEditor'
import { LabStrip, type PreviewSettings } from './LabStrip'
import { PreviewControls } from './PreviewControls'
import { loadDraft, saveDraft } from './storage'
import { usePlayback } from './usePlayback'

export function LabApp() {
  const [animation, setAnimation] = useState<Animation>(loadDraft)
  const [preview, setPreview] = useState<PreviewSettings>({
    ledCount: LAB_DEFAULT_LED_COUNT,
    brightness: 255,
    gamma: true,
    glow: true,
  })
  const { playing, setPlaying, timeMs, seek } = usePlayback(animation.loopMs)

  useEffect(() => saveDraft(animation), [animation])

  const updateLayer = (index: number, layer: Layer) =>
    setAnimation(a => ({ ...a, layers: a.layers.map((l, i) => (i === index ? layer : l)) }))

  return (
    <main className="lab">
      <header className="lab-header">
        <h1>Lab</h1>
        <a href="/">Controller</a>
      </header>

      <section className="lab-preview">
        <LabStrip animation={animation} timeMs={timeMs} settings={preview} />
        <div className="lab-transport">
          <button type="button" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            className="lab-scrubber"
            type="range"
            min={0}
            max={animation.loopMs}
            step={1}
            value={timeMs}
            aria-label="Position in loop"
            onChange={e => {
              setPlaying(false)
              seek(Number(e.target.value))
            }}
          />
          <span className="lab-time">
            {(timeMs / 1000).toFixed(2)} / {(animation.loopMs / 1000).toFixed(2)} s
          </span>
        </div>
        <PreviewControls settings={preview} onChange={patch => setPreview(p => ({ ...p, ...patch }))} />
      </section>

      <section className="lab-panel">
        <label className="lab-field">
          <span>Name</span>
          <input value={animation.name} onChange={e => setAnimation(a => ({ ...a, name: e.target.value }))} />
        </label>
        <label className="lab-field">
          <span>Loop (s)</span>
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={animation.loopMs / 1000}
            onChange={e => {
              const s = Number(e.target.value)
              if (s > 0) setAnimation(a => ({ ...a, loopMs: Math.round(s * 1000) }))
            }}
          />
        </label>
      </section>

      <section className="lab-panel">
        <h2>Layer 1</h2>
        <LayerEditor layer={animation.layers[0]} onChange={layer => updateLayer(0, layer)} />
      </section>
    </main>
  )
}
