export type PreviewSettings = {
  ledCount: number
  brightness: number
  gamma: boolean
  /** Outward light on the wall around the ring. */
  halo: boolean
}

const MARKS = [
  ['Bottom', 0],
  ['Right', 0.25],
  ['Top', 0.5],
  ['Left', 0.75],
  ['Bottom', 1],
] as const

/** The ring cut open at the bottom and laid flat: position 0 on the left, 1 on the right. */
export function LabStrip({ colors }: { colors: string[] }) {
  return (
    <div className="lab-strip-wrap">
      <div className="lab-strip" style={{ gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))` }}>
        {colors.map((hex, i) => (
          <div key={i} className="lab-led" style={{ background: hex }} />
        ))}
      </div>
      <div className="lab-strip-marks" aria-hidden>
        {MARKS.map(([label, at], i) => (
          <span key={i} style={{ left: `${at * 100}%` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
