#include "connectivity.h"
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoOTA.h>
#include "config.h"
#include "secrets.h"

void connectivitySetup() {
  Serial.printf("Connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Connected, IP: %s\n", WiFi.localIP().toString().c_str());
    ArduinoOTA.setHostname(OTA_HOSTNAME);
    ArduinoOTA.onStart([]()              { Serial.println("OTA: start");             });
    ArduinoOTA.onEnd([]()                { Serial.println("OTA: done");              });
    ArduinoOTA.onError([](ota_error_t e) { Serial.printf("OTA error: %u\n", e);     });
    ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
      Serial.printf("OTA: %u%%\r", (done * 100) / total);
    });
    ArduinoOTA.begin();
    Serial.printf("OTA ready on %s.local\n", OTA_HOSTNAME);
  } else {
    Serial.println("WiFi failed, continuing without network.");
    WiFi.disconnect(true);
  }
}

void connectivityHandle() {
  if (WiFi.status() == WL_CONNECTED) {
    ArduinoOTA.handle();
  }
}
