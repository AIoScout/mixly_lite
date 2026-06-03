#include "CameraCapture.hpp"

// ============================================================================
// ESP32-P4 path: IMX219 MIPI CSI-2 camera
// ============================================================================
#if defined(CONFIG_IDF_TARGET_ESP32P4)

#include "P4IMX219.hpp"

namespace TFLiteVision {

static int s_lastBpp = 1; // P4 outputs grayscale (1 byte per pixel)

bool InitCamera(int width, int height) {
    s_lastBpp = 1;
    return P4IMX219::Init(width, height);
}

uint8_t* CaptureFrame(int* outWidth, int* outHeight, int* outBpp) {
    if (outBpp) *outBpp = s_lastBpp;
    return P4IMX219::CaptureFrame(outWidth, outHeight);
}

void ReturnFrame(uint8_t* fb) {
    P4IMX219::ReturnFrame();
}

} // namespace TFLiteVision

// ============================================================================
// ESP32-S3 path: OV-series DVP camera via esp_camera
// ============================================================================
#elif defined(ESP32)

#include "esp_camera.h"

// ESP32-S3-EYE pin definitions
#define CAM_PIN_PWDN    -1
#define CAM_PIN_RESET   -1
#define CAM_PIN_XCLK    15
#define CAM_PIN_SIOD     4
#define CAM_PIN_SIOC     5
#define CAM_PIN_D7      16
#define CAM_PIN_D6      17
#define CAM_PIN_D5      18
#define CAM_PIN_D4      12
#define CAM_PIN_D3      10
#define CAM_PIN_D2       8
#define CAM_PIN_D1       9
#define CAM_PIN_D0      11
#define CAM_PIN_VSYNC    6
#define CAM_PIN_HREF     7
#define CAM_PIN_PCLK    13

static camera_fb_t* s_lastFb = nullptr;
static int s_lastBpp = 2; // S3 outputs RGB565 (2 bytes per pixel)

namespace TFLiteVision {

bool InitCamera(int width, int height) {
    s_lastBpp = 2;
    camera_config_t config = {};
    config.pin_pwdn     = CAM_PIN_PWDN;
    config.pin_reset    = CAM_PIN_RESET;
    config.pin_xclk     = CAM_PIN_XCLK;
    config.pin_sccb_sda = CAM_PIN_SIOD;
    config.pin_sccb_scl = CAM_PIN_SIOC;
    config.pin_d7       = CAM_PIN_D7;
    config.pin_d6       = CAM_PIN_D6;
    config.pin_d5       = CAM_PIN_D5;
    config.pin_d4       = CAM_PIN_D4;
    config.pin_d3       = CAM_PIN_D3;
    config.pin_d2       = CAM_PIN_D2;
    config.pin_d1       = CAM_PIN_D1;
    config.pin_d0       = CAM_PIN_D0;
    config.pin_vsync    = CAM_PIN_VSYNC;
    config.pin_href     = CAM_PIN_HREF;
    config.pin_pclk     = CAM_PIN_PCLK;

    config.xclk_freq_hz = 20000000;
    config.ledc_timer   = LEDC_TIMER_0;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.pixel_format = PIXFORMAT_RGB565;
    config.frame_size   = FRAMESIZE_96X96;
    config.jpeg_quality = 12;
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;

    if (width > 96 || height > 96) {
        config.frame_size = FRAMESIZE_QVGA;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.print("[TFLite] Camera init failed: ");
        Serial.println(err);
        return false;
    }

    Serial.println("[TFLite] Camera initialized (S3 DVP)");
    return true;
}

uint8_t* CaptureFrame(int* outWidth, int* outHeight, int* outBpp) {
    if (outBpp) *outBpp = s_lastBpp;

    // Return previous frame buffer if not yet returned
    if (s_lastFb) {
        esp_camera_fb_return(s_lastFb);
        s_lastFb = nullptr;
    }

    s_lastFb = esp_camera_fb_get();
    if (!s_lastFb) {
        Serial.println("[TFLite] Camera capture failed");
        return nullptr;
    }
    *outWidth = s_lastFb->width;
    *outHeight = s_lastFb->height;
    return s_lastFb->buf;
}

void ReturnFrame(uint8_t* fb) {
    if (s_lastFb) {
        esp_camera_fb_return(s_lastFb);
        s_lastFb = nullptr;
    }
}

} // namespace TFLiteVision

#else
// ============================================================================
// Fallback stubs
// ============================================================================
namespace TFLiteVision {
bool InitCamera(int, int) { return false; }
uint8_t* CaptureFrame(int*, int*, int*) { return nullptr; }
void ReturnFrame(uint8_t*) {}
}
#endif
