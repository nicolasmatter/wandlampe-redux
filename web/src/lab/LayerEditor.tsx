import { GENERATOR_LABELS, defaultParams } from '../animation/defaults'
import {
  MAX_BAND_COLORS,
  MIN_BAND_COLORS,
  type BandsParams,
  type GeneratorLayer,
  type GeneratorName,
  type PulseParams,
} from '../animation/types'
import { ColorField } from './ColorField'
import { ColorList } from './ColorList'

type Props = {
  layer: GeneratorLayer
  onChange: (layer: GeneratorLayer) => void
}

export function LayerEditor({ layer, onChange }: Props) {
  const setGenerator = (generator: GeneratorName) =>
    onChange({ ...layer, generator, params: defaultParams(generator) } as GeneratorLayer)

  return (
    <div className="lab-layer-editor">
      <label className="lab-inline">
        <span>Generator</span>
        <select value={layer.generator} onChange={e => setGenerator(e.target.value as GeneratorName)}>
          {(Object.keys(GENERATOR_LABELS) as GeneratorName[]).map(g => (
            <option key={g} value={g}>
              {GENERATOR_LABELS[g]}
            </option>
          ))}
        </select>
      </label>

      {layer.generator === 'solid' && (
        <ColorField label="Color" color={layer.params.color} onChange={color => onChange({ ...layer, params: { color } })} />
      )}
      {layer.generator === 'bands' && (
        <BandsEditor params={layer.params} onChange={params => onChange({ ...layer, params })} />
      )}
      {layer.generator === 'pulse' && (
        <PulseEditor params={layer.params} onChange={params => onChange({ ...layer, params })} />
      )}
    </div>
  )
}

function BandsEditor({ params, onChange }: { params: BandsParams; onChange: (p: BandsParams) => void }) {
  const set = (patch: Partial<BandsParams>) => onChange({ ...params, ...patch })
  return (
    <>
      <ColorList colors={params.colors} min={MIN_BAND_COLORS} max={MAX_BAND_COLORS} onChange={colors => set({ colors })} />
      <div className="lab-params">
        <label className="lab-inline">
          <span>Edges</span>
          <select value={params.edge} onChange={e => set({ edge: e.target.value as BandsParams['edge'] })}>
            <option value="smooth">Smooth</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="lab-inline">
          <span>Repeat {params.repeat}×</span>
          <input type="range" min={1} max={16} value={params.repeat} onChange={e => set({ repeat: Number(e.target.value) })} />
        </label>
        <label className="lab-inline">
          <span>Scroll</span>
          <select value={params.scroll} onChange={e => set({ scroll: Number(e.target.value) as BandsParams['scroll'] })}>
            <option value={1}>Forward</option>
            <option value={-1}>Backward</option>
            <option value={0}>Static</option>
          </select>
        </label>
      </div>
    </>
  )
}

function PulseEditor({ params, onChange }: { params: PulseParams; onChange: (p: PulseParams) => void }) {
  const set = (patch: Partial<PulseParams>) => onChange({ ...params, ...patch })
  return (
    <>
      <ColorField label="Color" color={params.color} onChange={color => set({ color })} />
      <div className="lab-params">
        <label className="lab-inline">
          <span>Min {params.min}</span>
          <input type="range" min={0} max={255} value={params.min} onChange={e => set({ min: Number(e.target.value) })} />
        </label>
        <label className="lab-inline">
          <span>Max {params.max}</span>
          <input type="range" min={0} max={255} value={params.max} onChange={e => set({ max: Number(e.target.value) })} />
        </label>
        <label className="lab-inline">
          <span>Curve</span>
          <select value={params.curve} onChange={e => set({ curve: e.target.value as PulseParams['curve'] })}>
            <option value="sine">Sine (breathe)</option>
            <option value="sharp">Sharp (pulse)</option>
          </select>
        </label>
      </div>
    </>
  )
}
