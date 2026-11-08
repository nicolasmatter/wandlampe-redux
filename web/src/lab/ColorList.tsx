import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { hexToRgb, rgbToHex } from '../modeUtils'
import type { RGB } from '../types'

type Props = {
  colors: RGB[]
  min: number
  max: number
  onChange: (colors: RGB[]) => void
}

/** Ordered list of colors: pick a swatch to edit it, add or remove swatches within min–max. */
export function ColorList({ colors, min, max, onChange }: Props) {
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, colors.length - 1)

  const add = () => {
    const next = [...colors.slice(0, index + 1), colors[index], ...colors.slice(index + 1)]
    onChange(next)
    setSelected(index + 1)
  }
  const remove = () => {
    onChange(colors.filter((_, i) => i !== index))
    setSelected(Math.max(0, index - 1))
  }

  return (
    <div className="lab-color-list">
      <div className="lab-swatches">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`lab-swatch ${i === index ? 'selected' : ''}`}
            style={{ background: rgbToHex(c) }}
            aria-label={`Color ${i + 1}`}
            onClick={() => setSelected(i)}
          />
        ))}
        <button type="button" onClick={add} disabled={colors.length >= max}>
          +
        </button>
        <button type="button" onClick={remove} disabled={colors.length <= min}>
          −
        </button>
      </div>
      <HexColorPicker
        color={rgbToHex(colors[index])}
        onChange={hex => onChange(colors.map((c, i) => (i === index ? hexToRgb(hex) : c)))}
      />
    </div>
  )
}
