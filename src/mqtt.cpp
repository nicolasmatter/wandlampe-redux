#include "mqtt.h"
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "secrets.h"
#include "leds.h"

static WiFiClientSecure tlsClient;
static PubSubClient mqttClient(tlsClient);
static unsigned long lastReconnectAttempt = 0;

static bool parseLedArray(JsonArray arr, LedMode& mode) {
  if (!arr || arr.size() < NUM_LEDS) return false;
  for (int i = 0; i < NUM_LEDS; i++) {
    mode.leds[i].r = arr[i]["r"] | 0;
    mode.leds[i].g = arr[i]["g"] | 0;
    mode.leds[i].b = arr[i]["b"] | 0;
  }
  return true;
}

static bool parseConfig(JsonDocument& doc, ModesConfig& cfg) {
  cfg.numModes = 0;

  JsonArray modesArr = doc["modes"].as<JsonArray>();
  if (modesArr) {
    for (JsonObject modeObj : modesArr) {
      if (cfg.numModes >= MAX_MODES) break;
      LedMode& mode = cfg.modes[cfg.numModes];
      mode.brightness = modeObj["brightness"] | doc["brightness"] | 255;
      if (!parseLedArray(modeObj["leds"].as<JsonArray>(), mode)) return false;
      cfg.numModes++;
    }
    return cfg.numModes > 0;
  }

  JsonArray ledsArr = doc["leds"].as<JsonArray>();
  if (!ledsArr) return false;

  LedMode& mode = cfg.modes[0];
  mode.brightness = doc["brightness"] | 255;
  if (!parseLedArray(ledsArr, mode)) return false;
  cfg.numModes = 1;
  return true;
}

static void publishStatus(bool online) {
  JsonDocument doc;
  doc["status"] = online ? "online" : "offline";
  if (online) doc["activeMode"] = ledsGetActiveMode();

  char buf[64];
  serializeJson(doc, buf, sizeof(buf));
  mqttClient.publish(MQTT_TOPIC_STATUS, buf, true);
}

static void onMessage(char* topic, byte* payload, unsigned int len) {
  if (strcmp(topic, MQTT_TOPIC_CONFIG) != 0) return;

  JsonDocument doc;
  if (deserializeJson(doc, payload, len) != DeserializationError::Ok) {
    Serial.println("MQTT: JSON parse error");
    return;
  }

  ModesConfig cfg;
  if (!parseConfig(doc, cfg)) {
    Serial.println("MQTT: invalid config");
    return;
  }

  ledsApplyConfig(cfg);
  Serial.printf("MQTT: applied %u mode(s)\n", cfg.numModes);
}

static bool connect() {
  tlsClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMessage);
  mqttClient.setBufferSize(MQTT_BUFFER_SIZE);

  Serial.printf("MQTT: connecting to %s:%d...\n", MQTT_BROKER, MQTT_PORT);

  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD,
                          MQTT_TOPIC_STATUS, 1, true, "{\"status\":\"offline\"}")) {
    publishStatus(true);
    mqttClient.subscribe(MQTT_TOPIC_CONFIG, 1);
    Serial.println("MQTT: connected");
    return true;
  }

  Serial.printf("MQTT: failed, rc=%d\n", mqttClient.state());
  return false;
}

void mqttSetup() {
  lastReconnectAttempt = 0;
}

void mqttHandle() {
  if (mqttClient.connected()) {
    mqttClient.loop();

    int activeMode;
    if (ledsTakeModeChange(&activeMode)) {
      publishStatus(true);
      Serial.printf("MQTT: activeMode -> %d\n", activeMode);
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS || lastReconnectAttempt == 0) {
    lastReconnectAttempt = now;
    connect();
  }
}

bool mqttConnected() {
  return mqttClient.connected();
}
