#include "animation.h"

#include <math.h>

namespace anim {

namespace {

inline float fracf(float v) { return v - floorf(v); }

inline Color mix(const Color& a, const Color& b, float t) {
  return {a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t};
}

// Layer cycles elapsed, within [0, 1). Computed in double: loop time can be large.
float layerPhase(const Layer& layer, uint32_t loopMs, uint32_t timeMs) {
  double c = fmod((double)timeMs / loopMs * layer.speed, 1.0);
  return (float)(c < 0 ? c + 1 : c);
}

Color bands(const BandsParams& p, float phase, float x) {
  const int k = p.colorCount;
  float u = fracf((x - p.scroll * phase) * p.repeat) * k;
  int i = (int)floorf(u) % k;
  if (p.edge == Edge::Hard) return p.colors[i];
  return mix(p.colors[i], p.colors[(i + 1) % k], u - floorf(u));
}

Color generate(const Layer& layer, float phase, float x) {
  switch (layer.generator) {
    case Generator::Solid:
      return layer.solid.color;
    case Generator::Bands:
      return bands(layer.bands, phase, x);
  }
  return {0, 0, 0};
}

inline float blendChannel(Blend blend, float base, float top, float alpha) {
  if (blend == Blend::Add) return fminf(255.0f, base + top * alpha);
  return base + (top - base) * alpha;
}

inline uint8_t toByte(float v) {
  float r = floorf(v + 0.5f);  // Math.round
  return r <= 0 ? 0 : r >= 255 ? 255 : (uint8_t)r;
}

}  // namespace

void render(const Animation& animation, uint32_t timeMs, uint32_t clockMs, Rgb8* out, int ledCount) {
  (void)clockMs;
  static Color acc[kMaxLeds];
  if (ledCount > kMaxLeds) ledCount = kMaxLeds;
  for (int i = 0; i < ledCount; i++) acc[i] = {0, 0, 0};

  for (int l = 0; l < animation.layerCount; l++) {
    const Layer& layer = animation.layers[l];
    if (layer.hidden || layer.opacity <= 0) continue;
    float phase = layerPhase(layer, animation.loopMs, timeMs);
    for (int i = 0; i < ledCount; i++) {
      float x = (float)i / ledCount;
      Color top = generate(layer, phase, x);
      Color& c = acc[i];
      c.r = blendChannel(layer.blend, c.r, top.r, layer.opacity);
      c.g = blendChannel(layer.blend, c.g, top.g, layer.opacity);
      c.b = blendChannel(layer.blend, c.b, top.b, layer.opacity);
    }
  }

  for (int i = 0; i < ledCount; i++) out[i] = {toByte(acc[i].r), toByte(acc[i].g), toByte(acc[i].b)};
}

}  // namespace anim
