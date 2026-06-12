#include "leds.h"
#include <Arduino.h>
#include <FastLED.h>
#include <Preferences.h>
#include "config.h"

static CRGB leds[NUM_LEDS];
static ModesConfig modesConfig;
static bool connected = false;
static Preferences prefs;

static int cycleIndex = 0;
static int activeMode = -1;
static bool modeChanged = false;
static bool lastSwitchState = HIGH;
static unsigned long lastDebounce = 0;

static void saveConfig() {
  prefs.begin("wl", false);
  prefs.putBytes("cfg", &modesConfig, sizeof(modesConfig));
  prefs.end();
}

static bool loadConfig() {
  prefs.begin("wl", true);
  bool ok = prefs.getBytesLength("cfg") == sizeof(modesConfig);
  if (ok) prefs.getBytes("cfg", &modesConfig, sizeof(modesConfig));
  prefs.end();
  return ok;
}

static void setActiveMode(int mode) {
  if (mode == activeMode) return;
  activeMode = mode;
  modeChanged = true;
}

static int modeFromCycleIndex() {
  if (modesConfig.numModes == 0) return -1;
  if (cycleIndex % 2 == 0) return -1;
  return cycleIndex / 2;
}

static void renderMode(const LedMode& mode) {
  FastLED.setBrightness(mode.brightness);
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGB(mode.leds[i].r, mode.leds[i].g, mode.leds[i].b);
  }
}

static void renderOff() {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
}

static void handleSwitch() {
  if (modesConfig.numModes == 0) return;

  bool current = digitalRead(SWITCH_PIN);
  if (current == lastSwitchState || millis() - lastDebounce <= DEBOUNCE_MS) return;

  lastDebounce = millis();
  lastSwitchState = current;
  cycleIndex = (cycleIndex + 1) % (2 * modesConfig.numModes);
  setActiveMode(modeFromCycleIndex());
  Serial.printf("LED mode -> %d\n", activeMode);
}

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

  if (loadConfig()) {
    Serial.printf("LEDs: restored %u mode(s) from NVS\n", modesConfig.numModes);
  }
}

void ledsApplyConfig(const ModesConfig& cfg) {
  modesConfig = cfg;
  if (modesConfig.numModes > MAX_MODES) modesConfig.numModes = MAX_MODES;
  cycleIndex = 0;
  setActiveMode(-1);
  saveConfig();
}

void ledsSetConnected(bool isConnected) {
  connected = isConnected;
}

int ledsGetActiveMode() {
  return activeMode;
}

bool ledsTakeModeChange(int* outMode) {
  if (!modeChanged) return false;
  modeChanged = false;
  if (outMode) *outMode = activeMode;
  return true;
}

void ledsUpdate() {
  handleSwitch();

  if (activeMode >= 0 && (uint8_t)activeMode < modesConfig.numModes) {
    renderMode(modesConfig.modes[activeMode]);
  } else {
    renderOff();
  }

  if (!connected) {
    uint8_t pulse = (uint8_t)(127.5f + 127.5f * sin(TWO_PI * millis() / STATUS_PULSE_PERIOD_MS));
    leds[0] = CRGB(pulse, pulse / 3, 0);
  }

  FastLED.show();
}
