# Broker Changes Plan — VPS Mosquitto

## Context

Self-hosted Mosquitto on `vps.nicolasmatter.ch`. Current setup:

| Port | Protocol | Used by |
|---|---|---|
| 8883 | MQTTS (TLS TCP) | Pi firmware (`pi_user`), Fastify API (`web_user`) |
| 9001 | WSS (WebSocket Secure) | Angular frontend (direct, legacy) |

The Fastify API (`RPI-Controller-API`) runs on the VPS, connects to Mosquitto as `web_user` over port 8883, and acts as an authenticated WebSocket proxy for the React frontend. The Angular app connects directly to Mosquitto WSS on port 9001 (current, legacy path).

The wandlampe web UI will also connect directly to Mosquitto WSS on port 9001, using a dedicated `wandlampe_web` user — same pattern as the Angular app.

---

## Phase 1 — New MQTT users ✓

Add two new users via `mosquitto_passwd`:

| User | Used by | Transport |
|---|---|---|
| `wandlampe_device` | ESP32 firmware | MQTTS port 8883 |
| `wandlampe_web` | Wandlampe web UI | WSS port 9001 |

```bash
sudo mosquitto_passwd /etc/mosquitto/passwd wandlampe_device
sudo mosquitto_passwd /etc/mosquitto/passwd wandlampe_web
```

## Phase 2 — ACL rules ✓

Add entries to the Mosquitto ACL file (e.g. `/etc/mosquitto/acl`):

```
# wandlampe_device — ESP32 firmware
user wandlampe_device
topic read wandlampe/config
topic write wandlampe/status

# wandlampe_web — browser UI (direct WSS)
user wandlampe_web
topic write wandlampe/config
topic read wandlampe/status
```

> If no ACL file is configured yet, add `acl_file /etc/mosquitto/acl` to `mosquitto.conf`.
> Existing users (`pi_user`, `web_user`) need their own ACL entries if not already present.

## Phase 3 — Reload and verify ✓

```bash
sudo systemctl reload mosquitto
```

Verify with `mosquitto_sub` / `mosquitto_pub` from a dev machine:

```bash
# Device user can subscribe to config
mosquitto_sub -h vps.nicolasmatter.ch -p 8883 --capath /etc/ssl/certs \
  -u wandlampe_device -P <password> -t wandlampe/config

# Web user can publish config
mosquitto_pub -h vps.nicolasmatter.ch -p 8883 --capath /etc/ssl/certs \
  -u wandlampe_web -P <password> -t wandlampe/config -r \
  -m '{"brightness":255,"leds":[{"r":255,"g":0,"b":0}]}'

# Existing pi_user still works (regression check)
mosquitto_sub -h vps.nicolasmatter.ch -p 8883 --capath /etc/ssl/certs \
  -u pi_user -P <password> -t led-controller/led-controller-1/status
```

## Notes

- WSS port 9001 is already open and working — no nginx or firewall changes needed
- MQTTS port 8883 is already open — no changes needed for the ESP32
- The Fastify API (`web_user`) and Pi firmware (`pi_user`) are untouched
- The wandlampe topics (`wandlampe/#`) are entirely separate from `led-controller/#`
