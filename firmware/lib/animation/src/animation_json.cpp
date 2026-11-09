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

bool readNumber(Ctx& c, JsonVariantConst v, const char* path, double min, double max, real& out) {
  // ArduinoJson may store decimals as float (0.9 → 0.90000004), so allow a hair over the bounds.
  const double slack = 1e-6;
  if (!v.is<double>() || v.as<double>() < min - slack || v.as<double>() > max + slack) {
    return c.fail(path, "must be a number %g–%g", min, max);
  }
  out = (real)v.as<double>();
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

bool readOneOf(Ctx& c, JsonVariantConst v, const char* path, const char* const* names, int count, int& out) {
  for (int i = 0; i < count; i++) {
    if (v == names[i]) {
      out = i;
      return true;
    }
  }
  char allowed[64] = "";
  for (int i = 0; i < count; i++) {
    size_t used = strlen(allowed);
    snprintf(allowed + used, sizeof(allowed) - used, "%s\"%s\"", i ? ", " : "", names[i]);
  }
  return c.fail(path, "must be one of %s", allowed);
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
    return c.fail(Path(path, "scroll"), "must be one of -1, 0, 1");
  }
  out.repeat = (uint8_t)repeat;
  out.scroll = (int8_t)scroll.as<long>();
  return true;
}

bool readPulse(Ctx& c, JsonObjectConst p, const char* path, PulseParams& out) {
  static const char* const curves[] = {"sine", "sharp"};
  long min, max;
  int curve;
  if (!readColor(c, p["color"], Path(path, "color"), out.color)) return false;
  if (!readInt(c, p["min"], Path(path, "min"), 0, 255, min)) return false;
  if (!readInt(c, p["max"], Path(path, "max"), 0, 255, max)) return false;
  if (!readOneOf(c, p["curve"], Path(path, "curve"), curves, 2, curve)) return false;
  out.min = (real)min;
  out.max = (real)max;
  out.sharp = curve == 1;
  return true;
}

bool readChase(Ctx& c, JsonObjectConst p, const char* path, ChaseParams& out) {
  long count;
  if (!readColor(c, p["color"], Path(path, "color"), out.color)) return false;
  if (!readNumber(c, p["width"], Path(path, "width"), 0, 1, out.width)) return false;
  if (!readNumber(c, p["tail"], Path(path, "tail"), 0, 1, out.tail)) return false;
  if (!readInt(c, p["count"], Path(path, "count"), 1, 8, count)) return false;
  JsonVariantConst direction = p["direction"];
  if (!direction.is<long>() || (direction.as<long>() != 1 && direction.as<long>() != -1)) {
    return c.fail(Path(path, "direction"), "must be one of 1, -1");
  }
  if (!readBool(c, p["bounce"], Path(path, "bounce"), out.bounce)) return false;
  out.count = (uint8_t)count;
  out.direction = (int8_t)direction.as<long>();
  return true;
}

bool readSparkle(Ctx& c, JsonObjectConst p, const char* path, SparkleParams& out) {
  return readColor(c, p["color"], Path(path, "color"), out.color) &&
         readNumber(c, p["density"], Path(path, "density"), 0, 1, out.density) &&
         readNumber(c, p["fade"], Path(path, "fade"), 0.01, 1, out.fade);
}

bool readNoise(Ctx& c, JsonObjectConst p, const char* path, NoiseParams& out) {
  long scale;
  if (!readPalette(c, p["colors"], Path(path, "colors"), out.colors, out.colorCount)) return false;
  if (!readInt(c, p["scale"], Path(path, "scale"), 1, 16, scale)) return false;
  if (!readNumber(c, p["contrast"], Path(path, "contrast"), 0.5, 8, out.contrast)) return false;
  out.scale = (uint8_t)scale;
  return true;
}

bool readStrike(Ctx& c, JsonObjectConst p, const char* path, StrikeParams& out) {
  static const char* const origins[] = {"random", "top"};
  long flickers;
  int origin;
  if (!readColor(c, p["color"], Path(path, "color"), out.color)) return false;
  if (!readNumber(c, p["rate"], Path(path, "rate"), 0, 8, out.rate)) return false;
  if (!readInt(c, p["flickers"], Path(path, "flickers"), 1, 4, flickers)) return false;
  if (!readNumber(c, p["width"], Path(path, "width"), 0.02, 1, out.width)) return false;
  if (!readNumber(c, p["afterglowMs"], Path(path, "afterglowMs"), 0, 3000, out.afterglowMs)) return false;
  if (!readOneOf(c, p["origin"], Path(path, "origin"), origins, 2, origin)) return false;
  out.flickers = (uint8_t)flickers;
  out.originTop = origin == 1;
  return true;
}

bool readDrops(Ctx& c, JsonObjectConst p, const char* path, DropsParams& out) {
  long rate;
  if (!readColor(c, p["color"], Path(path, "color"), out.color)) return false;
  if (!readInt(c, p["rate"], Path(path, "rate"), 1, 40, rate)) return false;
  if (!readNumber(c, p["speed"], Path(path, "speed"), 0.2, 8, out.speed)) return false;
  if (!readNumber(c, p["variation"], Path(path, "variation"), 0, 0.9, out.variation)) return false;
  if (!readNumber(c, p["length"], Path(path, "length"), 0, 0.5, out.length)) return false;
  out.rate = (uint8_t)rate;
  return true;
}

bool readRipple(Ctx& c, JsonObjectConst p, const char* path, RippleParams& out) {
  long rate;
  if (!readColor(c, p["color"], Path(path, "color"), out.color)) return false;
  if (!readInt(c, p["rate"], Path(path, "rate"), 1, 16, rate)) return false;
  if (!readNumber(c, p["speed"], Path(path, "speed"), 0.1, 4, out.speed)) return false;
  if (!readNumber(c, p["width"], Path(path, "width"), 0.01, 0.3, out.width)) return false;
  if (!readNumber(c, p["life"], Path(path, "life"), 0.05, 2, out.life)) return false;
  out.rate = (uint8_t)rate;
  return true;
}

bool readKeyframes(Ctx& c, JsonVariantConst v, const char* path, KeyframeParams& out) {
  static const char* const easings[] = {"linear", "ease-in-out", "step"};
  JsonArrayConst frames = v.as<JsonArrayConst>();
  if (frames.isNull() || frames.size() < 1 || frames.size() > kMaxKeyframes) {
    return c.fail(path, "must hold 1–%d keyframes", kMaxKeyframes);
  }
  out.count = 0;
  for (JsonVariantConst fv : frames) {
    Path kp(path, out.count);
    JsonObjectConst f = fv.as<JsonObjectConst>();
    if (f.isNull()) return c.fail(kp, "must be an object");
    Keyframe& k = out.frames[out.count];
    if (!readNumber(c, f["at"], Path(kp, "at"), 0, 1, k.at)) return false;
    for (int j = 0; j < out.count; j++) {
      if (out.frames[j].at == k.at) return c.fail(Path(kp, "at"), "duplicates another keyframe");
    }
    int easing;
    if (!readOneOf(c, f["easing"], Path(kp, "easing"), easings, 3, easing)) return false;
    k.easing = (Easing)easing;
    if (!readEdge(c, f["edge"], Path(kp, "edge"), k.edge)) return false;

    Path sp(kp, "stops");
    JsonArrayConst stops = f["stops"].as<JsonArrayConst>();
    if (stops.isNull() || stops.size() < 1 || stops.size() > kMaxStops) {
      return c.fail(sp, "must hold 1–%d color stops", kMaxStops);
    }
    k.stopCount = 0;
    for (JsonVariantConst stv : stops) {
      Path stp(sp, k.stopCount);
      JsonObjectConst st = stv.as<JsonObjectConst>();
      if (st.isNull()) return c.fail(stp, "must be an object");
      ColorStop& stop = k.stops[k.stopCount];
      if (!readNumber(c, st["position"], Path(stp, "position"), 0, 1, stop.position)) return false;
      if (!readColor(c, st["color"], Path(stp, "color"), stop.color)) return false;
      k.stopCount++;
    }
    // Stable sort by position, as the Lab does before rendering.
    for (int i = 1; i < k.stopCount; i++) {
      ColorStop s = k.stops[i];
      int j = i - 1;
      while (j >= 0 && k.stops[j].position > s.position) {
        k.stops[j + 1] = k.stops[j];
        j--;
      }
      k.stops[j + 1] = s;
    }
    out.count++;
  }
  // Sort keyframes by time; `at` values are unique.
  for (int i = 1; i < out.count; i++) {
    Keyframe f = out.frames[i];
    int j = i - 1;
    while (j >= 0 && out.frames[j].at > f.at) {
      out.frames[j + 1] = out.frames[j];
      j--;
    }
    out.frames[j + 1] = f;
  }
  return true;
}

struct GeneratorInfo {
  const char* name;
  Generator generator;
  bool random;
};

const GeneratorInfo kGenerators[] = {
    {"solid", Generator::Solid, false},     {"bands", Generator::Bands, false},
    {"pulse", Generator::Pulse, false},     {"chase", Generator::Chase, false},
    {"sparkle", Generator::Sparkle, true},  {"noise", Generator::Noise, true},
    {"strike", Generator::Strike, true},    {"drops", Generator::Drops, true},
    {"ripple", Generator::Ripple, true},
};

bool readGenerator(Ctx& c, JsonObjectConst v, const char* path, Layer& layer) {
  Path genPath(path, "generator");
  const char* name = v["generator"] | "";
  const GeneratorInfo* info = nullptr;
  for (const GeneratorInfo& g : kGenerators) {
    if (strcmp(name, g.name) == 0) info = &g;
  }
  if (!info) return c.fail(genPath, "\"%s\" is unknown", name);
  layer.generator = info->generator;

  Path paramsPath(path, "params");
  JsonObjectConst params = v["params"].as<JsonObjectConst>();
  if (params.isNull()) return c.fail(paramsPath, "must be an object");
  bool ok = false;
  switch (layer.generator) {
    case Generator::Solid: ok = readSolid(c, params, paramsPath, layer.solid); break;
    case Generator::Bands: ok = readBands(c, params, paramsPath, layer.bands); break;
    case Generator::Pulse: ok = readPulse(c, params, paramsPath, layer.pulse); break;
    case Generator::Chase: ok = readChase(c, params, paramsPath, layer.chase); break;
    case Generator::Sparkle: ok = readSparkle(c, params, paramsPath, layer.sparkle); break;
    case Generator::Noise: ok = readNoise(c, params, paramsPath, layer.noise); break;
    case Generator::Strike: ok = readStrike(c, params, paramsPath, layer.strike); break;
    case Generator::Drops: ok = readDrops(c, params, paramsPath, layer.drops); break;
    case Generator::Ripple: ok = readRipple(c, params, paramsPath, layer.ripple); break;
    case Generator::Keyframes: break;
  }
  if (!ok) return false;

  layer.seed = 0;
  layer.freeRunning = false;
  if (info->random) {
    JsonVariantConst seed = v["seed"];
    if (!seed.is<uint32_t>()) return c.fail(Path(path, "seed"), "must be an integer 0–4294967295");
    layer.seed = seed.as<uint32_t>();
    if (!readBool(c, v["freeRunning"], Path(path, "freeRunning"), layer.freeRunning)) return false;
  }
  return true;
}

bool readRegion(Ctx& c, JsonVariantConst v, const char* path, Region& out) {
  JsonObjectConst o = v.as<JsonObjectConst>();
  if (o.isNull()) return c.fail(path, "must be an object");
  return readNumber(c, o["from"], Path(path, "from"), 0, 1, out.from) &&
         readNumber(c, o["to"], Path(path, "to"), 0, 1, out.to) &&
         readNumber(c, o["softness"], Path(path, "softness"), 0, 0.5, out.softness);
}

bool readLayer(Ctx& c, JsonVariantConst json, const char* path, Layer& layer) {
  static const char* const blends[] = {"normal", "add"};
  JsonObjectConst v = json.as<JsonObjectConst>();
  if (v.isNull()) return c.fail(path, "must be an object");

  int blend;
  if (!readOneOf(c, v["blend"], Path(path, "blend"), blends, 2, blend)) return false;
  layer.blend = (Blend)blend;
  if (!readNumber(c, v["opacity"], Path(path, "opacity"), 0, 1, layer.opacity)) return false;

  JsonVariantConst speed = v["speed"];
  real s = speed.is<float>() ? speed.as<float>() : 0;
  if (s != 0.5f && s != 1 && s != 2 && s != 4) return c.fail(Path(path, "speed"), "must be one of 0.5, 1, 2, 4");
  layer.speed = s;

  if (!readBool(c, v["hidden"], Path(path, "hidden"), layer.hidden)) return false;
  if (!readBool(c, v["mirror"], Path(path, "mirror"), layer.mirror)) return false;
  layer.hasRegion = !v["region"].isNull();
  if (layer.hasRegion && !readRegion(c, v["region"], Path(path, "region"), layer.region)) return false;

  if (!v["keyframes"].isNull()) {
    if (!v["generator"].isNull()) return c.fail(path, "must have either \"generator\" or \"keyframes\", not both");
    layer.generator = Generator::Keyframes;
    layer.seed = 0;
    layer.freeRunning = false;
    return readKeyframes(c, v["keyframes"], Path(path, "keyframes"), layer.keyframes);
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
