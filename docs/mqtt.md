# MQTT protocol

This describes the current source in `firmware/` and `web/`. Historical specs may differ.

## Transport and topics

The firmware connects to `vps.nicolasmatter.ch:8883` over TLS with username/password authentication. It currently disables server certificate verification. The browser connects directly to `wss://vps.nicolasmatter.ch:9001` with credentials entered at runtime.

| Topic | Publisher | Subscribers | Meaning |
| --- | --- | --- | --- |
| `wandlampe/config` | Web controller | Firmware and web controller | Full configuration, retained, published at QoS 1 by the web app |
| `wandlampe/status` | Firmware | Web controller | Retained device status; offline last will |

The firmware retries MQTT every ten minutes. The web client currently disables automatic reconnection.

## Configuration

The current model supports 1–8 modes and 48 LEDs. Mode order determines physical switch order. Brightness and RGB channels use integers from 0 through 255; alarm hours use 0–23 and minutes use 0–59. These are intended ranges, not a guarantee of strict validation by either parser.

```json
{
  "modes": [
    {"name": "Warm", "type": "single-color", "brightness": 128, "color": {"r": 255, "g": 180, "b": 60}},
    {"name": "Gradient", "type": "gradient", "brightness": 128, "from": {"r": 255, "g": 0, "b": 0}, "to": {"r": 0, "g": 0, "b": 255}},
    {"name": "Rainbow", "type": "animation", "brightness": 128, "animation": "rainbow"},
    {"name": "Wake up", "type": "alarm-clock", "brightness": 128, "hour": 7, "minute": 0, "color": {"r": 255, "g": 180, "b": 60}}
  ]
}
```

| Type | Additional fields |
| --- | --- |
| `static` | `leds`: 48 RGB objects in strip order; shorter arrays are padded with black |
| `single-color` | `color`: RGB object |
| `gradient` | `from`, `to`: RGB objects |
| `animation` | `animation`: a Lab animation object (see below); legacy: the name `rainbow`, `pulse`, or `breathe`, with `color` for pulse/breathe |
| `alarm-clock` | `hour`, `minute`, `color` |

`name` is web metadata, retained by the broker but ignored by the firmware. The web app always sends per-mode brightness. Both parsers also accept the legacy single-mode shape `{"brightness":128,"leds":[...]}` with 48 RGB entries. Firmware additionally supports top-level brightness as a fallback for entries in `modes`; the web modes parser does not.

### Embedded animations

An `animation` mode can carry a full Lab animation, the same JSON as the files in `animations/` (format in `web/src/animation/types.ts`, rationale in ADR 0001):

```json
{"name": "Rainbow", "type": "animation", "brightness": 128, "animation": {"version": 1, "name": "Rainbow", "loopMs": 6000, "layers": [...]}}
```

The whole config, animations included, must stay under 32 KB (the firmware's MQTT buffer). The firmware validates each embedded animation with the same rules as the Lab and rejects the config with a path-specific error on serial output, such as `modes[1].animation.layers[0].params.repeat must be an integer 1–16`. Generators and layer features not yet ported to the firmware are rejected as `not supported by this firmware yet`. Selecting the mode starts its animation from the beginning; brightness is applied on top.

Applying configuration stores it in the firmware's flash and keeps the active mode if it still exists; otherwise the lamp turns off. Reboot restores mode definitions, not the active mode. The switch activates modes; there is no remote mode-selection command.

## Device status

```json
{"status":"online","activeMode":0}
```

`activeMode` is a zero-based index; `-1` means off. Firmware publishes status on connection and mode changes. Its retained last will is `{"status":"offline"}`.

The web Apply action does not wait for a device acknowledgement. Receiving a configuration echo from the broker confirms neither device receipt nor rendering.

## Alarm and preview behavior

An alarm runs only while its mode is selected. The firmware uses Europe/Zurich time, pulses at the configured minute, and continues until dismissed with the switch or ten minutes have elapsed.

Web previews are approximate: brightness is not applied, rainbow spacing differs from FastLED, and alarm previews use browser-local time with a dim idle color. Firmware alarm output is off while waiting.

## Storage and editing

Firmware saves the configuration payload as a file on its flash FAT partition; the broker retains the published configuration; the browser saves edits in local storage. Any received configuration replaces the browser's current modes, including unpublished edits. There is no configuration version or conflict-resolution mechanism.
