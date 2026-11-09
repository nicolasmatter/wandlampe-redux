import type { ReactNode } from 'react'
import { GENERATOR_LABELS, randomSeed, REGION_PRESETS, withContent } from '../animation/defaults'
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
  type Region,
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

      <Params>
        <label className="lab-inline">
          <input type="checkbox" checked={layer.mirror} onChange={e => onChange({ ...layer, mirror: e.target.checked })} />
          <span>Mirror (bottom → top on both sides)</span>
        </label>
        <RegionEditor region={layer.region} onChange={region => onChange(withRegion(layer, region))} />
      </Params>

      {isKeyframeLayer(layer) ? (
        <KeyframeEditor
          keyframes={layer.keyframes}
          phase={phase}
          wrap={!layer.mirror}
          onChange={keyframes => onChange({ ...layer, keyframes })}
        />
      ) : (
        <GeneratorEditor layer={layer} onChange={onChange} />
      )}
    </div>
  )
}

function withRegion(layer: Layer, region: Region | undefined): Layer {
  const next = { ...layer }
  if (region) next.region = region
  else delete next.region
  return next
}

type PresetName = keyof typeof REGION_PRESETS | 'custom'

const PRESET_LABELS: Record<PresetName, string> = {
  whole: 'Whole ring',
  top: 'Top half',
  bottom: 'Bottom half',
  right: 'Right half',
  left: 'Left half',
  custom: 'Custom arc',
}

function presetOf(region: Region | undefined): PresetName {
  if (!region) return 'whole'
  const hit = (Object.keys(REGION_PRESETS) as (keyof typeof REGION_PRESETS)[]).find(
    k => k !== 'whole' && REGION_PRESETS[k].from === region.from && REGION_PRESETS[k].to === region.to,
  )
  return hit ?? 'custom'
}

/** Limits a layer to an arc of the ring. Positions: 0 bottom, 0.25 right, 0.5 top, 0.75 left. */
function RegionEditor({ region, onChange }: { region: Region | undefined; onChange: (r: Region | undefined) => void }) {
  const preset = presetOf(region)
  const softness = region?.softness ?? 0
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <>
      <label className="lab-inline">
        <span>Region</span>
        <select
          value={preset}
          onChange={e => {
            const name = e.target.value as PresetName
            if (name === 'whole') return onChange(undefined)
            const arc = name === 'custom' ? { from: 0.1, to: 0.4 } : REGION_PRESETS[name]
            onChange({ ...arc, softness })
          }}
        >
          {(Object.keys(PRESET_LABELS) as PresetName[]).map(k => (
            <option key={k} value={k}>
              {PRESET_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {region && preset === 'custom' && (
        <>
          <Slider label="From" value={region.from} min={0} max={1} step={0.01} format={pct} onChange={from => onChange({ ...region, from })} />
          <Slider label="To" value={region.to} min={0} max={1} step={0.01} format={pct} onChange={to => onChange({ ...region, to })} />
        </>
      )}
      {region && (
        <Slider label="Soft edge" value={softness} min={0} max={0.25} step={0.01} format={pct}
          onChange={s => onChange({ ...region, softness: s })} />
      )}
    </>
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
            <Slider label="Scale" value={p.scale} min={1} max={16} onChange={scale => set({ ...p, scale })} />
            <Slider label="Contrast" value={p.contrast} min={0.5} max={8} step={0.1} format={v => v.toFixed(1)}
              onChange={contrast => set({ ...p, contrast })} />
          </Params>
          {random}
        </>
      )
    }

    case 'strike': {
      const p = layer.params
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Strikes per cycle" value={p.rate} min={0} max={8} step={0.1} format={v => v.toFixed(1)}
              onChange={rate => set({ ...p, rate })} />
            <Slider label="Flickers" value={p.flickers} min={1} max={4} onChange={flickers => set({ ...p, flickers })} />
            <Slider label="Width" value={p.width} min={0.02} max={1} step={0.01} format={v => `${Math.round(v * 100)}%`}
              onChange={width => set({ ...p, width })} />
            <Slider label="Afterglow" value={p.afterglowMs} min={0} max={3000} step={50} format={v => `${v} ms`}
              onChange={afterglowMs => set({ ...p, afterglowMs })} />
            <Choice label="Hits" value={p.origin} options={[['random', 'Anywhere'], ['top', 'At the top']]}
              onChange={origin => set({ ...p, origin })} />
          </Params>
          {random}
        </>
      )
    }

    case 'drops': {
      const p = layer.params
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Drops per cycle" value={p.rate} min={1} max={40} onChange={rate => set({ ...p, rate })} />
            <Slider label="Speed" value={p.speed} min={0.2} max={8} step={0.1} format={v => v.toFixed(1)} onChange={speed => set({ ...p, speed })} />
            <Slider label="Variation" value={p.variation} min={0} max={0.9} step={0.05} format={v => `${Math.round(v * 100)}%`}
              onChange={variation => set({ ...p, variation })} />
            <Slider label="Tail" value={p.length} min={0} max={0.5} step={0.01} format={v => `${Math.round(v * 100)}%`}
              onChange={length => set({ ...p, length })} />
          </Params>
          <p className="lab-hint">Drops fall toward the bottom. Turn on Mirror to have them run down both sides.</p>
          {random}
        </>
      )
    }

    case 'ripple': {
      const p = layer.params
      return (
        <>
          <ColorField label="Color" color={p.color} onChange={color => set({ ...p, color })} />
          <Params>
            <Slider label="Ripples per cycle" value={p.rate} min={1} max={16} onChange={rate => set({ ...p, rate })} />
            <Slider label="Speed" value={p.speed} min={0.1} max={4} step={0.05} format={v => v.toFixed(2)} onChange={speed => set({ ...p, speed })} />
            <Slider label="Width" value={p.width} min={0.01} max={0.3} step={0.01} format={v => `${Math.round(v * 100)}%`}
              onChange={width => set({ ...p, width })} />
            <Slider label="Life" value={p.life} min={0.05} max={2} step={0.05} format={v => `${v.toFixed(2)} cycles`}
              onChange={life => set({ ...p, life })} />
          </Params>
          {random}
        </>
      )
    }
  }
}
