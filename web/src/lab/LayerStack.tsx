import { MAX_LAYERS, type Layer } from '../animation/types'
import { layerLabel } from './labels'

type Props = {
  layers: Layer[]
  selected: number
  onSelect: (index: number) => void
  onChange: (layers: Layer[]) => void
  onAdd: () => void
}

/** Layers listed top first, the way they stack visually; stored bottom first. */
export function LayerStack({ layers, selected, onSelect, onChange, onAdd }: Props) {
  const move = (from: number, to: number) => {
    const next = [...layers]
    const [l] = next.splice(from, 1)
    next.splice(to, 0, l)
    onChange(next)
    onSelect(to)
  }
  const duplicate = (i: number) => {
    onChange([...layers.slice(0, i + 1), structuredClone(layers[i]), ...layers.slice(i + 1)])
    onSelect(i + 1)
  }
  const remove = (i: number) => {
    onChange(layers.filter((_, j) => j !== i))
    onSelect(Math.max(0, Math.min(selected, layers.length - 2)))
  }
  const toggle = (i: number) => onChange(layers.map((l, j) => (j === i ? { ...l, hidden: !l.hidden } : l)))
  const full = layers.length >= MAX_LAYERS

  return (
    <div className="lab-stack">
      {layers
        .map((layer, i) => ({ layer, i }))
        .reverse()
        .map(({ layer, i }) => (
          <div key={i} className={`lab-stack-row ${i === selected ? 'selected' : ''} ${layer.hidden ? 'hidden' : ''}`}>
            <button type="button" className="lab-stack-name" onClick={() => onSelect(i)}>
              {i + 1}. {layerLabel(layer)}
              <small>
                {layer.blend} · {Math.round(layer.opacity * 100)}% · ×{layer.speed}
              </small>
            </button>
            <button type="button" onClick={() => toggle(i)} aria-label={layer.hidden ? 'Show layer' : 'Hide layer'}>
              {layer.hidden ? 'Show' : 'Hide'}
            </button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === layers.length - 1} aria-label="Move up">
              ↑
            </button>
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move down">
              ↓
            </button>
            <button type="button" onClick={() => duplicate(i)} disabled={full}>
              Duplicate
            </button>
            <button type="button" className="danger" onClick={() => remove(i)} disabled={layers.length <= 1}>
              Remove
            </button>
          </div>
        ))}
      <button type="button" onClick={onAdd} disabled={full}>
        Add layer {full ? `(max ${MAX_LAYERS})` : ''}
      </button>
    </div>
  )
}
