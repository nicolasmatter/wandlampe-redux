import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { BROKER_URL, LED_COUNT, MAX_MODES, TOPIC_CONFIG, TOPIC_STATUS } from './config'
import type { DeviceStatus, Mode, RGB } from './types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

function emptyLeds(): RGB[] {
  return Array(LED_COUNT).fill({ r: 0, g: 0, b: 0 })
}

function parseModes(payload: string): Mode[] | null {
  try {
    const doc = JSON.parse(payload)
    if (Array.isArray(doc.modes)) {
      const modes: Mode[] = []
      for (const raw of doc.modes.slice(0, MAX_MODES)) {
        if (!Array.isArray(raw.leds) || raw.leds.length < LED_COUNT) continue
        modes.push({
          name: typeof raw.name === 'string' ? raw.name : `Mode ${modes.length + 1}`,
          brightness: typeof raw.brightness === 'number' ? raw.brightness : 255,
          leds: raw.leds.slice(0, LED_COUNT).map((led: RGB) => ({
            r: led.r ?? 0,
            g: led.g ?? 0,
            b: led.b ?? 0,
          })),
        })
      }
      return modes.length > 0 ? modes : null
    }

    if (Array.isArray(doc.leds) && doc.leds.length >= LED_COUNT) {
      return [{
        name: 'Mode 1',
        brightness: typeof doc.brightness === 'number' ? doc.brightness : 255,
        leds: doc.leds.slice(0, LED_COUNT).map((led: RGB) => ({
          r: led.r ?? 0,
          g: led.g ?? 0,
          b: led.b ?? 0,
        })),
      }]
    }
  } catch {}
  return null
}

export function useMqtt(username: string, password: string) {
  const clientRef = useRef<MqttClient | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ online: null, activeMode: null })
  const [retainedModes, setRetainedModes] = useState<Mode[] | null>(null)

  useEffect(() => {
    if (!username || !password) return

    setStatus('connecting')
    const client = mqtt.connect(BROKER_URL, { username, password, reconnectPeriod: 0 })
    clientRef.current = client

    client.on('connect', () => {
      setStatus('connected')
      client.subscribe([TOPIC_STATUS, TOPIC_CONFIG])
    })

    client.on('message', (topic, payload) => {
      const text = payload.toString()

      if (topic === TOPIC_STATUS) {
        try {
          const msg = JSON.parse(text)
          setDeviceStatus({
            online: msg.status === 'online',
            activeMode: typeof msg.activeMode === 'number' ? msg.activeMode : null,
          })
        } catch {}
      }

      if (topic === TOPIC_CONFIG) {
        const modes = parseModes(text)
        if (modes) setRetainedModes(modes)
      }
    })

    client.on('error', () => setStatus('disconnected'))
    client.on('close', () => setStatus('disconnected'))

    return () => { client.end(); clientRef.current = null }
  }, [username, password])

  function publish(modes: Mode[]) {
    clientRef.current?.publish(
      TOPIC_CONFIG,
      JSON.stringify({
        modes: modes.map(mode => ({
          name: mode.name,
          brightness: mode.brightness,
          leds: mode.leds,
        })),
      }),
      { retain: true, qos: 1 }
    )
  }

  return { status, deviceStatus, retainedModes, publish }
}

export function defaultModes(): Mode[] {
  return [
    { name: 'White', brightness: 128, leds: Array(LED_COUNT).fill({ r: 255, g: 255, b: 255 }) },
    { name: 'Blue', brightness: 128, leds: Array(LED_COUNT).fill({ r: 0, g: 0, b: 255 }) },
  ]
}

export function emptyMode(index: number): Mode {
  return { name: `Mode ${index + 1}`, brightness: 255, leds: emptyLeds() }
}
