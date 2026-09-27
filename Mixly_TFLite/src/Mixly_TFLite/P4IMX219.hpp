#ifndef MIXLY_TFLITE_P4_IMX219_HPP
#define MIXLY_TFLITE_P4_IMX219_HPP

#include <cstdint>

// ESP32-P4 IMX219 camera driver for TFLite inference.
// Captures via MIPI CSI-2, demosaics RAW10 bayer, center-crops to square,
// downscales to target size, converts to grayscale.
//
// Two backends (selected at compile time via __has_include):
//   1. Arduino library (ESP32_P4_IMX219.h) — returns pre-converted grayscale
//   2. ESP-IDF esp_video V4L2 — full pipeline: RAW10 → RGB → grayscale
//
// Pin config (ESP32-P4 + IMX219):
//   I2C SDA = GPIO7, SCL = GPIO8, XCLK = GPIO20 (24 MHz)

namespace P4IMX219 {

// Initialize camera with target output dimensions.
// Default 96x96 for TFLite Teachable Machine models.
// Returns true on success.
bool Init(int targetWidth = 96, int targetHeight = 96);

// Capture a frame and convert to grayscale.
// outWidth/outHeight: receives actual output dimensions.
// Returns pointer to grayscale buffer (targetWidth * targetHeight bytes, 1 bpp).
// Returns nullptr on failure.
// Caller must NOT free the returned pointer — it is managed internally.
uint8_t* CaptureFrame(int* outWidth, int* outHeight);

// Return the frame buffer for reuse (only needed for V4L2 backend).
// Safe to call even if no frame is held.
void ReturnFrame();

// Deinitialize camera and free resources.
void Deinit();

} // namespace P4IMX219

#endif
