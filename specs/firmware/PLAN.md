# Implementation Plan — wandlampe-redux Firmware

## Phase 1 — PlatformIO scaffold + LED smoke test
- [ ] `platformio.ini` configured for Arduino Nano ESP32 with FastLED dependency
- [ ] `config.h` exists with `LED_PIN` and `LED_COUNT` constants
- [ ] `secrets.h` listed in `.gitignore`
- [ ] `LedController` class initialises FastLED and can set all LEDs to a given RGB
- [ ] Boot cycles red → green → blue across all 24 LEDs, visible on hardware

## Phase 2 — WiFi + MQTT connection (plain TCP)
- [ ] Device connects to WiFi using credentials from `secrets.h`
- [ ] `MqttClient` connects to broker on port 1883 (plain TCP, no TLS)
- [ ] Subscribes to `wandlampe/config` on connect
- [ ] Incoming messages are logged to Serial
- [ ] Connection verified end-to-end with MQTTX or mosquitto_pub from dev machine

## Phase 3 — TLS + auth + LWT
- [ ] `MqttClient` uses `WiFiClientSecure` on port 8883
- [ ] Username/password auth from `secrets.h`
- [ ] LWT configured: `wandlampe/status` → `{"status":"offline"}` (retained)
- [ ] Publishes `{"status":"online"}` on successful connect
- [ ] Verified against `vps.nicolasmatter.ch` broker

## Phase 4 — Config parsing + LED rendering + NVS persistence
- [ ] Incoming `wandlampe/config` JSON is parsed with ArduinoJson
- [ ] Optional `brightness` field (0–255) applied as global scale
- [ ] All 24 LEDs rendered via `LedController` from parsed config
- [ ] Config saved to NVS (`Preferences`) after every successful parse
- [ ] On boot, last saved config is loaded from NVS and rendered to LEDs 1–23 before WiFi connects

## Phase 5 — Status indicator + reconnect loop
- [ ] LED 0 shows slow orange pulse (~2 s cycle) whenever MQTT is not connected
- [ ] If MQTT drops, LED 0 reverts to status animation immediately
- [ ] Reconnect attempted every 10 minutes (`MQTT_RECONNECT_INTERVAL_MS`)
- [ ] On reconnect, LED 0 returns to config color once new message received
- [ ] Device survives extended broker downtime and recovers automatically
