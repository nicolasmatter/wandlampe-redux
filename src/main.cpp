#include <Arduino.h>
#include "leds.h"
#include "connectivity.h"

void setup() {
  Serial.begin(115200);
  ledsSetup();
  connectivitySetup();
}

void loop() {
  connectivityHandle();
  ledsUpdate();
}
