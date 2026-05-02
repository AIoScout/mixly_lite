#include "ImagePreprocessor.hpp"
#include <cmath>

namespace TFLiteVision {

// Extract R, G, B from RGB565 pixel
static inline void rgb565ToRgb888(uint16_t pixel, uint8_t& r, uint8_t& g, uint8_t& b) {
    r = ((pixel >> 11) & 0x1F) << 3;
    g = ((pixel >> 5) & 0x3F) << 2;
    b = (pixel & 0x1F) << 3;
}

void PreprocessFrame(const uint8_t* src, float* dst,
                     int targetWidth, int targetHeight,
                     int camWidth, int camHeight,
                     NormalizeMode mode) {
    // Simple nearest-neighbor resize + normalize
    auto* srcPixels = reinterpret_cast<const uint16_t*>(src);
    float xRatio = static_cast<float>(camWidth) / targetWidth;
    float yRatio = static_cast<float>(camHeight) / targetHeight;

    for (int y = 0; y < targetHeight; y++) {
        int srcY = static_cast<int>(y * yRatio);
        if (srcY >= camHeight) srcY = camHeight - 1;
        for (int x = 0; x < targetWidth; x++) {
            int srcX = static_cast<int>(x * xRatio);
            if (srcX >= camWidth) srcX = camWidth - 1;

            uint16_t pixel = srcPixels[srcY * camWidth + srcX];
            uint8_t r, g, b;
            rgb565ToRgb888(pixel, r, g, b);

            int idx = (y * targetWidth + x) * 3;
            if (mode == NormalizeMode::MINUS_ONE_TO_ONE) {
                dst[idx]     = (r / 127.5f) - 1.0f;
                dst[idx + 1] = (g / 127.5f) - 1.0f;
                dst[idx + 2] = (b / 127.5f) - 1.0f;
            } else {
                dst[idx]     = r / 255.0f;
                dst[idx + 1] = g / 255.0f;
                dst[idx + 2] = b / 255.0f;
            }
        }
    }
}

} // namespace TFLiteVision
