import type { ReactNode } from 'react'
import { GENERATOR_LABELS, randomSeed, withContent } from '../animation/defaults'
import {
  isKeyframeLayer,
  isRandomGenerator,
  MAX_PALETTE_COLORS,
  MIN_PALETTE_COLORS,
  SPEEDS,
  type Blend,
  type GeneratorLayer,
  type GeneratorName,
  type Layer,
  type Speed,
} from '../animation/types'
import { ColorField } from './ColorField'
import { ColorList } from './ColorList'
import { KeyframeEditor } from './KeyframeEditor'

type Props = {
  layer: Layer
  /** Where the layer currently is in its cycle, 0–1. */
  phase: number
  onChange: (layer: Layer) => void
}

type Content = GeneratorName | 'keyframes'

export function LayerEditor({ layer, phase, onChange }: Props) {
  const content: Content = isKeyframeLayer(layer) ? 'keyframes' : layer.generator

  return (
    <div className="lab-layer-editor">
      <div className="lab-params">
        <label className="lab-inline">
          <span>Content</span>
          <select value={content} onChange={e => onChange(withContent(layer, e.target.value as Content))}>
            {(Object.keys(GENERATOR_LABELS) as GeneratorName[]).map(g => (
              <option key={g} value={g}>
                {GENERATOR_LABELS[g]}
              </option>
            ))}
            <option value="keyframes">Keyframes</option>
          </select>
        </label>
        <label className="lab-inline">
          <span>Blend</span>
          <select value={layer.blend} onChange={e => onChange({ ...layer, blend: e.target.value as Blend })}>
            <option value="normal">Normal</option>
            <option value="add">Add</option>
          </select>
        </label>
        <Slider label="Opacity" value={layer.opacity} min={0} max={1} step={0.01} format={v => `${Math.round(v * 100)}%`}
          onChange={opacity => onChange({ ...layer, opacity })} />
        <label className="lab-inline">
          <span>Speed</span>
          <select value={layer.speed} onChange={e => onChange({ ...layer, speed: Number(e.target.value) as Speed })}>
            {SPEEDS.map(s => (
              <option key={s} value={s}>
                ×{s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isKeyframeLayer(layer) ? (
        <KeyframeEditor keyframes={layer.keyframes} phase={phase} onChange={keyframes => onChange({ ...layer, keyframes })} />
      ) : (
        <GeneratorEditor layer={layer} onChange={onChange} />
      )}
    </div>
  )
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step = 1, format = String, onChange } = props
  return (
    <label className="lab-inline">
      <span>
        {label} {format(value)}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  )
}

function Choice<T extends string | number | boolean>(props: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  const { label, value, options, onChange } = props
  return (
    <label className="lab-inline">
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={e => onChange(options.find(([v]) => String(v) === e.target.value)![0])}
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

const Params = ({ children }: { children: ReactNode }) => <div className="lab-params">{children}</div>

function GeneratorEditor({ layer, onChange }: { layer: GeneratorLayer; onChange: (l: Layer) => void }) {
  const set = <P,>(params: P) => onChange({ ...layer, params } as Layer)

  const random = isRandomGenerator(layer.generator) && 'seed' in layer && (
    <Params>
      <span className="lab-seed">Seed {layer.seed}</span>
      <button type="button" onClick={() => onChange({ ...layer, seed: randomSeed() })}>
        Reseed
      </button>
      <label className="lab-inline">
        <input type="checkbox" checked={layer.freeRunning} onChange={e => onChange({ ...layer, freeRunning: e.target.checked })} />
        <span>Free-running</span>
      </label>
      {layer.freeRunning && <span className="lab-warning">Never repeats; the preview only approximates the lamp.</span>}
    </Params>
  )

  switch (layer.generator) {
    case 'solid':
      return <ColorField label="Color" color={layer.params.color} onChange={color => set({ color })} />

    case 'bands': {
      const p = layer.params
      return (
        <>
          <ColorList colors={p.colors} min={MIN_PALETTE_COLORS} max={MAX_PALETTE_COLORS} onChange={colors => set({ ...p, colors })} />
          <Params>
            <Choice label="Edges" value={p.edge} options={[['smooth', 'Smooth'], ['hard', 'Hard']]} onChange={edge => set({ ...p, edge })} />
            <Slider label="Repeat" value={p.repeat} min={1} max={16} format={v => `${v}×`} onChange={repeat => set({ ...p, repeat })} />
            <Choice label="Scroll" value={p.scroll} options={[[1, 'Forward'], [-1, 'Backward'], [0, 'Static']]}
              onChange={scroll => set({ ...p, scroll })} />
          </Params>
        </>
      )
    }

    case 'pulse': {
      const p = layer.params
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Min" value={p.min} min={0} max={255} onChange={min => set({ ...p, min })} />
            <Slider label="Max" value={p.max} min={0} max={255} onChange={max => set({ ...p, max })} />
            <Choice label="Curve" value={p.curve} options={[['sine', 'Sine (breathe)'], ['sharp', 'Sharp (pulse)']]}
              onChange={curve => set({ ...p, curve })} />
          </Params>
        </>
      )
    }

    case 'chase': {
      const p = layer.params
      const pct = (v: number) => `${Math.round(v * 100)}%`
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Width" value={p.width} min={0} max={0.5} step={0.005} format={pct} onChange={width => set({ ...p, width })} />
            <Slider label="Tail" value={p.tail} min={0} max={1} step={0.01} format={pct} onChange={tail => set({ ...p, tail })} />
            <Slider label="Count" value={p.count} min={1} max={8} onChange={count => set({ ...p, count })} />
            <Choice label="Direction" value={p.direction} options={[[1, 'Forward'], [-1, 'Backward']]}
              onChange={direction => set({ ...p, direction })} />
            <Choice label="Motion" value={p.bounce} options={[[false, 'Wrap around'], [true, 'Bounce']]}
              onChange={bounce => set({ ...p, bounce })} />
          </Params>
        </>
      )
    }

    case 'sparkle': {
      const p = layer.params
      const pct = (v: number) => `${Math.round(v * 100)}%`
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Density" value={p.density} min={0} max={1} step={0.01} format={pct} onChange={density => set({ ...p, density })} />
            <Slider label="Fade" value={p.fade} min={0.01} max={1} step={0.01} format={pct} onChange={fade => set({ ...p, fade })} />
          </Params>
          {random}
        </>
      )
    }

    case 'noise': {
      const p = layer.params
      return (
        <>
          <ColorList colors={p.colors} min={MIN_PALETTE_COLORS} max={MAX_PALETTE_COLORS} onChange={colors => set({ ...p, colors })} />
          <Params>
            <Slider label="Scale" value={p.scale} min={1} max={16} step={0.5} onChange={scale => set({ ...p, scale })} />
          </Params>
          {random}
        </>
      )
    }
  }
}
