// Reading wandlampe/config payloads (docs/mqtt.md).

#include <ArduinoJson.h>
#include <lamp_config.h>
#include <stdio.h>
#include <string>
#include <unity.h>

namespace {

const char* kRainbow = R"({"version":1,"name":"Rainbow","loopMs":6000,"layers":[
  {"blend":"normal","opacity":1,"speed":1,"hidden":false,"mirror":false,"generator":"bands",
   "params":{"colors":[{"r":255,"g":0,"b":0},{"r":0,"g":255,"b":0},{"r":0,"g":0,"b":255}],
             "edge":"smooth","repeat":1,"scroll":1}}]})";

ModesConfig cfg;
anim::Animation animation;
anim::ParseError error;

bool parse(JsonDocument& doc, const std::string& json) {
  TEST_ASSERT_EQUAL(DeserializationError::Ok, deserializeJson(doc, json).code());
  return parseModesConfig(doc, cfg, error);
}

void test_reads_embedded_animation_mode() {
  JsonDocument doc;
  std::string json = std::string(R"({"modes":[
    {"name":"Warm","type":"single-color","brightness":100,"color":{"r":255,"g":180,"b":60}},
    {"name":"Rainbow","type":"animation","brightness":200,"animation":)") + kRainbow + "}]}";
  TEST_ASSERT_TRUE_MESSAGE(parse(doc, json), error.message);
  TEST_ASSERT_EQUAL(2, cfg.numModes);
  TEST_ASSERT_EQUAL(MODE_ANIMATION, cfg.modes[1].type);
  TEST_ASSERT_EQUAL(200, cfg.modes[1].brightness);

  TEST_ASSERT_TRUE_MESSAGE(parseModeAnimation(doc, 1, animation, error), error.message);
  TEST_ASSERT_EQUAL(6000, animation.loopMs);
  TEST_ASSERT_EQUAL(1, animation.layerCount);
  TEST_ASSERT_EQUAL(3, animation.layers[0].bands.colorCount);
}

void test_rejects_former_builtin_animation_names() {
  JsonDocument doc;
  TEST_ASSERT_FALSE(parse(doc, R"({"modes":[{"type":"animation","brightness":128,"animation":"breathe",
    "color":{"r":1,"g":2,"b":3}}]})"));
  TEST_ASSERT_EQUAL_STRING("modes[0].animation must be an object", error.message);
}

void test_invalid_embedded_animation_names_mode_and_field() {
  JsonDocument doc;
  std::string bad = kRainbow;
  bad.replace(bad.find("\"repeat\":1"), 10, "\"repeat\":0");
  std::string json = std::string(R"({"modes":[{"type":"single-color","color":{"r":0,"g":0,"b":0}},
    {"type":"animation","animation":)") + bad + "}]}";
  TEST_ASSERT_FALSE(parse(doc, json));
  TEST_ASSERT_EQUAL_STRING("modes[1].animation.layers[0].params.repeat must be an integer 1–16", error.message);
}

void test_reads_a_30kb_config() {
  // Eight animation modes with long names make a config near the 32 KB limit.
  std::string json = R"({"modes":[)";
  for (int i = 0; i < MAX_MODES; i++) {
    if (i) json += ",";
    json += R"({"type":"animation","brightness":128,"name":")" + std::string(3500, 'a' + i) +
            R"(","animation":)" + kRainbow + "}";
  }
  json += "]}";
  TEST_ASSERT_GREATER_THAN(30000, json.size());
  TEST_ASSERT_LESS_THAN(32768, json.size());

  JsonDocument doc;
  TEST_ASSERT_TRUE_MESSAGE(parse(doc, json), error.message);
  TEST_ASSERT_EQUAL(MAX_MODES, cfg.numModes);
  TEST_ASSERT_TRUE(parseModeAnimation(doc, MAX_MODES - 1, animation, error));
}

void test_pads_short_led_arrays_with_black() {
  JsonDocument doc;
  TEST_ASSERT_TRUE(parse(doc, R"({"brightness":90,"leds":[{"r":9,"g":8,"b":7}]})"));
  TEST_ASSERT_EQUAL(1, cfg.numModes);
  TEST_ASSERT_EQUAL(MODE_STATIC, cfg.modes[0].type);
  TEST_ASSERT_EQUAL(9, cfg.modes[0].leds[0].r);
  TEST_ASSERT_EQUAL(0, cfg.modes[0].leds[NUM_LEDS - 1].r);
}

void test_rejects_config_without_modes() {
  JsonDocument doc;
  TEST_ASSERT_FALSE(parse(doc, R"({"modes":[]})"));
  TEST_ASSERT_EQUAL_STRING("modes must not be empty", error.message);
  TEST_ASSERT_FALSE(parse(doc, R"({"brightness":3})"));
  TEST_ASSERT_EQUAL_STRING("config must have \"modes\" or \"leds\"", error.message);
}

}  // namespace

void setUp() {}
void tearDown() {}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_reads_embedded_animation_mode);
  RUN_TEST(test_rejects_former_builtin_animation_names);
  RUN_TEST(test_invalid_embedded_animation_names_mode_and_field);
  RUN_TEST(test_reads_a_30kb_config);
  RUN_TEST(test_pads_short_led_arrays_with_black);
  RUN_TEST(test_rejects_config_without_modes);
  return UNITY_END();
}
