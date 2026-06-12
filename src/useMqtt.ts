import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { BROKER_URL, MAX_MODES, TOPIC_CONFIG, TOPIC_STATUS } from './config'
import { modeToPayload, parseMode } from './modeUtils'
import type { DeviceStatus, Mode } from './types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

function parseModes(payload: string): Mode[] | null {
  try {
    const doc = JSON.parse(payload)
    if (Array.isArray(doc.modes)) {
      const modes: Mode[] = []
      for (const raw of doc.modes.slice(0, MAX_MODES)) {
        const mode = parseMode(raw, modes.length)
        if (mode) modes.push(mode)
      }
      return modes.length > 0 ? modes : null
    }

    if (Array.isArray(doc.leds)) {
      const mode = parseMode({ ...doc, type: 'static' }, 0)
      return mode ? [mode] : null
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
      JSON.stringify({ modes: modes.map(modeToPayload) }),
      { retain: true, qos: 1 }
    )
  }

  return { status, deviceStatus, retainedModes, publish }
}

export { defaultModes } from './modeUtils'
