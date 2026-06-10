import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { BROKER_URL, TOPIC_CONFIG, TOPIC_STATUS } from './config'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export function useMqtt(username: string, password: string) {
  const clientRef = useRef<MqttClient | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null)

  useEffect(() => {
    if (!username || !password) return

    setStatus('connecting')
    const client = mqtt.connect(BROKER_URL, { username, password, reconnectPeriod: 0 })
    clientRef.current = client

    client.on('connect', () => {
      setStatus('connected')
      client.subscribe(TOPIC_STATUS)
    })

    client.on('message', (topic, payload) => {
      if (topic === TOPIC_STATUS) {
        try {
          const msg = JSON.parse(payload.toString())
          setDeviceOnline(msg.status === 'online')
        } catch {}
      }
    })

    client.on('error', () => setStatus('disconnected'))
    client.on('close', () => setStatus('disconnected'))

    return () => { client.end(); clientRef.current = null }
  }, [username, password])

  function publish(brightness: number, leds: { r: number; g: number; b: number }[]) {
    clientRef.current?.publish(
      TOPIC_CONFIG,
      JSON.stringify({ brightness, leds }),
      { retain: true, qos: 1 }
    )
  }

  return { status, deviceOnline, publish }
}
