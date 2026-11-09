#pragma once
// Port of the Lab's animation engine (web/src/animation). The TypeScript engine
// is the reference: same generators, positions and blending, checked against
// frames it renders (test/fixtures). Pure: no Arduino, FastLED or JSON here.

#include <stdint.h>

namespace anim {

// Per-LED math. float is native on the ESP32-S3; switch to double if the lamp
// drifts visibly from the preview. Time (layer cycles) is always double.
using real = float;

constexpr int kFormatVersion = 1;
constexpr int kMaxLayers = 6;
constexpr int kMinPaletteColors = 2;
constexpr int kMaxPaletteColors = 8;
constexpr int kMaxKeyframes = 16;
constexpr int kMaxStops = 8;
constexpr int kMaxLeds = 256;

// Channels 0–255, kept fractional until the final frame.
struct Color {
  real r, g, b;
};

struct Rgb8 {
  uint8_t r, g, b;
};

enum class Blend : uint8_t { Normal, Add };
enum class Edge : uint8_t { Smooth, Hard };
enum class Easing : uint8_t { Linear, EaseInOut, Step };
enum class Generator : uint8_t { Solid, Bands, Pulse, Chase, Sparkle, Noise, Strike, Drops, Ripple, Keyframes };

struct SolidParams {
  Color color;
};

// Colors spread evenly along one period and repeat around the ring.
struct BandsParams {
  Color colors[kMaxPaletteColors];
  uint8_t colorCount;
  Edge edge;
  uint8_t repeat;  // periods around the ring, 1–16
  int8_t scroll;   // ring lengths per layer cycle: 1, 0 or -1
};

struct PulseParams {
  Color color;
  real min, max;  // 0–255
  bool sharp;     // sharp attack and decay instead of a sine
};

struct ChaseParams {
  Color color;
  real width, tail;
  uint8_t count;
  int8_t direction;
  bool bounce;
};

struct SparkleParams {
  Color color;
  real density, fade;
};

struct NoiseParams {
  Color colors[kMaxPaletteColors];
  uint8_t colorCount;
  uint8_t scale;
  real contrast;
};

struct StrikeParams {
  Color color;
  real rate;
  uint8_t flickers;
  real width;
  real afterglowMs;
  bool originTop;
};

struct DropsParams {
  Color color;
  uint8_t rate;
  real speed, variation, length;
};

struct RippleParams {
  Color color;
  uint8_t rate;
  real speed, width, life;
};

struct ColorStop {
  real position;
  Color color;
};

// Stops sorted by position.
struct Keyframe {
  real at;
  Easing easing;
  Edge edge;
  uint8_t stopCount;
  ColorStop stops[kMaxStops];
};

// Keyframes sorted by `at`.
struct KeyframeParams {
  uint8_t count;
  Keyframe frames[kMaxKeyframes];
};

// The arc from `from` counterclockwise to `to`; from == to is the whole ring.
struct Region {
  real from, to, softness;
};

struct Layer {
  Blend blend;
  real opacity;  // 0–1
  real speed;    // 0.5, 1, 2 or 4 layer cycles per loop
  bool hidden;
  bool mirror;
  bool hasRegion;
  Region region;
  uint32_t seed;     // random generators
  bool freeRunning;  // random generators
  Generator generator;
  union {
    SolidParams solid;
    BandsParams bands;
    PulseParams pulse;
    ChaseParams chase;
    SparkleParams sparkle;
    NoiseParams noise;
    StrikeParams strike;
    DropsParams drops;
    RippleParams ripple;
    KeyframeParams keyframes;
  };
};

// Layers bottom first.
struct Animation {
  uint32_t loopMs;
  uint8_t layerCount;
  Layer layers[kMaxLayers];
};

// Colors of `ledCount` LEDs around the ring at loop time `timeMs`, before
// brightness. LED 0 is at the bottom, counterclockwise. Free-running layers
// follow `clockMs`, a time that does not wrap with the loop.
void render(const Animation& animation, uint32_t timeMs, uint32_t clockMs, Rgb8* out, int ledCount);

// Uniform value in [0, 1) for a seed and up to three integer coordinates (lowbias32).
double hash01(uint32_t seed, int64_t a, int64_t b = 0, int64_t c = 0);

}  // namespace anim
