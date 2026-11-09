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
bool ledsTakeModeChange(int* activeMode);
