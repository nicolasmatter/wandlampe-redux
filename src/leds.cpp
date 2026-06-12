#include "leds.h"
#include <Arduino.h>
#include <FastLED.h>
#include <Preferences.h>
#include <time.h>
#include "config.h"
#include "connectivity.h"

static CRGB leds[NUM_LEDS];
static ModesConfig modesConfig;
static bool connected = false;
static Preferences prefs;

static int cycleIndex = 0;
static int activeMode = -1;
static bool modeChanged = false;
static bool lastSwitchState = HIGH;
static unsigned long lastDebounce = 0;

static bool alarmRinging = false;
static unsigned long alarmRingStartMs = 0;
static int alarmDismissedYday = -1;
static int prevActiveMode = -2;

static CRGB toCrgb(const LedRGB& c) {
  return CRGB(c.r, c.g, c.b);
}

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

static void renderStatic(const LedMode& mode) {
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = toCrgb(mode.leds[i]);
  }
}

static void renderSingleColor(const LedMode& mode) {
  fill_solid(leds, NUM_LEDS, toCrgb(mode.color));
}

static void renderGradient(const LedMode& mode) {
  CRGB from = toCrgb(mode.from);
  CRGB to = toCrgb(mode.to);
  for (int i = 0; i < NUM_LEDS; i++) {
    uint8_t blendAmt = NUM_LEDS <= 1 ? 0 : map(i, 0, NUM_LEDS - 1, 0, 255);
    leds[i] = blend(from, to, blendAmt);
  }
}

static void renderOff() {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
}

static void renderAnimation(const LedMode& mode) {
  switch (mode.animation) {
    case ANIM_RAINBOW:
      fill_rainbow(leds, NUM_LEDS, (millis() / 20) % 256, 7);
      break;
    case ANIM_PULSE: {
      CRGB c = toCrgb(mode.color);
      uint8_t scale = (uint8_t)(127.5f + 127.5f * sin(TWO_PI * millis() / 1000.0f));
      fill_solid(leds, NUM_LEDS, c.nscale8(scale));
      break;
    }
    case ANIM_BREATHE: {
      CRGB c = toCrgb(mode.color);
      uint8_t scale = (uint8_t)(127.5f + 127.5f * sin(TWO_PI * millis() / 3000.0f));
      fill_solid(leds, NUM_LEDS, c.nscale8(scale));
      break;
    }
    default:
      fill_solid(leds, NUM_LEDS, CRGB::Black);
      break;
  }
}

static void renderAlarmClock(const LedMode& mode) {
  struct tm now;
  if (!connectivityGetLocalTime(&now)) {
    renderOff();
    return;
  }

  int yday = now.tm_yday;
  if (alarmDismissedYday >= 0 && alarmDismissedYday != yday) {
    alarmDismissedYday = -1;
  }

  bool due = (uint8_t)now.tm_hour == mode.alarmHour && (uint8_t)now.tm_min == mode.alarmMinute;

  if (due && alarmDismissedYday != yday) {
    if (!alarmRinging) alarmRingStartMs = millis();
    alarmRinging = true;
  }

  if (alarmRinging && alarmDismissedYday != yday) {
    if (millis() - alarmRingStartMs > ALARM_MAX_RING_MS) {
      alarmRinging = false;
      alarmDismissedYday = yday;
      renderOff();
      return;
    }
    CRGB c = toCrgb(mode.color);
    uint8_t scale = (uint8_t)(127.5f + 127.5f * sin(TWO_PI * millis() / 500.0f));
    fill_solid(leds, NUM_LEDS, c.nscale8(scale));
    return;
  }

  alarmRinging = false;
  renderOff();
}

static void dismissAlarmIfLeaving(int fromMode) {
  if (fromMode < 0 || (uint8_t)fromMode >= modesConfig.numModes) return;
  if (modesConfig.modes[fromMode].type != MODE_ALARM_CLOCK) return;
  if (!alarmRinging) return;

  struct tm now;
  if (connectivityGetLocalTime(&now)) {
    alarmDismissedYday = now.tm_yday;
  }
  alarmRinging = false;
}

static void renderMode(const LedMode& mode) {
  FastLED.setBrightness(mode.brightness);
  switch (mode.type) {
    case MODE_SINGLE_COLOR: renderSingleColor(mode); break;
    case MODE_GRADIENT:     renderGradient(mode);    break;
    case MODE_ANIMATION:    renderAnimation(mode);   break;
    case MODE_ALARM_CLOCK:  renderAlarmClock(mode); break;
    case MODE_STATIC:
    default:                renderStatic(mode);      break;
  }
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
  alarmRinging = false;
  alarmDismissedYday = -1;
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

  if (prevActiveMode != activeMode) {
    dismissAlarmIfLeaving(prevActiveMode);
    prevActiveMode = activeMode;
  }

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
