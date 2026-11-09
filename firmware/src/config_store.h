#pragma once
// Keeps the last accepted config payload as a file on the flash's FAT partition.
#include <stddef.h>

void configStoreSetup();
// Returns a PSRAM buffer the caller frees, or nullptr if nothing is stored.
char* configStoreLoad(size_t* len);
bool configStoreSave(const char* json, size_t len);
