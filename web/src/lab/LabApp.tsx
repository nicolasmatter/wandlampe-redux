import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { LAB_DEFAULT_LED_COUNT } from '../config'
import { hexToRgb, rgbToHex } from '../modeUtils'
import type { Animation, Layer } from '../animation/types'
import { LabStrip } from './LabStrip'
import { loadDraft, saveDraft } from './storage'

export function LabApp() {
  const [animation, setAnimation] = useState<Animation>(loadDraft)
  const [playing, setPlaying] = useState(true)

  useEffect(() => saveDraft(animation), [animation])

  const layer = animation.layers[0]
  const updateLayer = (patch: Partial<Layer>) =>
    setAnimation(a => ({ ...a, layers: a.layers.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) }))

  return (
    <main className="lab">
      <header className="lab-header">
        <h1>Lab</h1>
        <a href="/">Controller</a>
      </header>

      <section className="lab-preview">
        <LabStrip animation={animation} ledCount={LAB_DEFAULT_LED_COUNT} playing={playing} />
        <div className="lab-transport">
          <button type="button" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
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
        <h2>Layer 1 · solid</h2>
        <HexColorPicker
          color={rgbToHex(layer.params.color)}
          onChange={hex => updateLayer({ params: { color: hexToRgb(hex) } })}
        />
      </section>
    </main>
  )
}
