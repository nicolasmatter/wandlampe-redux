import { useEffect, useState } from 'react'
import { generatorLayer } from '../animation/defaults'
import { cycleMs, render } from '../animation/engine'
import type { Animation, Layer } from '../animation/types'
import { LAB_DEFAULT_LED_COUNT } from '../config'
import { rgbToHex } from '../modeUtils'
import { LabRing } from './LabRing'
import { LabStrip, type PreviewSettings } from './LabStrip'
import { ledLook } from './ledLook'
import { LayerEditor } from './LayerEditor'
import { layerLabel } from './labels'
import { LayerStack } from './LayerStack'
import { LibraryPanel } from './LibraryPanel'
import { PreviewControls } from './PreviewControls'
import { loadDraft, saveDraft } from './storage'
import { usePlayback } from './usePlayback'

export function LabApp() {
  const [animation, setAnimation] = useState<Animation>(loadDraft)
  const [selected, setSelected] = useState(0)
  const [preview, setPreview] = useState<PreviewSettings>({
    ledCount: LAB_DEFAULT_LED_COUNT,
    brightness: 255,
    gamma: true,
    halo: true,
  })
  const cycle = cycleMs(animation)
  const { playing, setPlaying, timeMs, clockMs, seek } = usePlayback(cycle)

  useEffect(() => saveDraft(animation), [animation])

  const setLayers = (layers: Layer[]) => setAnimation(a => ({ ...a, layers }))
  const updateLayer = (index: number, layer: Layer) =>
    setAnimation(a => ({ ...a, layers: a.layers.map((l, i) => (i === index ? layer : l)) }))

  const index = Math.min(selected, animation.layers.length - 1)
  const layer = animation.layers[index]
  const layerPhase = ((timeMs / animation.loopMs) * layer.speed) % 1
  const colors = render(animation, timeMs, preview.ledCount, clockMs).map(c =>
    rgbToHex(ledLook(c, preview.brightness, preview.gamma)),
  )

  return (
    <main className="lab">
      <header className="lab-header">
        <h1>Lab</h1>
        <a href="/">Controller</a>
      </header>

      <section className="lab-preview">
        <div className="lab-ring-wrap">
          <LabRing colors={colors} halo={preview.halo} />
        </div>
        <LabStrip colors={colors} />
        <div className="lab-transport">
          <button type="button" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            className="lab-scrubber"
            type="range"
            min={0}
            max={cycle}
            step={1}
            value={timeMs}
            aria-label="Position in cycle"
            onChange={e => {
              setPlaying(false)
              seek(Number(e.target.value))
            }}
          />
          <span className="lab-time">
            {(timeMs / 1000).toFixed(2)} / {(cycle / 1000).toFixed(2)} s
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
            max={600}
            step={0.5}
            value={animation.loopMs / 1000}
            onChange={e => {
              const s = Number(e.target.value)
              if (s >= 0.1 && s <= 600) setAnimation(a => ({ ...a, loopMs: Math.round(s * 1000) }))
            }}
          />
        </label>
        {cycle !== animation.loopMs && (
          <p className="lab-hint">A ×½ layer needs two loops, so the whole animation repeats every {cycle / 1000} s.</p>
        )}
        <LibraryPanel
          animation={animation}
          onOpen={a => {
            setAnimation(a)
            setSelected(0)
            seek(0)
          }}
        />
      </section>

      <section className="lab-panel">
        <h2>Layers</h2>
        <LayerStack
          layers={animation.layers}
          selected={index}
          onSelect={setSelected}
          onChange={setLayers}
          onAdd={() => {
            setLayers([...animation.layers, { ...generatorLayer('sparkle'), blend: 'add' }])
            setSelected(animation.layers.length)
          }}
        />
      </section>

      <section className="lab-panel">
        <h2>
          Layer {index + 1} · {layerLabel(layer)}
        </h2>
        <LayerEditor layer={layer} phase={layerPhase} onChange={l => updateLayer(index, l)} />
      </section>
    </main>
  )
}
