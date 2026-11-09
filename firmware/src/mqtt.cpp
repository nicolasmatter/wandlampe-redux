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

  anim::ParseError error;
  if (!ledsApplyConfigJson((const char*)payload, len, error)) {
    Serial.printf("MQTT: invalid config: %s\n", error.message);
    return;
  }
  Serial.println("MQTT: config applied");
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
