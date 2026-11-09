#pragma once
#include <stddef.h>
#include <lamp_config.h>

// Starts the LEDs and a render task that runs ahead of Wi-Fi and MQTT work.
void ledsSetup();
// Parses, applies and stores a wandlampe/config payload. On failure the current
// config stays and `error` says why.
bool ledsApplyConfigJson(const char* json, size_t len, anim::ParseError& error);
void ledsSetConnected(bool connected);

struct LedsStatus {
  int activeMode;  // -1 when off
  int modeCount;
  // Why each mode is skipped (shown black); empty if it plays.
  anim::ParseError problems[MAX_MODES];
  // Why the last received config was rejected; empty if it was accepted.
  anim::ParseError configError;
};

// A consistent copy of what the lamp shows, for the status topic.
void ledsGetStatus(LedsStatus& out);
bool ledsTakeModeChange(int* activeMode);
