export type RGB = { r: number; g: number; b: number }

export type ModeType = 'static' | 'single-color' | 'gradient' | 'animation' | 'alarm-clock'

export type AnimationId = 'rainbow' | 'pulse' | 'breathe'

export type Mode = {
  name: string
  type: ModeType
  brightness: number
  color?: RGB
  from?: RGB
  to?: RGB
  animation?: AnimationId
  hour?: number
  minute?: number
  leds?: RGB[]
}

export type DeviceStatus = {
  online: boolean | null
  activeMode: number | null
}

export const MODE_TYPE_LABELS: Record<ModeType, string> = {
  static: 'Static (paint)',
  'single-color': 'Single color',
  gradient: 'Gradient',
  animation: 'Animation',
  'alarm-clock': 'Alarm clock',
}

export const ANIMATION_LABELS: Record<AnimationId, string> = {
  rainbow: 'Rainbow',
  pulse: 'Pulse',
  breathe: 'Breathe',
}
