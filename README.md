# Wandlampe

Firmware and web controller for an Arduino Nano ESP32 wall lamp with 24 WS2812B LEDs.

The browser publishes mode configurations to an MQTT broker. The lamp stores them in flash, and its physical toggle switch cycles through off → mode 1 → off → mode 2 → … . Selecting a mode in the web editor does not activate it on the lamp.

## Layout

- `firmware/`: PlatformIO project, Arduino C++, FastLED, MQTT, NTP, and OTA updates.
- `web/`: React + TypeScript + Vite controller, with its own npm dependencies.
- `docs/mqtt.md`: shared protocol and configuration examples.
- `docs/hardware/`: wiring and power-supply diagrams.
- `specs/`: historical requirements and plans; these predate some implemented features.

## Web development

Requires Node.js compatible with Vite 8 (20.19+ or 22.12+) and npm.

```sh
cd web
npm ci
npm run dev
```

Enter MQTT credentials in the browser. Credentials live in session storage; edited modes live in local storage. **Apply all modes** publishes the configuration. Broker settings are in `web/src/config.ts`.

```sh
npm run build
npm run lint
```

For Vercel, point the project at this repository and set **Root Directory** to `web`, with the Vite preset, build command `npm run build`, and output directory `dist`. Firmware builds and web deployments remain independent.

## Firmware development

Install PlatformIO with support for the platform configured in `firmware/platformio.ini`. Open `wandlampe.code-workspace` in VS Code, or run commands from the repository root:

```sh
cp firmware/include/secrets.h.example firmware/include/secrets.h
# Fill in Wi-Fi and MQTT credentials in the ignored secrets.h file.
pio run -d firmware -e arduino_nano_esp32
pio run -d firmware -e arduino_nano_esp32 -t upload
pio device monitor -d firmware -b 115200
```

For subsequent wireless uploads, update the device IP in `firmware/platformio.ini` and run:

```sh
pio run -d firmware -e arduino_nano_esp32_ota -t upload
```

Pins, LED count, MQTT topics, and timing constants are in `firmware/include/config.h`. Credentials must not be committed.

## Working across both projects

When changing modes or MQTT messages, update both implementations and `docs/mqtt.md` together. Run the web build/lint and firmware build; physical switch, LED output, alarm timing, and OTA behavior also need hardware verification.

The web repository was imported with its complete Git history. Its pre-existing local edits were copied into `web/`; the original sibling checkout remains untouched. An obsolete self-referencing Git submodule entry was removed during consolidation.

This migration starts from the local 24-LED firmware revision. A pre-existing commit on `origin/master` (`ceed774`) changes the firmware to 46 LEDs and adjusts configuration handling; reconcile it with the web model and fixed-size firmware arrays before merging that change.
