import { render } from '../animation/engine'
import type { Animation } from '../animation/types'
import { rgbToHex } from '../modeUtils'
import { ledLook } from './ledLook'

export type PreviewSettings = {
  ledCount: number
  brightness: number
  gamma: boolean
  glow: boolean
}

type Props = {
  animation: Animation
  timeMs: number
  /** Never-wrapping time for free-running layers. */
  clockMs: number
  settings: PreviewSettings
}

/** Shows one moment of an animation on a simulated strip. */
export function LabStrip({ animation, timeMs, clockMs, settings }: Props) {
  const leds = render(animation, timeMs, settings.ledCount, clockMs).map(c =>
    rgbToHex(ledLook(c, settings.brightness, settings.gamma)),
  )

  return (
    <div
      className={`lab-strip ${settings.glow ? 'glow' : ''}`}
      style={{ gridTemplateColumns: `repeat(${settings.ledCount}, minmax(0, 1fr))` }}
    >
      {leds.map((hex, i) => (
        <div key={i} className="lab-led" style={{ background: hex, color: hex }} />
      ))}
    </div>
  )
}
