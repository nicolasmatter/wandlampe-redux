#pragma once
#include <stddef.h>
#include <lamp_config.h>

void ledsSetup();
void ledsUpdate();
// Parses, applies and stores a wandlampe/config payload. On failure the current
// config stays and `error` says why.
bool ledsApplyConfigJson(const char* json, size_t len, anim::ParseError& error);
void ledsSetConnected(bool connected);

int ledsGetActiveMode();
int ledsModeCount();
// Why mode `index` is skipped (shown black), or nullptr if it plays.
const char* ledsModeProblem(int index);
// Why the last received config was rejected, or nullptr if it was accepted.
const char* ledsConfigError();
bool ledsTakeModeChange(int* activeMode);
