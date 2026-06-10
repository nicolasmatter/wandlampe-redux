# Web UI PRD — Wandlampe Controller

## Problem

The wandlampe ESP32 displays whatever config is retained on `wandlampe/config`. There needs to be a simple web interface — accessible from any network — where the operator can set per-LED colors and publish the resulting config to the broker.

## Solution

A single-page React + Vite app deployed on Netlify. It connects directly to the VPS MQTT broker over WSS, renders a grid of 24 color cells, and publishes the full config as a retained message when the user confirms.

---

## Features

### LED Grid
- 24 cells arranged in a visual grid
- Each cell displays its current color
- Clicking a cell opens a color picker for that LED
- Changes are local until the user publishes

### Bulk actions
- **Set all** — opens a single color picker; applies chosen color to all 24 LEDs
- **Clear all** — sets all 24 LEDs to black (off)

### Global brightness
- Slider (0–255) included in the published config payload as the optional `brightness` field

### Publish
- Single "Apply" button publishes the current 24-LED state + brightness to `wandlampe/config` (retained, QoS 1)
- Button is disabled while not connected to the broker

### Device status
- Small indicator showing whether the ESP32 is online/offline, derived from `wandlampe/status` (retained)

---

## MQTT

**Broker:** `wss://vps.nicolasmatter.ch:9001` (WSS — same port as existing Angular app; browser connects directly to Mosquitto, not via the Fastify API)

**Credentials:** MQTT username/password (`wandlampe_web` user) prompted at runtime on first load; stored in `sessionStorage` for the session. Not baked into the build.

| Topic | Direction | Purpose |
|---|---|---|
| `wandlampe/config` | Out (publish, retain) | Full 24-LED config sent on Apply |
| `wandlampe/status` | In (subscribe) | Device online/offline indicator |

**Published payload:**
```json
{
  "brightness": 200,
  "leds": [
    {"r": 255, "g": 120, "b": 0},
    ...
  ]
}
```

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite |
| Language | TypeScript |
| MQTT client | `mqtt` (npm) — browser WebSocket transport |
| Color picker | `react-colorful` |
| Styling | CSS modules or Tailwind |
| Deployment | Netlify (static export) |
| State | `useState` / `useReducer` — no external state library needed |

---

## Project Structure

```
wandlampe-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Root: MQTT connection gate
│   ├── components/
│   │   ├── LedGrid.tsx       # 24-cell grid
│   │   ├── LedCell.tsx       # Single cell + color picker popover
│   │   ├── BrightnessSlider.tsx
│   │   ├── BulkActions.tsx   # Set all / Clear all
│   │   └── StatusIndicator.tsx
│   ├── hooks/
│   │   ├── useMqtt.ts        # Connection, publish, subscribe
│   │   └── useLedState.ts    # 24-LED array state + bulk helpers
│   └── config.ts             # Broker URL, topic constants
├── .env.example              # VITE_MQTT_BROKER_URL
├── netlify.toml
└── vite.config.ts
```

---

## Out of Scope

- Animation / pattern modes
- Multi-device support
- User accounts / persistent saved configs
- Admin interface
