#pragma once
// Reads a Lab animation (JSON) into engine structures, applying the same rules
// as web/src/animation/format.ts. Reports the first problem with its path,
// e.g. "layers[1].params.repeat must be an integer 1–16".

#include <ArduinoJson.h>

#include "animation.h"

namespace anim {

struct ParseError {
  char message[112];
};

bool parseAnimation(JsonVariantConst json, Animation& out, ParseError& error);

}  // namespace anim
