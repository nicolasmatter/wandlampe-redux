#include "animation_json.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

namespace anim {

namespace {

// Builds error messages and paths; every check returns false after fail().
struct Ctx {
  ParseError& error;

  bool fail(const char* path, const char* fmt, ...) {
    int n = snprintf(error.message, sizeof(error.message), "%s ", path);
    if (n < 0 || n >= (int)sizeof(error.message)) return false;
    va_list args;
    va_start(args, fmt);
    vsnprintf(error.message + n, sizeof(error.message) - n, fmt, args);
    va_end(args);
    return false;
  }
};

struct Path {
  char text[64];
  Path(const char* base, const char* field) { snprintf(text, sizeof(text), "%s.%s", base, field); }
  Path(const char* base, int index) { snprintf(text, sizeof(text), "%s[%d]", base, index); }
  operator const char*() const { return text; }
};

bool readNumber(Ctx& c, JsonVariantConst v, const char* path, float min, float max, float& out) {
  if (!v.is<float>() || v.as<float>() < min || v.as<float>() > max) {
    return c.fail(path, "must be a number %g–%g", min, max);
  }
  out = v.as<float>();
  return true;
}

bool readInt(Ctx& c, JsonVariantConst v, const char* path, long min, long max, long& out) {
  if (!v.is<long>() || v.as<long>() < min || v.as<long>() > max) {
    return c.fail(path, "must be an integer %ld–%ld", min, max);
  }
  out = v.as<long>();
  return true;
}

bool readBool(Ctx& c, JsonVariantConst v, const char* path, bool& out) {
  if (!v.is<bool>()) return c.fail(path, "must be one of true, false");
  out = v.as<bool>();
  return true;
}

bool readColor(Ctx& c, JsonVariantConst v, const char* path, Color& out) {
  long r, g, b;
  JsonObjectConst o = v.as<JsonObjectConst>();
  bool ok = !o.isNull() && o["r"].is<long>() && o["g"].is<long>() && o["b"].is<long>();
  if (ok) {
    r = o["r"], g = o["g"], b = o["b"];
    ok = r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
  }
  if (!ok) return c.fail(path, "must be {r,g,b} with integers 0–255");
  out = {(float)r, (float)g, (float)b};
  return true;
}

bool readPalette(Ctx& c, JsonVariantConst v, const char* path, Color* colors, uint8_t& count) {
  JsonArrayConst a = v.as<JsonArrayConst>();
  if (a.isNull() || a.size() < kMinPaletteColors || a.size() > kMaxPaletteColors) {
    return c.fail(path, "must hold %d–%d colors", kMinPaletteColors, kMaxPaletteColors);
  }
  count = 0;
  for (JsonVariantConst color : a) {
    if (!readColor(c, color, Path(path, count), colors[count])) return false;
    count++;
  }
  return true;
}

bool readEdge(Ctx& c, JsonVariantConst v, const char* path, Edge& out) {
  if (v == "smooth") out = Edge::Smooth;
  else if (v == "hard") out = Edge::Hard;
  else return c.fail(path, "must be one of \"smooth\", \"hard\"");
  return true;
}

bool readSolid(Ctx& c, JsonObjectConst p, const char* path, SolidParams& out) {
  return readColor(c, p["color"], Path(path, "color"), out.color);
}

bool readBands(Ctx& c, JsonObjectConst p, const char* path, BandsParams& out) {
  long repeat;
  if (!readPalette(c, p["colors"], Path(path, "colors"), out.colors, out.colorCount)) return false;
  if (!readEdge(c, p["edge"], Path(path, "edge"), out.edge)) return false;
  if (!readInt(c, p["repeat"], Path(path, "repeat"), 1, 16, repeat)) return false;
  JsonVariantConst scroll = p["scroll"];
  if (!scroll.is<long>() || scroll.as<long>() < -1 || scroll.as<long>() > 1) {
    return c.fail(Path(path, "scroll"), "must be one of 1, 0, -1");
  }
  out.repeat = (uint8_t)repeat;
  out.scroll = (int8_t)scroll.as<long>();
  return true;
}

bool readGenerator(Ctx& c, JsonObjectConst v, const char* path, Layer& layer) {
  Path genPath(path, "generator");
  const char* name = v["generator"] | "";
  JsonObjectConst params = v["params"].as<JsonObjectConst>();
  Path paramsPath(path, "params");

  if (strcmp(name, "solid") == 0) layer.generator = Generator::Solid;
  else if (strcmp(name, "bands") == 0) layer.generator = Generator::Bands;
  else if (!strcmp(name, "pulse") || !strcmp(name, "chase") || !strcmp(name, "sparkle") || !strcmp(name, "noise") ||
           !strcmp(name, "strike") || !strcmp(name, "drops") || !strcmp(name, "ripple")) {
    return c.fail(genPath, "\"%s\" is not supported by this firmware yet", name);
  } else {
    return c.fail(genPath, "\"%s\" is unknown", name);
  }
  if (params.isNull()) return c.fail(paramsPath, "must be an object");

  switch (layer.generator) {
    case Generator::Solid:
      return readSolid(c, params, paramsPath, layer.solid);
    case Generator::Bands:
      return readBands(c, params, paramsPath, layer.bands);
  }
  return false;
}

bool readLayer(Ctx& c, JsonVariantConst json, const char* path, Layer& layer) {
  JsonObjectConst v = json.as<JsonObjectConst>();
  if (v.isNull()) return c.fail(path, "must be an object");

  JsonVariantConst blend = v["blend"];
  if (blend == "normal") layer.blend = Blend::Normal;
  else if (blend == "add") layer.blend = Blend::Add;
  else return c.fail(Path(path, "blend"), "must be one of \"normal\", \"add\"");

  if (!readNumber(c, v["opacity"], Path(path, "opacity"), 0, 1, layer.opacity)) return false;

  JsonVariantConst speed = v["speed"];
  float s = speed.is<float>() ? speed.as<float>() : 0;
  if (s != 0.5f && s != 1 && s != 2 && s != 4) return c.fail(Path(path, "speed"), "must be one of 0.5, 1, 2, 4");
  layer.speed = s;

  bool mirror;
  if (!readBool(c, v["hidden"], Path(path, "hidden"), layer.hidden)) return false;
  if (!readBool(c, v["mirror"], Path(path, "mirror"), mirror)) return false;
  if (mirror) return c.fail(Path(path, "mirror"), "is not supported by this firmware yet");
  if (!v["region"].isNull()) return c.fail(Path(path, "region"), "is not supported by this firmware yet");

  if (!v["keyframes"].isNull()) {
    if (!v["generator"].isNull()) return c.fail(path, "must have either \"generator\" or \"keyframes\", not both");
    return c.fail(Path(path, "keyframes"), "are not supported by this firmware yet");
  }
  return readGenerator(c, v, path, layer);
}

}  // namespace

bool parseAnimation(JsonVariantConst json, Animation& out, ParseError& error) {
  Ctx c{error};
  error.message[0] = '\0';
  JsonObjectConst v = json.as<JsonObjectConst>();
  if (v.isNull()) return c.fail("animation", "must be an object");

  if (!v["version"].is<long>() || v["version"].as<long>() != kFormatVersion) {
    return c.fail("version", "must be %d", kFormatVersion);
  }
  long loopMs;
  if (!readInt(c, v["loopMs"], "loopMs", 100, 600000, loopMs)) return false;
  out.loopMs = (uint32_t)loopMs;

  JsonArrayConst layers = v["layers"].as<JsonArrayConst>();
  if (layers.isNull() || layers.size() < 1 || layers.size() > kMaxLayers) {
    return c.fail("layers", "must be an array of 1–%d layers", kMaxLayers);
  }
  out.layerCount = 0;
  for (JsonVariantConst layer : layers) {
    if (!readLayer(c, layer, Path("layers", out.layerCount), out.layers[out.layerCount])) return false;
    out.layerCount++;
  }
  return true;
}

}  // namespace anim
