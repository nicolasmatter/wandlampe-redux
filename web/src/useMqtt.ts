import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { BROKER_URL, MAX_MODES, TOPIC_CONFIG, TOPIC_STATUS } from './config'
import { configPayload, parseMode } from './modeUtils'
import type { DeviceStatus, Mode, ModeProblem } from './types'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'
// Why a login attempt failed before its first connection.
export type LoginFailure = 'auth' | 'unreachable' | null

// MQTT 3.1.1 CONNACK codes 4 (bad username or password) and 5 (not authorized).
function isAuthError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code
  return code === 4 || code === 5 || code === 134 || code === 135
}

function parseProblems(raw: unknown): ModeProblem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (p): p is ModeProblem => typeof p?.mode === 'number' && typeof p?.error === 'string',
  )
}

/** True if the config still names the lamp's former hardcoded animations. */
function hasLegacyAnimations(payload: string): boolean {
  try {
    const doc = JSON.parse(payload)
    return Array.isArray(doc.modes) && doc.modes.some((m: { animation?: unknown }) => typeof m?.animation === 'string')
  } catch {
    return false
  }
}

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

// `attempt` changes on every login submit, so the same credentials can be retried.
export function useMqtt(username: string, password: string, attempt = 0) {
  const clientRef = useRef<MqttClient | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ online: null, activeMode: null, errors: [], configError: null })
  const [loginFailure, setLoginFailure] = useState<LoginFailure>(null)
  // The broker accepted these credentials at least once.
  const [hasConnected, setHasConnected] = useState(false)
  const [retainedModes, setRetainedModes] = useState<Mode[] | null>(null)
  // The retained config used the former hardcoded animations; they were converted and need publishing.
  const [retainedConverted, setRetainedConverted] = useState(false)

  useEffect(() => {
    if (!username || !password) return

    setStatus('connecting')
    let ended = false
    let connectedOnce = false
    let failure: LoginFailure = null
    const client = mqtt.connect(BROKER_URL, { username, password, reconnectPeriod: 0 })
    clientRef.current = client

    client.on('connect', () => {
      connectedOnce = true
      setHasConnected(true)
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
            errors: parseProblems(msg.errors),
            configError: typeof msg.configError === 'string' ? msg.configError : null,
          })
        } catch {}
      }

      if (topic === TOPIC_CONFIG) {
        const modes = parseModes(text)
        if (modes) {
          setRetainedModes(modes)
          setRetainedConverted(hasLegacyAnimations(text))
        }
      }
    })

    client.on('error', (err) => {
      if (isAuthError(err)) failure = 'auth'
      setStatus('disconnected')
    })
    client.on('close', () => {
      if (ended) return
      setStatus('disconnected')
      if (!connectedOnce) setLoginFailure(failure ?? 'unreachable')
    })

    return () => {
      ended = true
      client.end()
      clientRef.current = null
      setLoginFailure(null)
      setHasConnected(false)
    }
  }, [username, password, attempt])

  function publish(modes: Mode[]) {
    clientRef.current?.publish(
      TOPIC_CONFIG,
      configPayload(modes),
      { retain: true, qos: 1 }
    )
  }

  return { status, loginFailure, hasConnected, deviceStatus, retainedModes, retainedConverted, publish }
}

export { defaultModes } from './modeUtils'
