#pragma once
#include <stdint.h>

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

enum AnimationId : uint8_t {
  ANIM_RAINBOW = 0,
  ANIM_PULSE   = 1,
  ANIM_BREATHE = 2,
};

struct LedMode {
  uint8_t type;
  uint8_t brightness;
  uint8_t animation;
  uint8_t alarmHour;
  uint8_t alarmMinute;
  LedRGB  color;
  LedRGB  from;
  LedRGB  to;
  LedRGB  leds[24];
};

#define MAX_MODES 8

struct ModesConfig {
  uint8_t numModes;
  LedMode modes[MAX_MODES];
};

void ledsSetup();
void ledsUpdate();
void ledsApplyConfig(const ModesConfig& cfg);
void ledsSetConnected(bool connected);

int ledsGetActiveMode();
bool ledsTakeModeChange(int* activeMode);
