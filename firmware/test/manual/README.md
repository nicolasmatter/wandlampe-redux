# Manual lamp checks

`embedded-rainbow.json` is a config with a single-color mode and the committed rainbow embedded as an animation mode. Publishing it **replaces the lamp's retained config**; save the current one first:

```sh
mosquitto_sub -h vps.nicolasmatter.ch -p 8883 -u wandlampe_web -P '<password>' -t wandlampe/config -C 1 -W 5 > previous-config.json
mosquitto_pub -h vps.nicolasmatter.ch -p 8883 -u wandlampe_web -P '<password>' -t wandlampe/config -r -q 1 -f firmware/test/manual/embedded-rainbow.json
```

Use a broker user allowed to publish `wandlampe/config` on the TLS port (the web user is configured for WSS on 9001; adjust if the ACL or listener differs). Flip the switch to the second mode: the rainbow should scroll counterclockwise, one turn per 6 s, starting from red at the bottom. Republish `previous-config.json` to restore.
