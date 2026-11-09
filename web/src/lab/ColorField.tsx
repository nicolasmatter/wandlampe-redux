import { HexColorPicker } from 'react-colorful'
import { hexToRgb, rgbToHex } from '../modeUtils'
import type { RGB } from '../types'

export function ColorField({ label, color, onChange }: { label: string; color: RGB; onChange: (c: RGB) => void }) {
  return (
    <div className="lab-color-field">
      <span>{label}</span>
      <HexColorPicker color={rgbToHex(color)} onChange={hex => onChange(hexToRgb(hex))} />
    </div>
  )
}
