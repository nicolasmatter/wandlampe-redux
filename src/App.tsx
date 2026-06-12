import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { LED_COUNT, MAX_MODES } from './config'
import { defaultModes, emptyMode, useMqtt } from './useMqtt'
import type { Mode, RGB } from './types'
import './App.css'

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function cloneModes(modes: Mode[]): Mode[] {
  return modes.map(mode => ({
    ...mode,
    leds: mode.leds.map(led => ({ ...led })),
  }))
}

export default function App() {
  const [username, setUsername] = useState(() => sessionStorage.getItem('mq_user') ?? '')
  const [password, setPassword] = useState(() => sessionStorage.getItem('mq_pass') ?? '')
  const [authed, setAuthed] = useState(!!(sessionStorage.getItem('mq_user') && sessionStorage.getItem('mq_pass')))

  const [modes, setModes] = useState<Mode[]>(() => defaultModes())
  const [activeModeIndex, setActiveModeIndex] = useState(0)
  const [brushColor, setBrushColor] = useState('#ffffff')
  const isPainting = useRef(false)

  const { status, deviceStatus, retainedModes, publish } = useMqtt(authed ? username : '', authed ? password : '')

  useEffect(() => {
    if (retainedModes) {
      setModes(cloneModes(retainedModes))
      setActiveModeIndex(0)
    }
  }, [retainedModes])

  useEffect(() => {
    function stopPainting() {
      isPainting.current = false
    }
    window.addEventListener('pointerup', stopPainting)
    window.addEventListener('pointercancel', stopPainting)
    return () => {
      window.removeEventListener('pointerup', stopPainting)
      window.removeEventListener('pointercancel', stopPainting)
    }
  }, [])

  function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    sessionStorage.setItem('mq_user', username)
    sessionStorage.setItem('mq_pass', password)
    setAuthed(true)
  }

  function updateMode(updater: (mode: Mode) => Mode) {
    setModes(prev => prev.map((mode, i) => (i === activeModeIndex ? updater(mode) : mode)))
  }

  function paintLed(i: number) {
    const rgb = hexToRgb(brushColor)
    updateMode(mode => {
      const leds = [...mode.leds]
      leds[i] = rgb
      return { ...mode, leds }
    })
  }

  function fillAll() {
    const rgb = hexToRgb(brushColor)
    updateMode(mode => ({ ...mode, leds: Array(LED_COUNT).fill(rgb) }))
  }

  function clearAll() {
    updateMode(mode => ({ ...mode, leds: Array(LED_COUNT).fill({ r: 0, g: 0, b: 0 }) }))
  }

  function addMode() {
    if (modes.length >= MAX_MODES) return
    setModes(prev => [...prev, emptyMode(prev.length)])
    setActiveModeIndex(modes.length)
  }

  function removeMode(index: number) {
    if (modes.length <= 1) return
    setModes(prev => prev.filter((_, i) => i !== index))
    setActiveModeIndex(prev => (prev >= index ? Math.max(0, prev - 1) : prev))
  }

  const activeMode = modes[activeModeIndex]
  const { online, activeMode: deviceActiveMode } = deviceStatus

  let deviceModeLabel = 'unknown'
  if (online === false) deviceModeLabel = 'offline'
  else if (online === true) {
    if (deviceActiveMode === null || deviceActiveMode === undefined) deviceModeLabel = 'online'
    else if (deviceActiveMode < 0) deviceModeLabel = 'off'
    else deviceModeLabel = modes[deviceActiveMode]?.name ?? `Mode ${deviceActiveMode + 1}`
  }

  if (!authed) {
    return (
      <div className="login">
        <h1>Wandlampe</h1>
        <form onSubmit={handleLogin}>
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Connect</button>
        </form>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Wandlampe</h1>
        <div className="status">
          <span className={`dot ${status}`} />
          {status === 'connected'
            ? `${online === null ? 'device unknown' : online ? 'device online' : 'device offline'} · ${deviceModeLabel}`
            : status}
        </div>
      </header>

      <div className="mode-tabs">
        {modes.map((mode, i) => (
          <button
            key={i}
            className={`mode-tab ${i === activeModeIndex ? 'active' : ''}`}
            onClick={() => setActiveModeIndex(i)}
          >
            {mode.name || `Mode ${i + 1}`}
          </button>
        ))}
        {modes.length < MAX_MODES && (
          <button className="mode-tab add" onClick={addMode}>+</button>
        )}
      </div>

      <div className="mode-editor">
        <div className="mode-meta">
          <label>
            Name
            <input
              type="text"
              value={activeMode.name}
              onChange={e => updateMode(mode => ({ ...mode, name: e.target.value }))}
            />
          </label>
          <label>
            Brightness
            <input
              type="range"
              min={0}
              max={255}
              value={activeMode.brightness}
              onChange={e => updateMode(mode => ({ ...mode, brightness: +e.target.value }))}
            />
            <span>{activeMode.brightness}</span>
          </label>
          {modes.length > 1 && (
            <button className="danger" onClick={() => removeMode(activeModeIndex)}>Remove mode</button>
          )}
        </div>

        <div className="paint-tool">
          <div className="paint-tool-header">
            <span className="brush-swatch" style={{ background: brushColor }} />
            <span>Brush color</span>
          </div>
          <HexColorPicker color={brushColor} onChange={setBrushColor} />
        </div>

        <div
          className="grid"
          onPointerLeave={() => { isPainting.current = false }}
        >
          {activeMode.leds.map((led, i) => (
            <div
              key={i}
              className="cell"
              style={{ background: rgbToHex(led) }}
              onPointerDown={e => {
                e.preventDefault()
                isPainting.current = true
                paintLed(i)
              }}
              onPointerEnter={() => {
                if (isPainting.current) paintLed(i)
              }}
            >
              <span>{i + 1}</span>
            </div>
          ))}
        </div>

        <div className="controls">
          <div className="bulk">
            <button onClick={fillAll}>Fill all</button>
            <button onClick={clearAll}>Clear all</button>
          </div>

          <button
            className="apply"
            disabled={status !== 'connected'}
            onClick={() => publish(modes)}
          >
            Apply all modes
          </button>
        </div>
      </div>

      <p className="hint">Pick a brush color, then click or drag across LEDs to paint</p>
    </div>
  )
}
