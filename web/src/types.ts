import type { Animation } from './animation/types'

export type RGB = { r: number; g: number; b: number }

export type ModeType = 'static' | 'single-color' | 'gradient' | 'animation' | 'alarm-clock'

export type Mode = {
  name: string
  type: ModeType
  brightness: number
  color?: RGB
  from?: RGB
  to?: RGB
  /** A Lab animation, embedded in full (ADR 0001). */
  animation?: Animation
  hour?: number
  minute?: number
  leds?: RGB[]
}

/** A mode the lamp skips (shows black), and why. */
export type ModeProblem = { mode: number; error: string }

export type DeviceStatus = {
  online: boolean | null
  activeMode: number | null
  /** Modes of the last accepted config the lamp can't play. */
  errors: ModeProblem[]
  /** Why the lamp rejected the last config it received, if it did. */
  configError: string | null
}

export const MODE_TYPE_LABELS: Record<ModeType, string> = {
  static: 'Static (paint)',
  'single-color': 'Single color',
  gradient: 'Gradient',
  animation: 'Animation',
  'alarm-clock': 'Alarm clock',
}
