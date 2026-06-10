# Firmware PRD — wandlampe-redux

## Problem

A fixed installation of 24 WS2812B LEDs (Arduino Nano ESP32) needs to display a remotely-configurable color state. The configuration must be changeable from a web interface on any network, survive reboots by restoring the last known state, and give a clear visual indication when the device is offline.

## Solution

Firmware that:
1. Connects to WiFi and a VPS-hosted MQTT broker (TLS) on boot
2. Loads the last saved config from NVS and renders it immediately (skipping LED 0, reserved for status)
3. Shows a slow orange pulse on LED 0 while connecting
4. Subscribes to a retained config topic and renders the full 24-LED state on first message
5. Saves every received config to NVS for reboot resilience
6. Retries the MQTT connection every 10 minutes if disconnected

---

## MQTT Protocol

**Broker:** `vps.nicolasmatter.ch:8883` — self-hosted Mosquitto, TLS, username/password auth

| Topic | Direction | Retain | Purpose |
|---|---|---|---|
| `wandlampe/config` | In | yes | Full 24-LED color state published by web UI |
| `wandlampe/status` | Out | yes | `{"status":"online"}` on connect; LWT `{"status":"offline"}` |

### Config payload schema

```json
{
  "brightness": 200,
  "leds": [
    {"r": 255, "g": 120, "b": 0},
    {"r": 0,   "g": 0,   "b": 0}
  ]
}
```

- `brightness`: optional, 0–255, global scale applied on top of per-LED values. Defaults to 255.
- `leds`: required, exactly 24 objects with `r`, `g`, `b` fields (0–255 each).

---

## Boot Sequence

1. Initialize FastLED — all LEDs off
2. Load last config from NVS → render LEDs 1–23 (LED 0 reserved for status)
3. Start slow orange pulse on LED 0 ("connecting")
4. Connect WiFi (blocking, credentials from `secrets.h`)
5. Connect to MQTT broker over TLS
6. On first `wandlampe/config` message: save to NVS, render all 24 LEDs including LED 0
7. Stay subscribed — apply future config messages immediately

---

## Reconnect Behavior

- If MQTT connection drops: LED 0 reverts to slow orange pulse; retry connection every 10 minutes (configurable via `MQTT_RECONNECT_INTERVAL_MS` in `config.h`)
- WiFi reconnection is handled by the ESP32 WiFi stack automatically; MQTT reconnect follows once WiFi is back

---

## Status Indicator (LED 0)

| State | LED 0 |
|---|---|
| Connecting / no MQTT | Slow orange pulse (fade in/out, ~2 s cycle) |
| Connected, config received | Normal config color for LED 0 |

---

## Project Structure

```
wandlampe-redux/
├── src/
│   ├── main.cpp          # setup(), loop(), WiFi init, wires LedController + MqttClient
│   ├── LedController.h   # FastLED wrapper: render config, run status animation, NVS load/save
│   ├── LedController.cpp
│   ├── MqttClient.h      # PubSubClient wrapper: TLS connect, subscribe, reconnect, LWT publish
│   ├── MqttClient.cpp
│   ├── config.h          # Pin, topic, timing constants (tracked in git)
│   └── secrets.h         # WiFi + MQTT credentials (gitignored)
├── platformio.ini
└── .gitignore
```

### config.h constants

```cpp
#define LED_PIN           5       // GPIO pin for WS2812B data
#define LED_COUNT         24
#define MQTT_BROKER       "vps.nicolasmatter.ch"
#define MQTT_PORT         8883
#define MQTT_TOPIC_CONFIG "wandlampe/config"
#define MQTT_TOPIC_STATUS "wandlampe/status"
#define MQTT_RECONNECT_INTERVAL_MS 600000  // 10 minutes
#define STATUS_PULSE_PERIOD_MS     2000    // orange pulse cycle
```

---

## Libraries

| Library | Purpose |
|---|---|
| FastLED | WS2812B control |
| PubSubClient | MQTT client |
| ArduinoJson | JSON parsing |
| Preferences | NVS persistent storage |
| WiFiClientSecure | TLS socket for MQTT |

---

## Out of Scope

- OTA firmware updates
- Animation / pattern modes (composition handled by web UI before publishing)
- HTTP / REST interface
- Multiple LED strips or segments
