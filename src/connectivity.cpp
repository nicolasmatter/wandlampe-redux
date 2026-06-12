#include "connectivity.h"
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoOTA.h>
#include <time.h>
#include "config.h"
#include "secrets.h"

static bool startNtp() {
  configTime(0, 0, NTP_SERVER);
  setenv("TZ", TZ_INFO, 1);
  tzset();

  struct tm t;
  for (int i = 0; i < 20; i++) {
    if (getLocalTime(&t, 1000) && t.tm_year >= (2024 - 1900)) {
      Serial.printf("Time synced: %04d-%02d-%02d %02d:%02d:%02d\n",
                    t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                    t.tm_hour, t.tm_min, t.tm_sec);
      return true;
    }
    delay(500);
  }

  Serial.println("NTP sync failed");
  return false;
}

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
    startNtp();
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

bool connectivityGetLocalTime(struct tm* out) {
  if (!out || WiFi.status() != WL_CONNECTED) return false;
  return getLocalTime(out, 50);
}
