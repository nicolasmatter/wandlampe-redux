# Implementation Plan — Wandlampe Web UI

## Phase 1 — Project scaffold + MQTT connection gate
- [ ] Vite + React + TypeScript project initialised
- [ ] `mqtt` npm package installed
- [ ] `useMqtt` hook connects to `wss://vps.nicolasmatter.ch:9001` with credentials
- [ ] Credentials prompted at first load, stored in `sessionStorage`
- [ ] App shows "Connecting…" / "Connected" / "Disconnected" states
- [ ] Connection verified against VPS broker in browser

## Phase 2 — LED grid + per-cell color picker
- [ ] `useLedState` hook manages array of 24 `{r, g, b}` values
- [ ] `LedGrid` renders 24 cells, each showing its current color as background
- [ ] Clicking a cell opens `react-colorful` color picker popover
- [ ] Picking a color updates that cell's state locally
- [ ] No publish yet — all changes are local

## Phase 3 — Bulk actions + brightness slider
- [ ] "Set all" button opens a color picker and applies the chosen color to all 24 cells
- [ ] "Clear all" button sets all 24 cells to `{r:0, g:0, b:0}`
- [ ] Brightness slider (0–255) with default 255
- [ ] All controls update local state only

## Phase 4 — Publish + device status
- [ ] "Apply" button publishes current LED state + brightness to `wandlampe/config` (retained, QoS 1)
- [ ] Button disabled while MQTT not connected
- [ ] App subscribes to `wandlampe/status` on connect
- [ ] `StatusIndicator` shows online / offline based on retained status message

## Phase 5 — Netlify deploy + polish
- [ ] `netlify.toml` configured for static Vite build
- [ ] `.env.example` documents `VITE_MQTT_BROKER_URL`
- [ ] Deployed to Netlify and verified end-to-end with ESP32
- [ ] Credential prompt handles wrong password gracefully (reconnect on re-entry)
