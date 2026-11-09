#pragma once
// The lamp's modes, read from the retained wandlampe/config message
// (docs/mqtt.md). Pure: no Arduino or FastLED, so it is tested on the host.

#include <ArduinoJson.h>
#include <animation.h>
#include <animation_json.h>
#include <stdint.h>

#include "config.h"  // NUM_LEDS, MAX_MODES

struct LedRGB {
  uint8_t r, g, b;
};

enum ModeType : uint8_t {
  MODE_STATIC       = 0,
  MODE_SINGLE_COLOR = 1,
  MODE_GRADIENT     = 2,
  MODE_ANIMATION    = 3,
  MODE_ALARM_CLOCK  = 4,
};

struct LedMode {
  uint8_t type;
  uint8_t brightness;
  uint8_t alarmHour;
  uint8_t alarmMinute;
  LedRGB  color;
  LedRGB  from;
  LedRGB  to;
  LedRGB  leds[NUM_LEDS];
  // The lamp can't play this mode and shows it black; `problem` says why.
  bool skipped;
  anim::ParseError problem;
};

struct ModesConfig {
  uint8_t numModes;
  LedMode modes[MAX_MODES];
};

// Reads a whole config. Animation modes embed a Lab animation, which is
// validated but not kept: it is large, so the player re-reads the active one
// with parseModeAnimation(). A mode the lamp can't play is kept but marked
// `skipped`, so the others still apply. Fails only if the config has no modes.
bool parseModesConfig(JsonVariantConst doc, ModesConfig& cfg, anim::ParseError& error);

// Reads the animation embedded in mode `index` of a config accepted by parseModesConfig().
bool parseModeAnimation(JsonVariantConst doc, int index, anim::Animation& out, anim::ParseError& error);
