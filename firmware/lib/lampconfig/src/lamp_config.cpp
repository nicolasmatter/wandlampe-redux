#include "lamp_config.h"

#include <stdio.h>
#include <string.h>

namespace {

void setError(anim::ParseError& error, const char* message) {
  snprintf(error.message, sizeof(error.message), "%s", message);
}

bool parseColor(JsonObjectConst obj, LedRGB& color) {
  if (obj.isNull()) return false;
  color.r = obj["r"] | 0;
  color.g = obj["g"] | 0;
  color.b = obj["b"] | 0;
  return true;
}

// Shorter arrays (from configs saved for fewer LEDs) are padded with black.
bool parseLedArray(JsonArrayConst arr, LedMode& mode) {
  if (arr.isNull()) return false;
  for (int i = 0; i < NUM_LEDS; i++) {
    mode.leds[i].r = arr[i]["r"] | 0;
    mode.leds[i].g = arr[i]["g"] | 0;
    mode.leds[i].b = arr[i]["b"] | 0;
  }
  return true;
}

uint8_t parseModeType(const char* typeStr) {
  if (strcmp(typeStr, "single-color") == 0) return MODE_SINGLE_COLOR;
  if (strcmp(typeStr, "gradient") == 0)     return MODE_GRADIENT;
  if (strcmp(typeStr, "animation") == 0)    return MODE_ANIMATION;
  if (strcmp(typeStr, "alarm-clock") == 0)  return MODE_ALARM_CLOCK;
  return MODE_STATIC;
}

uint8_t parseAnimationId(const char* animStr) {
  if (strcmp(animStr, "pulse") == 0)   return ANIM_PULSE;
  if (strcmp(animStr, "breathe") == 0) return ANIM_BREATHE;
  return ANIM_RAINBOW;
}

// Validates an embedded animation; its errors get the mode's path in front.
bool checkEmbeddedAnimation(JsonVariantConst json, int index, anim::ParseError& error) {
  static anim::Animation scratch;  // large once keyframes are ported; keep it off the stack
  return parseModeAnimation(json, index, scratch, error);
}

bool parseModeObject(JsonObjectConst modeObj, JsonVariantConst doc, int index, LedMode& mode,
                     anim::ParseError& error) {
  const char* typeStr = modeObj["type"] | "static";
  mode.type = parseModeType(typeStr);
  mode.brightness = modeObj["brightness"] | doc["brightness"] | 255;
  mode.animation = ANIM_RAINBOW;
  mode.embeddedAnimation = false;
  mode.color = {255, 255, 255};
  mode.from = {0, 0, 0};
  mode.to = {255, 255, 255};

  char path[24];
  snprintf(path, sizeof(path), "modes[%d]", index);

  switch (mode.type) {
    case MODE_SINGLE_COLOR:
      if (parseColor(modeObj["color"].as<JsonObjectConst>(), mode.color)) return true;
      snprintf(error.message, sizeof(error.message), "%s.color must be an RGB object", path);
      return false;
    case MODE_GRADIENT:
      if (parseColor(modeObj["from"].as<JsonObjectConst>(), mode.from) &&
          parseColor(modeObj["to"].as<JsonObjectConst>(), mode.to)) {
        return true;
      }
      snprintf(error.message, sizeof(error.message), "%s.from and .to must be RGB objects", path);
      return false;
    case MODE_ANIMATION: {
      JsonVariantConst animation = modeObj["animation"];
      if (animation.is<JsonObjectConst>()) {
        mode.embeddedAnimation = true;
        return checkEmbeddedAnimation(doc, index, error);
      }
      mode.animation = parseAnimationId(animation | "rainbow");
      if (mode.animation != ANIM_RAINBOW) {
        parseColor(modeObj["color"].as<JsonObjectConst>(), mode.color);
      }
      return true;
    }
    case MODE_ALARM_CLOCK:
      mode.alarmHour = modeObj["hour"] | 7;
      mode.alarmMinute = modeObj["minute"] | 0;
      if (!parseColor(modeObj["color"].as<JsonObjectConst>(), mode.color)) {
        mode.color = {255, 180, 60};
      }
      return true;
    case MODE_STATIC:
    default:
      mode.type = MODE_STATIC;
      if (parseLedArray(modeObj["leds"].as<JsonArrayConst>(), mode)) return true;
      snprintf(error.message, sizeof(error.message), "%s.leds must be an array of RGB objects", path);
      return false;
  }
}

}  // namespace

bool parseModesConfig(JsonVariantConst doc, ModesConfig& cfg, anim::ParseError& error) {
  cfg.numModes = 0;
  error.message[0] = '\0';

  JsonArrayConst modesArr = doc["modes"].as<JsonArrayConst>();
  if (!modesArr.isNull()) {
    for (JsonVariantConst modeObj : modesArr) {
      if (cfg.numModes >= MAX_MODES) break;
      if (!parseModeObject(modeObj.as<JsonObjectConst>(), doc, cfg.numModes, cfg.modes[cfg.numModes], error)) {
        return false;
      }
      cfg.numModes++;
    }
    if (cfg.numModes == 0) setError(error, "modes must not be empty");
    return cfg.numModes > 0;
  }

  // Legacy single-mode shape: {"brightness":128,"leds":[...]}
  JsonArrayConst ledsArr = doc["leds"].as<JsonArrayConst>();
  if (ledsArr.isNull()) {
    setError(error, "config must have \"modes\" or \"leds\"");
    return false;
  }
  LedMode& mode = cfg.modes[0];
  mode = {};
  mode.type = MODE_STATIC;
  mode.brightness = doc["brightness"] | 255;
  parseLedArray(ledsArr, mode);
  cfg.numModes = 1;
  return true;
}

bool parseModeAnimation(JsonVariantConst doc, int index, anim::Animation& out, anim::ParseError& error) {
  JsonVariantConst json = doc["modes"][index]["animation"];
  if (anim::parseAnimation(json, out, error)) return true;
  char inner[sizeof(error.message)];
  memcpy(inner, error.message, sizeof(inner));
  // The animation parser names fields from the animation's root ("layers[0]..."), or "animation" itself.
  if (strncmp(inner, "animation ", 10) == 0) {
    snprintf(error.message, sizeof(error.message), "modes[%d].%s", index, inner);
  } else {
    snprintf(error.message, sizeof(error.message), "modes[%d].animation.%s", index, inner);
  }
  return false;
}
