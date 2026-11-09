export const BROKER_URL = 'wss://vps.nicolasmatter.ch:9001'
export const TOPIC_CONFIG = 'wandlampe/config'
export const TOPIC_STATUS = 'wandlampe/status'
export const LED_COUNT = 48
export const MAX_MODES = 8
/** Largest config payload the lamp accepts: its 32 KB MQTT buffer minus packet header and topic. */
export const MAX_CONFIG_BYTES = 32 * 1024 - 64
export const LAB_DEFAULT_LED_COUNT = 48
