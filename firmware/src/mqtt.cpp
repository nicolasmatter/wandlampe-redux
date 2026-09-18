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

static bool parseColor(JsonObject obj, LedRGB& color) {
  if (obj.isNull()) return false;
  color.r = obj["r"] | 0;
  color.g = obj["g"] | 0;
  color.b = obj["b"] | 0;
  return true;
}

static bool parseLedArray(JsonArray arr, LedMode& mode) {
  if (!arr || arr.size() < NUM_LEDS) return false;
  for (int i = 0; i < NUM_LEDS; i++) {
    mode.leds[i].r = arr[i]["r"] | 0;
    mode.leds[i].g = arr[i]["g"] | 0;
    mode.leds[i].b = arr[i]["b"] | 0;
  }
  return true;
}

static uint8_t parseModeType(const char* typeStr) {
  if (strcmp(typeStr, "single-color") == 0) return MODE_SINGLE_COLOR;
  if (strcmp(typeStr, "gradient") == 0)     return MODE_GRADIENT;
  if (strcmp(typeStr, "animation") == 0)    return MODE_ANIMATION;
  if (strcmp(typeStr, "alarm-clock") == 0)  return MODE_ALARM_CLOCK;
  return MODE_STATIC;
}

static uint8_t parseAnimation(const char* animStr) {
  if (strcmp(animStr, "pulse") == 0)   return ANIM_PULSE;
  if (strcmp(animStr, "breathe") == 0) return ANIM_BREATHE;
  return ANIM_RAINBOW;
}

static bool parseModeObject(JsonObject modeObj, JsonDocument& doc, LedMode& mode) {
  const char* typeStr = modeObj["type"] | "static";
  mode.type = parseModeType(typeStr);
  mode.brightness = modeObj["brightness"] | doc["brightness"] | 255;
  mode.animation = ANIM_RAINBOW;
  mode.color = {255, 255, 255};
  mode.from = {0, 0, 0};
  mode.to = {255, 255, 255};

  switch (mode.type) {
    case MODE_SINGLE_COLOR:
      return parseColor(modeObj["color"].as<JsonObject>(), mode.color);
    case MODE_GRADIENT:
      return parseColor(modeObj["from"].as<JsonObject>(), mode.from)
          && parseColor(modeObj["to"].as<JsonObject>(), mode.to);
    case MODE_ANIMATION: {
      const char* animStr = modeObj["animation"] | "rainbow";
      mode.animation = parseAnimation(animStr);
      if (mode.animation != ANIM_RAINBOW) {
        parseColor(modeObj["color"].as<JsonObject>(), mode.color);
      }
      return true;
    }
    case MODE_ALARM_CLOCK:
      mode.alarmHour = modeObj["hour"] | 7;
      mode.alarmMinute = modeObj["minute"] | 0;
      if (!parseColor(modeObj["color"].as<JsonObject>(), mode.color)) {
        mode.color = {255, 180, 60};
      }
      return true;
    case MODE_STATIC:
    default:
      mode.type = MODE_STATIC;
      return parseLedArray(modeObj["leds"].as<JsonArray>(), mode);
  }
}

static bool parseConfig(JsonDocument& doc, ModesConfig& cfg) {
  cfg.numModes = 0;

  JsonArray modesArr = doc["modes"].as<JsonArray>();
  if (modesArr) {
    for (JsonObject modeObj : modesArr) {
      if (cfg.numModes >= MAX_MODES) break;
      if (!parseModeObject(modeObj, doc, cfg.modes[cfg.numModes])) return false;
      cfg.numModes++;
    }
    return cfg.numModes > 0;
  }

  JsonArray ledsArr = doc["leds"].as<JsonArray>();
  if (!ledsArr) return false;

  LedMode& mode = cfg.modes[0];
  mode.type = MODE_STATIC;
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
