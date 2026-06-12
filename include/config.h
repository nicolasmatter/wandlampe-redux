#pragma once

#define LED_PIN      6
#define SWITCH_PIN   4
#define NUM_LEDS     24
#define BRIGHTNESS   128
#define DEBOUNCE_MS  50

#define OTA_HOSTNAME "wandlampe"

#define MQTT_BROKER       "vps.nicolasmatter.ch"
#define MQTT_PORT         8883
#define MQTT_CLIENT_ID    "wandlampe-esp32"
#define MQTT_TOPIC_CONFIG "wandlampe/config"
#define MQTT_TOPIC_STATUS "wandlampe/status"

#define MAX_MODES                  8
#define MQTT_BUFFER_SIZE           4096
#define MQTT_RECONNECT_INTERVAL_MS 600000UL
#define STATUS_PULSE_PERIOD_MS     2000
