import type { PreviewSettings } from './LabStrip'

type Props = {
  settings: PreviewSettings
  onChange: (patch: Partial<PreviewSettings>) => void
}

const LED_COUNTS = [24, 48, 60, 144]

export function PreviewControls({ settings, onChange }: Props) {
  return (
    <div className="lab-preview-controls">
      <label className="lab-inline">
        <span>LEDs</span>
        <select value={settings.ledCount} onChange={e => onChange({ ledCount: Number(e.target.value) })}>
          {LED_COUNTS.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="lab-inline">
        <span>Brightness {settings.brightness}</span>
        <input
          type="range"
          min={0}
          max={255}
          value={settings.brightness}
          onChange={e => onChange({ brightness: Number(e.target.value) })}
        />
      </label>
      <label className="lab-inline">
        <input type="checkbox" checked={settings.gamma} onChange={e => onChange({ gamma: e.target.checked })} />
        <span>Gamma</span>
      </label>
      <label className="lab-inline">
        <input type="checkbox" checked={settings.halo} onChange={e => onChange({ halo: e.target.checked })} />
        <span>Wall halo</span>
      </label>
    </div>
  )
}
