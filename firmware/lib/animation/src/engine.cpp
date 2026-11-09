#include <cmath>
#include <math.h>

#include "animation.h"

namespace anim {

namespace {

constexpr real kPi = 3.14159265358979f;

inline real fracr(real v) { return v - std::floor(v); }
inline double fracd(double v) { return v - floor(v); }
inline real clamp01(real v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
inline real lerp(real a, real b, real t) { return a + (b - a) * t; }
inline Color mix(const Color& a, const Color& b, real t) {
  return {lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t)};
}
inline Color scale(const Color& c, real s) { return {c.r * s, c.g * s, c.b * s}; }
inline real roundr(real v) { return std::floor(v + 0.5f); }  // Math.round

// --- Randomness (web/src/animation/random.ts) ---

inline uint32_t mix32(uint32_t x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

inline real smooth(real t) { return t * t * (3 - 2 * t); }
inline int64_t mod(int64_t a, int64_t n) { return ((a % n) + n) % n; }

// 3D value noise in [0, 1]; the x lattice repeats every `periodX` units.
real valueNoise3(uint32_t seed, real x, double y, double z, int periodX) {
  const double xi = floor(x), yi = floor(y), zi = floor(z);
  const real tx = smooth(x - (real)xi), ty = smooth((real)(y - yi)), tz = smooth((real)(z - zi));
  const int64_t x0 = mod((int64_t)xi, periodX), x1 = mod((int64_t)xi + 1, periodX);
  const int64_t y0 = (int64_t)yi, z0 = (int64_t)zi;
  auto v = [&](int64_t xx, int dy, int dz) { return (real)hash01(seed, xx, y0 + dy, z0 + dz); };
  const real a00 = lerp(v(x0, 0, 0), v(x1, 0, 0), tx);
  const real a10 = lerp(v(x0, 1, 0), v(x1, 1, 0), tx);
  const real a01 = lerp(v(x0, 0, 1), v(x1, 0, 1), tx);
  const real a11 = lerp(v(x0, 1, 1), v(x1, 1, 1), tx);
  return lerp(lerp(a00, a10, ty), lerp(a01, a11, ty), tz);
}

// --- Layer context (web/src/animation/generators.ts) ---

// `cycles` counts layer cycles: within [0, 1) for looping layers, unbounded for
// free-running ones. When `mirrored`, positions run 0 (bottom) → 1 (top) and don't wrap.
struct Ctx {
  double cycles;
  bool periodic;
  double cycleMs;
  bool mirrored;
};

// Signed distance from `from` to `to`; around the ring it takes the shorter way.
inline real offset(const Ctx& ctx, real from, real to) {
  real d = to - from;
  return ctx.mirrored ? d : fracr(d + 0.5f) - 0.5f;
}

inline int64_t periodicKey(const Ctx& ctx, int64_t g, int64_t slots) { return ctx.periodic ? mod(g, slots) : g; }

Color paletteAt(const Color* colors, int n, real v) {
  real u = clamp01(v) * (n - 1);
  int i = (int)std::floor(u);
  if (i > n - 2) i = n - 2;
  return mix(colors[i], colors[i + 1], u - i);
}

// --- Generators ---

Color bands(const BandsParams& p, real phase, real x) {
  const int k = p.colorCount;
  real u = fracr((x - p.scroll * phase) * p.repeat) * k;
  int i = (int)std::floor(u) % k;
  if (p.edge == Edge::Hard) return p.colors[i];
  return mix(p.colors[i], p.colors[(i + 1) % k], u - std::floor(u));
}

Color pulse(const PulseParams& p, real phase) {
  real level;
  if (!p.sharp) {
    level = (1 - std::cos(2 * kPi * phase)) / 2;
  } else {
    const real attack = 0.1f;
    level = phase < attack ? phase / attack : std::pow(1 - (phase - attack) / (1 - attack), 2);
  }
  return scale(p.color, lerp(p.min, p.max, level) / 255);
}

real dotLevel(const Ctx& ctx, const ChaseParams& p, real head, int dir, real x) {
  real behind = offset(ctx, x, head) * dir;
  real half = p.width / 2;
  if (std::fabs(behind) <= half) return 1;
  if (behind < 0 || p.tail <= 0) return 0;
  return clamp01(1 - (behind - half) / p.tail);
}

real chase(const Ctx& ctx, const ChaseParams& p, real phase, real x) {
  real level = 0;
  for (int k = 0; k < p.count; k++) {
    real t = fracr(phase + (real)k / p.count);
    real l;
    if (p.bounce) {
      bool forward = t < 0.5f;
      real pos = forward ? t * 2 : 2 - t * 2;
      real head = p.direction == 1 ? pos : 1 - pos;
      l = dotLevel(ctx, p, head, (forward ? 1 : -1) * p.direction, x);
    } else {
      real head = p.direction == 1 ? t : 1 - t;
      l = dotLevel(ctx, p, head, p.direction, x);
    }
    if (l > level) level = l;
  }
  return level;
}

constexpr int kSparkleSlots = 16;

real sparkle(const Ctx& ctx, const SparkleParams& p, uint32_t seed, real x) {
  const double fade = p.fade < 0.01f ? 0.01 : p.fade;
  const double c = ctx.cycles;
  // Keyed by position, so mirrored LEDs sparkle together.
  const int64_t spot = (int64_t)roundr(x * 100000);
  real level = 0;
  for (int64_t g = (int64_t)floor((c - fade) * kSparkleSlots) - 1; g <= (int64_t)floor(c * kSparkleSlots); g++) {
    int64_t key = periodicKey(ctx, g, kSparkleSlots);
    if (hash01(seed, spot, key, 1) >= p.density) continue;
    double age = c - (g + hash01(seed, spot, key, 2)) / kSparkleSlots;
    if (age >= 0 && age < fade) {
      real l = (real)(1 - age / fade);
      if (l > level) level = l;
    }
  }
  return level;
}

constexpr double kNoiseLoopRadius = 1.2;

Color noise(const Ctx& ctx, const NoiseParams& p, uint32_t seed, real x) {
  double angle = 2 * M_PI * ctx.cycles;
  // Looping layers walk a circle through the noise field, closing exactly after one cycle.
  double y = ctx.periodic ? kNoiseLoopRadius * cos(angle) : ctx.cycles * 2 * kNoiseLoopRadius;
  double z = ctx.periodic ? kNoiseLoopRadius * sin(angle) : 0;
  const int s = p.scale < 1 ? 1 : p.scale;
  const real sx = x * s;
  real v = 0.65f * valueNoise3(seed, sx, y, z, s) + 0.35f * valueNoise3(seed + 1, sx * 2, y * 2, z * 2, s * 2);
  return paletteAt(p.colors, p.colorCount, clamp01((v - 0.5f) * p.contrast + 0.5f));
}

// A short-lived light source: brightness 0–1 at a center.
struct Spot {
  real center;
  real level;
};
// Entities alive in one frame; more than this only happens with extreme parameters.
constexpr int kMaxEntities = 256;

constexpr int kStrikeSlots = 8;
constexpr double kFlashMs = 50;
constexpr double kFlickerGapMs = 90;

int strikes(const Ctx& ctx, const StrikeParams& p, uint32_t seed, Spot* spots) {
  const double durMs = p.flickers * kFlickerGapMs + p.afterglowMs;
  const double c = ctx.cycles;
  int n = 0;
  for (int64_t g = (int64_t)floor((c - durMs / ctx.cycleMs) * kStrikeSlots) - 1;
       g <= (int64_t)floor(c * kStrikeSlots) && n < kMaxEntities; g++) {
    int64_t key = periodicKey(ctx, g, kStrikeSlots);
    if (hash01(seed, key, 1) >= (double)p.rate / kStrikeSlots) continue;
    double ageMs = (c - (g + hash01(seed, key, 2)) / kStrikeSlots) * ctx.cycleMs;
    if (ageMs < 0 || ageMs > durMs) continue;
    int flashes = 1 + (int)floor(hash01(seed, key, 3) * p.flickers);
    double level = 0;
    for (int j = 0; j < flashes; j++) {
      double t = ageMs - j * kFlickerGapMs;
      if (t >= 0 && t < kFlashMs) level = 0.6 + 0.4 * hash01(seed, key, 10 + j);
    }
    double end = (flashes - 1) * kFlickerGapMs + kFlashMs;
    if (ageMs < end) {
      if (level < 0.08) level = 0.08;
    } else if (p.afterglowMs > 0) {
      double glow = 1 - (ageMs - end) / p.afterglowMs;
      glow = glow < 0 ? 0 : glow > 1 ? 1 : glow;
      glow = 0.35 * glow * glow;
      if (glow > level) level = glow;
    }
    real center = p.originTop ? (ctx.mirrored ? 1 : 0.5f) : (real)hash01(seed, key, 4);
    if (level > 0) spots[n++] = {center, (real)level};
  }
  return n;
}

real strikeAt(const Ctx& ctx, const StrikeParams& p, const Spot* spots, int n, real x) {
  real half = p.width / 2;
  real edge = half > 0.05f ? half : 0.05f;
  real level = 0;
  for (int k = 0; k < n; k++) {
    real d = std::fabs(offset(ctx, spots[k].center, x));
    real shape = p.width >= 1 || d <= half ? 1 : clamp01(1 - (d - half) / edge);
    real l = spots[k].level * shape;
    if (l > level) level = l;
  }
  return level;
}

// Soft half-width of a drop's head, so it lights at least one LED at any count.
constexpr real kDropHead = 0.03f;

int drops(const Ctx& ctx, const DropsParams& p, uint32_t seed, real* heads) {
  const int rate = p.rate < 1 ? 1 : p.rate;
  const double slowest = (double)p.speed * (1 - (double)p.variation);
  const double maxLife = (1 + (double)p.length + kDropHead) / slowest;
  const double c = ctx.cycles;
  int n = 0;
  for (int64_t g = (int64_t)floor((c - maxLife) * rate) - 1; g <= (int64_t)floor(c * rate) && n < kMaxEntities; g++) {
    int64_t key = periodicKey(ctx, g, rate);
    double age = c - (g + hash01(seed, key, 1)) / rate;
    if (age < 0) continue;
    double speed = p.speed * (1 - p.variation * hash01(seed, key, 2));
    double head = 1 - 0.3 * hash01(seed, key, 3) - speed * age;
    if (head >= -((double)p.length + kDropHead)) heads[n++] = (real)head;
  }
  return n;
}

real dropAt(const Ctx& ctx, const DropsParams& p, const real* heads, int n, real x) {
  real level = 0;
  for (int k = 0; k < n; k++) {
    real behind = offset(ctx, heads[k], x);
    real lit;
    if (behind < 0) {
      lit = 1 - -behind / kDropHead;
    } else {
      real head = 1 - behind / kDropHead;
      real tail = p.length > 0 ? 1 - behind / p.length : 0;
      lit = head > tail ? head : tail;
    }
    lit = clamp01(lit);
    if (lit > level) level = lit;
  }
  return level;
}

struct Wave {
  real center, radius, amp;
};

int ripples(const Ctx& ctx, const RippleParams& p, uint32_t seed, Wave* waves) {
  const int rate = p.rate < 1 ? 1 : p.rate;
  const double c = ctx.cycles;
  int n = 0;
  for (int64_t g = (int64_t)floor((c - p.life) * rate) - 1; g <= (int64_t)floor(c * rate) && n < kMaxEntities; g++) {
    int64_t key = periodicKey(ctx, g, rate);
    double age = c - (g + hash01(seed, key, 1)) / rate;
    if (age < 0 || age > p.life) continue;
    waves[n++] = {(real)hash01(seed, key, 2), (real)(p.speed * age), (real)(1 - age / p.life)};
  }
  return n;
}

real rippleAt(const Ctx& ctx, const RippleParams& p, const Wave* waves, int n, real x) {
  real level = 0;
  for (int k = 0; k < n; k++) {
    real d = std::fabs(offset(ctx, waves[k].center, x));
    real l = waves[k].amp * clamp01(1 - std::fabs(d - waves[k].radius) / p.width);
    if (l > level) level = l;
  }
  return level;
}

// --- Keyframes (web/src/animation/keyframes.ts) ---

real ease(Easing easing, real t) {
  if (easing == Easing::Step) return 0;
  if (easing == Easing::EaseInOut) return t * t * (3 - 2 * t);
  return t;
}

// Color at x for stops sorted by position. With `wrap`, the last stop blends
// into the first across 1 → 0; without, colors hold beyond the ends.
Color stopsAt(const ColorStop* stops, int n, Edge edge, real x, bool wrap) {
  if (n == 1) return stops[0].color;
  int i = -1;
  for (int k = 0; k < n; k++)
    if (stops[k].position <= x) i = k;
  if (!wrap) {
    if (i < 0) return stops[0].color;
    if (i == n - 1) return stops[i].color;
  }
  const ColorStop& prev = i < 0 ? stops[n - 1] : stops[i];
  const ColorStop& next = i < 0 ? stops[0] : stops[(i + 1) % n];
  if (edge == Edge::Hard) return prev.color;
  real span = fracr(next.position - prev.position);
  if (span == 0) span = 1;
  return mix(prev.color, next.color, fracr(x - prev.position) / span);
}

// Stable insertion sort by position, like Array.prototype.sort.
void sortStops(ColorStop* stops, int n) {
  for (int i = 1; i < n; i++) {
    ColorStop s = stops[i];
    int j = i - 1;
    while (j >= 0 && stops[j].position > s.position) {
      stops[j + 1] = stops[j];
      j--;
    }
    stops[j + 1] = s;
  }
}

// Precomputed per frame: either one interpolated strip, or two to crossfade.
struct KeyframeFrame {
  const Keyframe* from;
  const Keyframe* to;
  real t;
  bool morph;
  ColorStop stops[kMaxStops];
};

void keyframeFrame(const KeyframeParams& p, real phase, KeyframeFrame& f) {
  const int n = p.count;
  int i = n - 1;
  for (int k = 0; k < n; k++)
    if (p.frames[k].at <= phase) i = k;
  f.from = &p.frames[i];
  f.to = &p.frames[(i + 1) % n];
  real span = fracr(f.to->at - f.from->at);
  if (span == 0) span = 1;
  f.t = n == 1 ? 0 : ease(f.from->easing, fracr(phase - f.from->at) / span);
  f.morph = f.from->stopCount == f.to->stopCount;
  if (!f.morph) return;
  for (int s = 0; s < f.from->stopCount; s++) {
    f.stops[s] = {lerp(f.from->stops[s].position, f.to->stops[s].position, f.t),
                  mix(f.from->stops[s].color, f.to->stops[s].color, f.t)};
  }
  sortStops(f.stops, f.from->stopCount);
}

Color keyframeAt(const KeyframeFrame& f, real x, bool wrap) {
  if (f.morph) return stopsAt(f.stops, f.from->stopCount, f.from->edge, x, wrap);
  return mix(stopsAt(f.from->stops, f.from->stopCount, f.from->edge, x, wrap),
             stopsAt(f.to->stops, f.to->stopCount, f.to->edge, x, wrap), f.t);
}

// --- Composition (web/src/animation/engine.ts) ---

Ctx layerContext(const Layer& layer, uint32_t loopMs, uint32_t timeMs, uint32_t clockMs) {
  Ctx ctx{0, true, (double)loopMs / layer.speed, layer.mirror};
  if (layer.freeRunning) {
    ctx.cycles = (double)clockMs / loopMs * layer.speed;
    ctx.periodic = false;
  } else {
    double c = fmod((double)timeMs / loopMs * layer.speed, 1.0);
    ctx.cycles = c < 0 ? c + 1 : c;
  }
  return ctx;
}

// Mirrored layers see bottom (0) → top (1), identical on both sides of the ring.
inline real mirrorPosition(real x) { return x <= 0.5f ? 2 * x : 2 * (1 - x); }

real regionMask(const Region& r, real x) {
  if (r.from == r.to) return 1;
  real length = fracr(r.to - r.from);
  real into = fracr(x - r.from);
  if (into > length) return 0;
  if (r.softness <= 0) return 1;
  real edge = into < length - into ? into : length - into;
  real m = edge / r.softness;
  return m < 1 ? m : 1;
}

inline real blendChannel(Blend blend, real base, real top, real alpha) {
  if (blend == Blend::Add) {
    real v = base + top * alpha;
    return v < 255 ? v : 255;
  }
  return base + (top - base) * alpha;
}

inline uint8_t toByte(real v) {
  real r = roundr(v);
  return r <= 0 ? 0 : r >= 255 ? 255 : (uint8_t)r;
}

}  // namespace

double hash01(uint32_t seed, int64_t a, int64_t b, int64_t c) {
  // Coordinates wrap to 32 bits like `a | 0` in JavaScript.
  uint32_t h = mix32(seed);
  h = mix32(h ^ (uint32_t)a);
  h = mix32(h ^ (uint32_t)b);
  h = mix32(h ^ (uint32_t)c);
  return h / 4294967296.0;
}

void render(const Animation& animation, uint32_t timeMs, uint32_t clockMs, Rgb8* out, int ledCount) {
  static Color acc[kMaxLeds];
  static Spot spots[kMaxEntities];
  static real heads[kMaxEntities];
  static Wave waves[kMaxEntities];
  static KeyframeFrame kf;
  if (ledCount > kMaxLeds) ledCount = kMaxLeds;
  for (int i = 0; i < ledCount; i++) acc[i] = {0, 0, 0};

  for (int l = 0; l < animation.layerCount; l++) {
    const Layer& layer = animation.layers[l];
    if (layer.hidden || layer.opacity <= 0) continue;
    const Ctx ctx = layerContext(layer, animation.loopMs, timeMs, clockMs);
    const real phase = (real)fracd(ctx.cycles);

    int entities = 0;
    switch (layer.generator) {
      case Generator::Strike: entities = strikes(ctx, layer.strike, layer.seed, spots); break;
      case Generator::Drops: entities = drops(ctx, layer.drops, layer.seed, heads); break;
      case Generator::Ripple: entities = ripples(ctx, layer.ripple, layer.seed, waves); break;
      case Generator::Keyframes: keyframeFrame(layer.keyframes, phase, kf); break;
      case Generator::Pulse: break;
      default: break;
    }
    const Color pulseColor = layer.generator == Generator::Pulse ? pulse(layer.pulse, phase) : Color{0, 0, 0};

    for (int i = 0; i < ledCount; i++) {
      const real ring = (real)i / ledCount;
      const real x = layer.mirror ? mirrorPosition(ring) : ring;
      Color top;
      switch (layer.generator) {
        case Generator::Solid: top = layer.solid.color; break;
        case Generator::Bands: top = bands(layer.bands, phase, x); break;
        case Generator::Pulse: top = pulseColor; break;
        case Generator::Chase: top = scale(layer.chase.color, chase(ctx, layer.chase, phase, x)); break;
        case Generator::Sparkle: top = scale(layer.sparkle.color, sparkle(ctx, layer.sparkle, layer.seed, x)); break;
        case Generator::Noise: top = noise(ctx, layer.noise, layer.seed, x); break;
        case Generator::Strike:
          top = scale(layer.strike.color, strikeAt(ctx, layer.strike, spots, entities, x));
          break;
        case Generator::Drops: top = scale(layer.drops.color, dropAt(ctx, layer.drops, heads, entities, x)); break;
        case Generator::Ripple: top = scale(layer.ripple.color, rippleAt(ctx, layer.ripple, waves, entities, x)); break;
        case Generator::Keyframes: top = keyframeAt(kf, x, !layer.mirror); break;
        default: top = {0, 0, 0}; break;
      }
      const real alpha = layer.opacity * (layer.hasRegion ? regionMask(layer.region, ring) : 1);
      Color& c = acc[i];
      c.r = blendChannel(layer.blend, c.r, top.r, alpha);
      c.g = blendChannel(layer.blend, c.g, top.g, alpha);
      c.b = blendChannel(layer.blend, c.b, top.b, alpha);
    }
  }

  for (int i = 0; i < ledCount; i++) out[i] = {toByte(acc[i].r), toByte(acc[i].g), toByte(acc[i].b)};
}

}  // namespace anim
