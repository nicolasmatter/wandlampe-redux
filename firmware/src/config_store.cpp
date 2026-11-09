#include "config_store.h"
#include <Arduino.h>
#include <FFat.h>

static const char* kPath = "/config.json";
static bool mounted = false;

void configStoreSetup() {
  mounted = FFat.begin(true);  // formats the partition on first use
  if (!mounted) Serial.println("Config store: FAT partition unavailable");
}

char* configStoreLoad(size_t* len) {
  if (!mounted || !FFat.exists(kPath)) return nullptr;
  File f = FFat.open(kPath, "r");
  if (!f) return nullptr;
  size_t size = f.size();
  char* buf = (char*)ps_malloc(size + 1);
  if (!buf) return nullptr;
  *len = f.read((uint8_t*)buf, size);
  buf[*len] = '\0';
  f.close();
  return buf;
}

bool configStoreSave(const char* json, size_t len) {
  if (!mounted) return false;
  // Write beside the old file first, so a power cut never leaves a half-written config.
  File f = FFat.open("/config.tmp", "w");
  if (!f) return false;
  bool ok = f.write((const uint8_t*)json, len) == len;
  f.close();
  if (!ok) return false;
  FFat.remove(kPath);
  return FFat.rename("/config.tmp", kPath);
}
