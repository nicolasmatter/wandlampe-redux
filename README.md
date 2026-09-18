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

## Web deployment (Vercel)

Configure the existing Vercel project as follows:

1. In **Settings → Git**, connect `nicolasmatter/wandlampe-redux` instead of the old `wandlampe-web` repository.
2. In **Settings → Build and Deployment → Root Directory**, click **Edit**, enter `web` (without a leading slash), and save.
3. In the build settings, use:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. In **Settings → Environments → Production → Branch Tracking**, enter the branch that should publish the live site and save. Use `master` to deploy merges to master, or `production` if using a dedicated release branch. The environment name **Production** does not itself determine the Git branch.
5. Deploy the latest commit from the selected branch. Root-directory changes apply to the next deployment.

Pushes and merges to the tracked production branch trigger production deployments; other branches create preview deployments by default. The configured branch must be pushed to GitHub. Firmware builds and uploads remain separate from Vercel deployment.

See Vercel's [monorepo configuration](https://vercel.com/docs/monorepos) and [Git deployment documentation](https://vercel.com/docs/git).

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
