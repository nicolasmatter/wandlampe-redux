// Compares the C++ engine with frames rendered by the TypeScript engine.
// Regenerate the fixtures with `npm run fixtures` in web/.

#include <ArduinoJson.h>
#include <animation.h>
#include <animation_json.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unity.h>

#include "../fixtures/reference_frames.h"

namespace {

// Per channel, the lamp may differ from the reference by this much...
constexpr int kTolerance = 3;
// ...and this share of channel samples may differ more (random events firing slightly differently).
constexpr float kOutlierShare = 0.02f;

int hexByte(const char* s) {
  char buf[3] = {s[0], s[1], 0};
  return (int)strtol(buf, nullptr, 16);
}

struct Result {
  int samples;
  int outliers;
  int worst;
};

Result compareCase(const char* json, char* name, size_t nameLen) {
  JsonDocument doc;
  TEST_ASSERT_EQUAL_MESSAGE(DeserializationError::Ok, deserializeJson(doc, json).code(), "fixture JSON");
  snprintf(name, nameLen, "%s @ %d LEDs", doc["name"].as<const char*>(), doc["ledCount"].as<int>());

  static anim::Animation animation;
  anim::ParseError error;
  if (!anim::parseAnimation(doc["animation"], animation, error)) {
    char message[256];
    snprintf(message, sizeof(message), "%s: %s", name, error.message);
    TEST_FAIL_MESSAGE(message);
  }

  int ledCount = doc["ledCount"];
  Result result{0, 0, 0};
  anim::Rgb8 leds[anim::kMaxLeds];
  for (JsonObjectConst frame : doc["frames"].as<JsonArrayConst>()) {
    anim::render(animation, frame["timeMs"], frame["clockMs"], leds, ledCount);
    const char* expected = frame["leds"];
    for (int i = 0; i < ledCount; i++) {
      const uint8_t got[3] = {leds[i].r, leds[i].g, leds[i].b};
      for (int ch = 0; ch < 3; ch++) {
        int diff = abs(got[ch] - hexByte(expected + i * 6 + ch * 2));
        result.samples++;
        if (diff > kTolerance) result.outliers++;
        if (diff > result.worst) result.worst = diff;
      }
    }
  }
  return result;
}

void test_matches_reference_frames() {
  for (int i = 0; i < kReferenceCaseCount; i++) {
    char name[128];
    Result r = compareCase(kReferenceCases[i], name, sizeof(name));
    printf("  checked  %s (worst diff %d, %d/%d outliers)\n", name, r.worst, r.outliers, r.samples);
    char message[200];
    snprintf(message, sizeof(message), "%s: %d of %d channel samples differ by more than %d", name, r.outliers,
             r.samples, kTolerance);
    TEST_ASSERT_TRUE_MESSAGE(r.outliers <= r.samples * kOutlierShare, message);
  }
}

void test_rejects_unknown_generator() {
  JsonDocument doc;
  deserializeJson(doc, R"({"version":1,"name":"x","loopMs":1000,"layers":[
    {"blend":"normal","opacity":1,"speed":1,"hidden":false,"mirror":false,"generator":"laser","params":{}}]})");
  anim::Animation animation;
  anim::ParseError error;
  TEST_ASSERT_FALSE(anim::parseAnimation(doc.as<JsonVariantConst>(), animation, error));
  TEST_ASSERT_EQUAL_STRING("layers[0].generator \"laser\" is unknown", error.message);
}

void test_rejects_out_of_range_param_with_path() {
  JsonDocument doc;
  deserializeJson(doc, R"({"version":1,"name":"x","loopMs":1000,"layers":[
    {"blend":"normal","opacity":1,"speed":1,"hidden":false,"mirror":false,"generator":"solid","params":{"color":{"r":0,"g":0,"b":0}}},
    {"blend":"add","opacity":1,"speed":1,"hidden":false,"mirror":false,"generator":"bands",
     "params":{"colors":[{"r":0,"g":0,"b":0},{"r":9,"g":9,"b":9}],"edge":"hard","repeat":17,"scroll":0}}]})");
  anim::Animation animation;
  anim::ParseError error;
  TEST_ASSERT_FALSE(anim::parseAnimation(doc.as<JsonVariantConst>(), animation, error));
  TEST_ASSERT_EQUAL_STRING("layers[1].params.repeat must be an integer 1–16", error.message);
}

void test_rejects_newer_version() {
  JsonDocument doc;
  deserializeJson(doc, R"({"version":2,"name":"x","loopMs":1000,"layers":[]})");
  anim::Animation animation;
  anim::ParseError error;
  TEST_ASSERT_FALSE(anim::parseAnimation(doc.as<JsonVariantConst>(), animation, error));
  TEST_ASSERT_EQUAL_STRING("version must be 1", error.message);
}

void test_accepts_range_boundaries() {
  JsonDocument doc;
  deserializeJson(doc, R"({"version":1,"name":"x","loopMs":1000,"layers":[
    {"blend":"normal","opacity":1,"speed":0.5,"hidden":false,"mirror":true,"region":{"from":0.25,"to":0.75,"softness":0.5},
     "generator":"drops","seed":4294967295,"freeRunning":true,
     "params":{"color":{"r":0,"g":0,"b":0},"rate":40,"speed":0.2,"variation":0.9,"length":0.5}},
    {"blend":"add","opacity":0,"speed":4,"hidden":false,"mirror":false,"generator":"sparkle","seed":0,"freeRunning":false,
     "params":{"color":{"r":255,"g":255,"b":255},"density":1,"fade":0.01}},
    {"blend":"add","opacity":1,"speed":1,"hidden":false,"mirror":false,"generator":"ripple","seed":1,"freeRunning":false,
     "params":{"color":{"r":1,"g":2,"b":3},"rate":16,"speed":0.1,"width":0.3,"life":0.05}}]})");
  static anim::Animation animation;
  anim::ParseError error;
  TEST_ASSERT_TRUE_MESSAGE(anim::parseAnimation(doc.as<JsonVariantConst>(), animation, error), error.message);
  TEST_ASSERT_EQUAL_UINT32(4294967295u, animation.layers[0].seed);
}

void test_rejects_duplicate_keyframe_times() {
  JsonDocument doc;
  deserializeJson(doc, R"({"version":1,"name":"x","loopMs":1000,"layers":[
    {"blend":"normal","opacity":1,"speed":1,"hidden":false,"mirror":false,"keyframes":[
      {"at":0.5,"easing":"step","edge":"hard","stops":[{"position":0,"color":{"r":0,"g":0,"b":0}}]},
      {"at":0.5,"easing":"linear","edge":"smooth","stops":[{"position":0,"color":{"r":0,"g":0,"b":0}}]}]}]})");
  static anim::Animation animation;
  anim::ParseError error;
  TEST_ASSERT_FALSE(anim::parseAnimation(doc.as<JsonVariantConst>(), animation, error));
  TEST_ASSERT_EQUAL_STRING("layers[0].keyframes[1].at duplicates another keyframe", error.message);
}

}  // namespace

void setUp() {}
void tearDown() {}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_matches_reference_frames);
  RUN_TEST(test_rejects_unknown_generator);
  RUN_TEST(test_rejects_out_of_range_param_with_path);
  RUN_TEST(test_rejects_newer_version);
  RUN_TEST(test_accepts_range_boundaries);
  RUN_TEST(test_rejects_duplicate_keyframe_times);
  return UNITY_END();
}
