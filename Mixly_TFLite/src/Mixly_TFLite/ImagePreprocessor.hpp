#ifndef MIXLY_TFLITE_IMAGE_PREPROCESSOR_HPP
#define MIXLY_TFLITE_IMAGE_PREPROCESSOR_HPP

#include <cstdint>

namespace TFLiteVision {

enum class NormalizeMode {
    MINUS_ONE_TO_ONE,  // (pixel / 127.5) - 1.0  (Teachable Machine default)
    ZERO_TO_ONE        // pixel / 255.0
};

// Convert RGB565 camera frame (S3 DVP) to float array for TFLite input tensor.
// src:       RGB565 pixel buffer from esp_camera (2 bpp)
// dst:       float output array (must be width * height * 3)
// targetWidth/Height: model input dimensions
// camWidth/camHeight: actual camera frame dimensions
// mode:      normalization mode
void PreprocessFrame(const uint8_t* src, float* dst,
                     int targetWidth, int targetHeight,
                     int camWidth, int camHeight,
                     NormalizeMode mode = NormalizeMode::MINUS_ONE_TO_ONE);

// Convert grayscale camera frame (P4 IMX219) to int8 array for TFLite input tensor.
// src:       grayscale pixel buffer (1 bpp, uint8 values 0-255)
// dst:       int8 output array (must be width * height)
// pixelCount: number of pixels (width * height)
// Quantization: uint8 [0..255] → int8 [-128..127] by subtracting 128.
void PreprocessGrayscaleToInt8(const uint8_t* src, int8_t* dst, int pixelCount);

} // namespace TFLiteVision

#endif
