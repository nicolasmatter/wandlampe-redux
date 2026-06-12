#include <Arduino.h>
#include "leds.h"
#include "connectivity.h"
#include "mqtt.h"

void setup() {
  Serial.begin(115200);
  ledsSetup();
  connectivitySetup();
  mqttSetup();
}

void loop() {
  connectivityHandle();
  mqttHandle();
  ledsSetConnected(mqttConnected());
  ledsUpdate();
}
