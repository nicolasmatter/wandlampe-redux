export type RGB = { r: number; g: number; b: number }

export type Mode = {
  name: string
  brightness: number
  leds: RGB[]
}

export type DeviceStatus = {
  online: boolean | null
  activeMode: number | null
}
