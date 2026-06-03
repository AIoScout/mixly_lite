#ifndef MIXLY_TFLITE_CAMERA_CAPTURE_HPP
#define MIXLY_TFLITE_CAMERA_CAPTURE_HPP

#include <cstdint>

namespace TFLiteVision {

// Initialize camera for the current board.
//   ESP32-S3: OV-series DVP camera via esp_camera
//   ESP32-P4: IMX219 MIPI CSI-2 camera via P4IMX219
// width/height: desired capture resolution (should match model input).
// Returns true on success.
bool InitCamera(int width = 96, int height = 96);

// Capture a single frame.
// outWidth/outHeight: receives actual frame dimensions.
// outBpp: receives bytes per pixel (2=RGB565 on S3, 1=grayscale on P4).
// Returns pointer to pixel buffer, or nullptr on failure.
// Caller must call ReturnFrame() when done.
uint8_t* CaptureFrame(int* outWidth, int* outHeight, int* outBpp);

// Return frame buffer to the driver for reuse.
void ReturnFrame(uint8_t* fb);

} // namespace TFLiteVision

#endif
