import { HexColorPicker } from 'react-colorful'
import { hexToRgb, rgbToHex, formatAlarmTime } from '../modeUtils'
import type { AnimationId, Mode, ModeType } from '../types'
import { ANIMATION_LABELS, MODE_TYPE_LABELS } from '../types'

const MODE_TYPES = Object.keys(MODE_TYPE_LABELS) as ModeType[]
const ANIMATIONS = Object.keys(ANIMATION_LABELS) as AnimationId[]

type Props = {
  mode: Mode
  brushColor: string
  onBrushColorChange: (hex: string) => void
  onUpdate: (updater: (mode: Mode) => Mode) => void
  onTypeChange: (type: ModeType) => void
}

export function ModeTypeSelector({ mode, onTypeChange }: Pick<Props, 'mode' | 'onTypeChange'>) {
  return (
    <div className="type-selector">
      {MODE_TYPES.map(type => (
        <button
          key={type}
          type="button"
          className={`type-option ${mode.type === type ? 'active' : ''}`}
          onClick={() => onTypeChange(type)}
        >
          {MODE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}

export function ModeTypeEditor({ mode, brushColor, onBrushColorChange, onUpdate }: Props) {
  switch (mode.type) {
    case 'static':
      return (
        <div className="type-editor">
          <p className="type-editor-hint">Pick a brush color, then click or drag across the strip to paint.</p>
          <div className="color-picker-block">
            <div className="color-picker-label">
              <span className="swatch" style={{ background: brushColor }} />
              Brush
            </div>
            <HexColorPicker color={brushColor} onChange={onBrushColorChange} />
          </div>
        </div>
      )

    case 'single-color':
      return (
        <div className="type-editor">
          <p className="type-editor-hint">One color applied to the entire strip.</p>
          {mode.color && (
            <div className="color-picker-block">
              <div className="color-picker-label">
                <span className="swatch" style={{ background: rgbToHex(mode.color) }} />
                Color
              </div>
              <HexColorPicker
                color={rgbToHex(mode.color)}
                onChange={hex => onUpdate(m => ({ ...m, color: hexToRgb(hex) }))}
              />
            </div>
          )}
        </div>
      )

    case 'gradient':
      return (
        <div className="type-editor">
          <p className="type-editor-hint">Gradient runs left to right along the strip.</p>
          <div className="gradient-pickers">
            {mode.from && (
              <div className="color-picker-block">
                <div className="color-picker-label">
                  <span className="swatch" style={{ background: rgbToHex(mode.from) }} />
                  Start (left)
                </div>
                <HexColorPicker
                  color={rgbToHex(mode.from)}
                  onChange={hex => onUpdate(m => ({ ...m, from: hexToRgb(hex) }))}
                />
              </div>
            )}
            {mode.to && (
              <div className="color-picker-block">
                <div className="color-picker-label">
                  <span className="swatch" style={{ background: rgbToHex(mode.to) }} />
                  End (right)
                </div>
                <HexColorPicker
                  color={rgbToHex(mode.to)}
                  onChange={hex => onUpdate(m => ({ ...m, to: hexToRgb(hex) }))}
                />
              </div>
            )}
          </div>
        </div>
      )

    case 'animation':
      return (
        <div className="type-editor">
          <p className="type-editor-hint">Animated effect while this mode is active on the lamp.</p>
          <label className="field-row">
            Effect
            <select
              value={mode.animation ?? 'rainbow'}
              onChange={e => onUpdate(m => ({ ...m, animation: e.target.value as AnimationId }))}
            >
              {ANIMATIONS.map(id => (
                <option key={id} value={id}>{ANIMATION_LABELS[id]}</option>
              ))}
            </select>
          </label>
          {mode.animation !== 'rainbow' && mode.color && (
            <div className="color-picker-block">
              <div className="color-picker-label">
                <span className="swatch" style={{ background: rgbToHex(mode.color) }} />
                Color
              </div>
              <HexColorPicker
                color={rgbToHex(mode.color)}
                onChange={hex => onUpdate(m => ({ ...m, color: hexToRgb(hex) }))}
              />
            </div>
          )}
        </div>
      )

    case 'alarm-clock':
      return (
        <div className="type-editor">
          <p className="type-editor-hint">
            Strip stays off until the alarm time, then pulses. Toggle the switch to dismiss.
            Uses Europe/Zurich time on the lamp.
          </p>
          <label className="field-row">
            Time
            <input
              type="time"
              value={formatAlarmTime(mode.hour ?? 7, mode.minute ?? 0)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number)
                onUpdate(mod => ({ ...mod, hour: h, minute: m }))
              }}
            />
          </label>
          {mode.color && (
            <div className="color-picker-block">
              <div className="color-picker-label">
                <span className="swatch" style={{ background: rgbToHex(mode.color) }} />
                Alarm color
              </div>
              <HexColorPicker
                color={rgbToHex(mode.color)}
                onChange={hex => onUpdate(m => ({ ...m, color: hexToRgb(hex) }))}
              />
            </div>
          )}
        </div>
      )
  }
}

export function modeTypeShort(type: ModeType): string {
  switch (type) {
    case 'single-color': return 'Solid'
    case 'gradient': return 'Gradient'
    case 'animation': return 'Anim'
    case 'alarm-clock': return 'Alarm'
    case 'static': return 'Paint'
  }
}
