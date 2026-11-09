#include "leds.h"
#include <Arduino.h>
#include <FastLED.h>
#include <time.h>
#include <animation.h>
#include "config.h"
#include "config_store.h"
#include "connectivity.h"
#include "psram_allocator.h"

static CRGB leds[NUM_LEDS];
static ModesConfig modesConfig;
static bool connected = false;
// The accepted config payload, kept to re-read the active mode's animation.
static char* configJson = nullptr;
static size_t configJsonLen = 0;

static anim::Animation activeAnimation;
static bool animationReady = false;
static bool animationStale = true;
static unsigned long animationStartMs = 0;
static unsigned long lastFrameMs = 0;
static const unsigned long FRAME_MS = 16;  // ~60 fps

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

static bool parseJson(const char* json, size_t len, JsonDocument& doc) {
  return deserializeJson(doc, json, len) == DeserializationError::Ok;
}

// Re-reads the active mode's embedded animation and restarts it from t=0.
static void loadActiveAnimation() {
  animationStale = false;
  animationReady = false;
  animationStartMs = millis();
  if (activeMode < 0 || (uint8_t)activeMode >= modesConfig.numModes) return;
  if (modesConfig.modes[activeMode].type != MODE_ANIMATION || !configJson) return;

  JsonDocument doc(PsramAllocator::instance());
  anim::ParseError error;
  if (!parseJson(configJson, configJsonLen, doc)) return;
  animationReady = parseModeAnimation(doc, activeMode, activeAnimation, error);
  if (!animationReady) Serial.printf("LEDs: %s\n", error.message);
}

static void setActiveMode(int mode) {
  if (mode == activeMode) return;
  activeMode = mode;
  modeChanged = true;
  animationStale = true;
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

static void renderEmbeddedAnimation() {
  if (!animationReady) {
    renderOff();
    return;
  }
  static anim::Rgb8 frame[NUM_LEDS];
  static uint32_t frames = 0, totalUs = 0, worstUs = 0;
  unsigned long now = millis();
  uint32_t start = micros();
  anim::render(activeAnimation, now - animationStartMs, now, frame, NUM_LEDS);
  uint32_t took = micros() - start;

  // Report the render cost every 10 s, to check the ~16 ms frame budget.
  totalUs += took;
  if (took > worstUs) worstUs = took;
  if (++frames == 600) {
    Serial.printf("LEDs: render avg %lu us, worst %lu us\n", (unsigned long)(totalUs / frames), (unsigned long)worstUs);
    frames = totalUs = worstUs = 0;
  }
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(frame[i].r, frame[i].g, frame[i].b);
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
    case MODE_ANIMATION:    renderEmbeddedAnimation(); break;
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

  configStoreSetup();
  size_t len = 0;
  char* stored = configStoreLoad(&len);
  if (stored) {
    anim::ParseError error;
    if (ledsApplyConfigJson(stored, len, error)) {
      Serial.printf("LEDs: restored %u mode(s) from flash\n", modesConfig.numModes);
    } else {
      Serial.printf("LEDs: stored config rejected: %s\n", error.message);
    }
    free(stored);
  }
}

static void applyConfig(const ModesConfig& cfg) {
  int previousMode = activeMode;
  modesConfig = cfg;
  if (modesConfig.numModes > MAX_MODES) modesConfig.numModes = MAX_MODES;
  alarmRinging = false;
  alarmDismissedYday = -1;

  // Keep showing whatever mode was already active (now with its updated
  // definition) instead of always blanking on every config push, so pushing
  // a new color doesn't require the physical switch to turn back on.
  if (previousMode >= 0 && (uint8_t)previousMode < modesConfig.numModes) {
    activeMode = previousMode;
    cycleIndex = previousMode * 2 + 1;
  } else {
    cycleIndex = 0;
    setActiveMode(-1);
  }
  animationStale = true;
}

bool ledsApplyConfigJson(const char* json, size_t len, anim::ParseError& error) {
  JsonDocument doc(PsramAllocator::instance());
  if (!parseJson(json, len, doc)) {
    snprintf(error.message, sizeof(error.message), "config is not valid JSON");
    return false;
  }
  static ModesConfig cfg;
  if (!parseModesConfig(doc, cfg, error)) return false;

  bool unchanged = configJson && configJsonLen == len && memcmp(configJson, json, len) == 0;
  if (!unchanged) {
    char* copy = (char*)ps_malloc(len);
    if (!copy) {
      snprintf(error.message, sizeof(error.message), "config does not fit in memory");
      return false;
    }
    memcpy(copy, json, len);
    free(configJson);
    configJson = copy;
    configJsonLen = len;
    if (!configStoreSave(json, len)) Serial.println("LEDs: could not store config in flash");
  }
  applyConfig(cfg);
  return true;
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
  if (animationStale) loadActiveAnimation();

  unsigned long now = millis();
  if (now - lastFrameMs < FRAME_MS) return;
  lastFrameMs = now;

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
