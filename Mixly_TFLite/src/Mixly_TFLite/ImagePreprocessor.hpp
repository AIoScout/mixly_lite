#ifndef MIXLY_TFLITE_IMAGE_PREPROCESSOR_HPP
#define MIXLY_TFLITE_IMAGE_PREPROCESSOR_HPP

#include <cstdint>

namespace TFLiteVision {

enum class NormalizeMode {
    MINUS_ONE_TO_ONE,  // (pixel / 127.5) - 1.0  (Teachable Machine default)
    ZERO_TO_ONE        // pixel / 255.0
};

// Convert RGB565 camera frame to float array for TFLite input tensor.
// src:       RGB565 pixel buffer from esp_camera
// dst:       float output array (must be width * height * 3)
// width/height: target model input dimensions
// camWidth/camHeight: actual camera frame dimensions
// mode:      normalization mode
void PreprocessFrame(const uint8_t* src, float* dst,
                     int targetWidth, int targetHeight,
                     int camWidth, int camHeight,
                     NormalizeMode mode = NormalizeMode::MINUS_ONE_TO_ONE);

} // namespace TFLiteVision

#endif
