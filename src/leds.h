#pragma once
#include <stdint.h>

struct LedRGB {
  uint8_t r, g, b;
};

struct LedMode {
  uint8_t brightness;
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

// -1 = off, 0+ = active mode index
int ledsGetActiveMode();

// Returns true once when the active mode changes (consumes the flag).
bool ledsTakeModeChange(int* activeMode);
