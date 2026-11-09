#pragma once
// Port of the Lab's animation engine (web/src/animation). The TypeScript engine
// is the reference: same generators, positions and blending, checked against
// frames it renders (test/fixtures). Pure: no Arduino, FastLED or JSON here.

#include <stdint.h>

namespace anim {

constexpr int kFormatVersion = 1;
constexpr int kMaxLayers = 6;
constexpr int kMinPaletteColors = 2;
constexpr int kMaxPaletteColors = 8;
constexpr int kMaxLeds = 256;

// Channels 0–255, kept fractional until the final frame.
struct Color {
  float r, g, b;
};

struct Rgb8 {
  uint8_t r, g, b;
};

enum class Blend : uint8_t { Normal, Add };
enum class Edge : uint8_t { Smooth, Hard };
enum class Generator : uint8_t { Solid, Bands };

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

struct Layer {
  Blend blend;
  float opacity;  // 0–1
  float speed;    // 0.5, 1, 2 or 4 layer cycles per loop
  bool hidden;
  Generator generator;
  union {
    SolidParams solid;
    BandsParams bands;
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

}  // namespace anim
