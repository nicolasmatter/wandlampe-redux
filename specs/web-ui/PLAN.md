# Implementation Plan — Wandlampe Web UI

## Phase 1 — Project scaffold + MQTT connection gate ✓
- [x] Vite + React + TypeScript project initialised
- [x] `mqtt` npm package installed
- [x] `useMqtt` hook connects to `wss://vps.nicolasmatter.ch:9001` with credentials
- [x] Credentials prompted at first load, stored in `sessionStorage`
- [x] App shows "Connecting…" / "Connected" / "Disconnected" states
- [x] Connection verified against VPS broker in browser

## Phase 2 — LED grid + per-cell color picker ✓
- [x] 24-LED array state managed in App
- [x] Grid renders 24 cells, each showing its current color as background
- [x] Clicking a cell opens `react-colorful` color picker popover
- [x] Picking a color updates that cell's state locally

## Phase 3 — Bulk actions + brightness slider ✓
- [x] "Set all" button opens a color picker and applies the chosen color to all 24 cells
- [x] "Clear all" button sets all 24 cells to `{r:0, g:0, b:0}`
- [x] Brightness slider (0–255) with default 255

## Phase 4 — Publish + device status ✓
- [x] "Apply" button publishes current LED state + brightness to `wandlampe/config` (retained, QoS 1)
- [x] Button disabled while MQTT not connected
- [x] App subscribes to `wandlampe/status` on connect
- [x] Status indicator shows online / offline / unknown

## Phase 5 — Vercel deploy + polish ✓
- [x] Deployed to Vercel (static Vite build)
- [ ] Credential prompt handles wrong password gracefully (reconnect on re-entry)
