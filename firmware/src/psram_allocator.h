#pragma once
// ArduinoJson allocator that prefers PSRAM, so parsing a large config doesn't
// exhaust internal RAM.
#include <ArduinoJson.h>
#include <esp_heap_caps.h>

struct PsramAllocator : ArduinoJson::Allocator {
  void* allocate(size_t size) override {
    void* p = heap_caps_malloc(size, MALLOC_CAP_SPIRAM);
    return p ? p : malloc(size);
  }
  void deallocate(void* pointer) override { free(pointer); }
  void* reallocate(void* ptr, size_t new_size) override {
    return heap_caps_realloc(ptr, new_size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) ?: realloc(ptr, new_size);
  }

  static PsramAllocator* instance() {
    static PsramAllocator allocator;
    return &allocator;
  }
};
