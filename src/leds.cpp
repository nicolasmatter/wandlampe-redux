#include "leds.h"
#include <Arduino.h>
#include <FastLED.h>
#include "config.h"

static CRGB leds[NUM_LEDS];

static const int states[] = {0, 1, 0, 2};
static int stateIndex = 0;
static bool lastSwitchState = HIGH;
static unsigned long lastDebounce = 0;

static void runBootTest() {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB::Green;
    FastLED.show();
    delay(30);
  }

  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();
  delay(200);

  for (int hue = 0; hue < 256; hue += 4) {
    fill_rainbow(leds, NUM_LEDS, hue, 7);
    FastLED.show();
    delay(10);
  }

  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();
}

void ledsSetup() {
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  lastSwitchState = digitalRead(SWITCH_PIN);
  runBootTest();
}

void ledsUpdate() {
  bool current = digitalRead(SWITCH_PIN);
  if (current != lastSwitchState && millis() - lastDebounce > DEBOUNCE_MS) {
    lastDebounce = millis();
    lastSwitchState = current;
    stateIndex = (stateIndex + 1) % 4;
    Serial.printf("LED state -> %d\n", states[stateIndex]);
  }

  switch (states[stateIndex]) {
    case 0: fill_solid(leds, NUM_LEDS, CRGB::Black); break;
    case 1: fill_solid(leds, NUM_LEDS, CRGB::White); break;
    case 2: fill_solid(leds, NUM_LEDS, CRGB::Blue);  break;
  }

  FastLED.show();
}
