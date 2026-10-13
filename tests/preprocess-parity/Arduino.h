// Host-test shim: enough of Arduino.h for SignPreprocess.cpp to compile
// with a plain C++ compiler.
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
struct HostSerial { void println(const char* s) { fprintf(stderr, "%s\n", s); } \
                    void print(const char* s) { fprintf(stderr, "%s", s); } \
                    void print(int) {} void println(int) {} };
static HostSerial Serial;
#define CONFIG_SPIRAM_SUPPORT 0
inline void* ps_malloc(size_t n) { return malloc(n); }
