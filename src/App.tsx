import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useMqtt } from './useMqtt'
import { LED_COUNT } from './config'
import './App.css'

type RGB = { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

const DEFAULT_LEDS: RGB[] = Array(LED_COUNT).fill({ r: 0, g: 0, b: 0 })

export default function App() {
  const [username, setUsername] = useState(() => sessionStorage.getItem('mq_user') ?? '')
  const [password, setPassword] = useState(() => sessionStorage.getItem('mq_pass') ?? '')
  const [authed, setAuthed] = useState(!!(sessionStorage.getItem('mq_user') && sessionStorage.getItem('mq_pass')))

  const [leds, setLeds] = useState<RGB[]>(DEFAULT_LEDS)
  const [brightness, setBrightness] = useState(255)
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)
  const [bulkColor, setBulkColor] = useState('#ffffff')
  const [showBulkPicker, setShowBulkPicker] = useState(false)

  const { status, deviceOnline, publish } = useMqtt(authed ? username : '', authed ? password : '')

  function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    sessionStorage.setItem('mq_user', username)
    sessionStorage.setItem('mq_pass', password)
    setAuthed(true)
  }

  function setLed(i: number, hex: string) {
    const next = [...leds]
    next[i] = hexToRgb(hex)
    setLeds(next)
  }

  function setAll(hex: string) {
    setLeds(Array(LED_COUNT).fill(hexToRgb(hex)))
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
    <div className="app" onClick={() => { setPickerIndex(null); setShowBulkPicker(false) }}>
      <header>
        <h1>Wandlampe</h1>
        <div className="status">
          <span className={`dot ${status}`} />
          {status === 'connected'
            ? deviceOnline === null ? 'device unknown' : deviceOnline ? 'device online' : 'device offline'
            : status}
        </div>
      </header>

      <div className="grid" onClick={e => e.stopPropagation()}>
        {leds.map((led, i) => (
          <div
            key={i}
            className={`cell ${pickerIndex === i ? 'active' : ''}`}
            style={{ background: rgbToHex(led) }}
            onClick={() => { setShowBulkPicker(false); setPickerIndex(pickerIndex === i ? null : i) }}
          >
            <span>{i + 1}</span>
          </div>
        ))}
      </div>

      {pickerIndex !== null && (
        <div className="picker-popover" onClick={e => e.stopPropagation()}>
          <HexColorPicker color={rgbToHex(leds[pickerIndex])} onChange={hex => setLed(pickerIndex, hex)} />
        </div>
      )}

      <div className="controls" onClick={e => e.stopPropagation()}>
        <div className="bulk">
          <button onClick={() => { setPickerIndex(null); setShowBulkPicker(!showBulkPicker) }}>Set all</button>
          {showBulkPicker && (
            <div className="picker-popover">
              <HexColorPicker color={bulkColor} onChange={hex => { setBulkColor(hex); setAll(hex) }} />
            </div>
          )}
          <button onClick={() => { setLeds([...DEFAULT_LEDS]); setPickerIndex(null) }}>Clear all</button>
        </div>

        <label>
          Brightness
          <input type="range" min={0} max={255} value={brightness} onChange={e => setBrightness(+e.target.value)} />
          <span>{brightness}</span>
        </label>

        <button
          className="apply"
          disabled={status !== 'connected'}
          onClick={() => publish(brightness, leds)}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
