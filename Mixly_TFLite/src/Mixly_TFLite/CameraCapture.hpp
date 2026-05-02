#ifndef MIXLY_TFLITE_CAMERA_CAPTURE_HPP
#define MIXLY_TFLITE_CAMERA_CAPTURE_HPP

#include <cstdint>

namespace TFLiteVision {

// Initialize the ESP32-S3 camera.
// width/height: desired capture resolution (should match model input).
// Returns true on success.
bool InitCamera(int width = 96, int height = 96);

// Capture a single frame. Returns pointer to RGB565 buffer.
// Caller must call ReturnFrame() when done.
// outWidth/outHeight: receives actual frame dimensions.
uint8_t* CaptureFrame(int* outWidth, int* outHeight);

// Return frame buffer to the driver for reuse.
void ReturnFrame(uint8_t* fb);

} // namespace TFLiteVision

#endif
