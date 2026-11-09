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
  delay(1);  // let lower-priority tasks run; the LEDs render in their own task
}
