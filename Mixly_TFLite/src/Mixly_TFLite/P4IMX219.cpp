#include "P4IMX219.hpp"

#if defined(CONFIG_IDF_TARGET_ESP32P4)

// ============================================================================
// Path A: Arduino IMX219 library (preferred — simplest path)
// ============================================================================
#if __has_include("ESP32_P4_IMX219.h")
#include "ESP32_P4_IMX219.h"

namespace P4IMX219 {

static bool s_initialized = false;
static int s_targetW = 96;
static int s_targetH = 96;

bool Init(int targetWidth, int targetHeight) {
    if (s_initialized) return true;
    s_targetW = targetWidth;
    s_targetH = targetHeight;

    if (!esp32_p4_imx219_begin()) {
        Serial.println("[P4IMX219] Camera init failed");
        return false;
    }
    s_initialized = true;
    Serial.println("[P4IMX219] Camera initialized (Arduino lib path)");
    return true;
}

uint8_t* CaptureFrame(int* outWidth, int* outHeight) {
    if (!s_initialized) return nullptr;

    // Poll for a frame (up to ~200ms)
    for (int i = 0; i < 100; i++) {
        if (esp32_p4_imx219_update()) {
            break;
        }
        delay(2);
        if (i == 99) {
            Serial.println("[P4IMX219] Frame capture timeout");
            return nullptr;
        }
    }

    const uint8_t* gray = esp32_p4_imx219_gray();
    if (!gray) return nullptr;

    if (outWidth) *outWidth = s_targetW;
    if (outHeight) *outHeight = s_targetH;
    return const_cast<uint8_t*>(gray);
}

void ReturnFrame() {
    // Arduino library manages its own buffers — nothing to do
}

void Deinit() {
    s_initialized = false;
}

} // namespace P4IMX219

// ============================================================================
// Path B: ESP-IDF esp_video V4L2 (low-level fallback)
// ============================================================================
#elif __has_include("esp_video_init.h")

#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <errno.h>
#include "esp_log.h"
#include "esp_video_init.h"
#include "esp_video_ioctl.h"
#include "esp_video_device.h"
#include "esp_cam_sensor_detect.h"
#include "imx219.h"
#include "driver/ledc.h"
#include "driver/gpio.h"
#include "nvs_flash.h"
#include "esp_heap_caps.h"

namespace P4IMX219 {

// Sensor constants
static constexpr int kSensorWidth = 1536;
static constexpr int kSensorHeight = 1232;
static constexpr int kCropSize = 1232; // center-crop to square

// Pin definitions
static constexpr gpio_num_t kI2C_SCL = GPIO_NUM_8;
static constexpr gpio_num_t kI2C_SDA = GPIO_NUM_7;
static constexpr int kI2C_Port = 0;
static constexpr int kI2C_Freq = 100000;
static constexpr gpio_num_t kXCLK_Pin = GPIO_NUM_20;
static constexpr int kXCLK_Freq = 24000000;

// State
static int s_targetW = 96;
static int s_targetH = 96;
static int s_fd = -1;
static void* s_mappedBufs[2] = {nullptr};
static uint8_t* s_rgbBuf = nullptr;
static uint8_t* s_grayBuf = nullptr;
static int* s_xLut = nullptr;
static int* s_yLut = nullptr;

// ---- XCLK generation via LEDC PWM ----

static void enableXCLK() {
    ledc_timer_config_t timerCfg = {};
    timerCfg.timer_num = LEDC_TIMER_0;
    timerCfg.speed_mode = LEDC_LOW_SPEED_MODE;
    timerCfg.duty_resolution = LEDC_TIMER_1_BIT;
    timerCfg.freq_hz = kXCLK_Freq;
    timerCfg.clk_cfg = LEDC_AUTO_CLK;
    ledc_timer_config(&timerCfg);

    ledc_channel_config_t chanCfg = {};
    chanCfg.channel = LEDC_CHANNEL_0;
    chanCfg.duty = 1;
    chanCfg.gpio_num = kXCLK_Pin;
    chanCfg.speed_mode = LEDC_LOW_SPEED_MODE;
    chanCfg.hpoint = 0;
    chanCfg.timer_sel = LEDC_TIMER_0;
    ledc_channel_config(&chanCfg);
}

// ---- Demosaic lookup tables ----

static void initDemosaicLUTs() {
    s_xLut = (int*)malloc(s_targetW * sizeof(int));
    s_yLut = (int*)malloc(s_targetH * sizeof(int));

    int xOff = (kSensorWidth - kCropSize) / 2;
    int yOff = (kSensorHeight - kCropSize) / 2;

    float xStep = (float)kCropSize / s_targetW;
    float yStep = (float)kCropSize / s_targetH;

    for (int y = 0; y < s_targetH; y++) {
        s_yLut[y] = (yOff + (int)(y * yStep + 0.5f)) & ~1;
    }
    for (int x = 0; x < s_targetW; x++) {
        s_xLut[x] = (xOff + (int)(x * xStep + 0.5f)) & ~1;
    }
}

// ---- RAW10 Bayer demosaic to RGB888 ----

static void demosaicBGGR(const uint8_t* raw10, uint8_t* rgb) {
    int stride = kSensorWidth * 5 / 4; // RAW10: 5 bytes per 4 pixels

    for (int y = 0; y < s_targetH; y++) {
        int srcY = s_yLut[y];
        int row0 = srcY * stride;
        int row1 = (srcY + 1) * stride;
        int outRow = y * s_targetW;

        for (int x = 0; x < s_targetW; x++) {
            int srcX = s_xLut[x];
            int col = (srcX >> 2) * 5 + (srcX % 4);

            // BGGR bayer: Blue on even/even, Green on even/odd & odd/even, Red on odd/odd
            uint8_t b = raw10[row0 + col];
            uint8_t g = (raw10[row0 + col + 1] + raw10[row1 + col]) >> 1;
            uint8_t r = raw10[row1 + col + 1];

            int outIdx = (outRow + x) * 3;
            rgb[outIdx + 0] = r;
            rgb[outIdx + 1] = g;
            rgb[outIdx + 2] = b;
        }
    }
}

// ---- RGB888 to grayscale (BT.601 luminance) ----

static void rgbToGray(const uint8_t* rgb, uint8_t* gray, int pixelCount) {
    for (int i = 0; i < pixelCount; i++) {
        int idx = i * 3;
        gray[i] = (uint8_t)(((uint16_t)rgb[idx] * 30 +
                             (uint16_t)rgb[idx + 1] * 59 +
                             (uint16_t)rgb[idx + 2] * 11) / 100);
    }
}

// ---- Public API ----

bool Init(int targetWidth, int targetHeight) {
    s_targetW = targetWidth;
    s_targetH = targetHeight;

    nvs_flash_init();
    initDemosaicLUTs();
    enableXCLK();
    delay(100);
    imx219_force_link();

    // CSI config
    esp_video_init_csi_config_t csiCfg = {};
    csiCfg.sccb_config.init_sccb = true;
    csiCfg.sccb_config.i2c_config.port = kI2C_Port;
    csiCfg.sccb_config.i2c_config.scl_pin = kI2C_SCL;
    csiCfg.sccb_config.i2c_config.sda_pin = kI2C_SDA;
    csiCfg.sccb_config.freq = kI2C_Freq;
    csiCfg.reset_pin = GPIO_NUM_NC;
    csiCfg.pwdn_pin = GPIO_NUM_NC;

    esp_video_init_config_t camCfg = {};
    camCfg.csi = &csiCfg;
    esp_video_init(&camCfg);

    // Open V4L2 device
    s_fd = open(ESP_VIDEO_MIPI_CSI_DEVICE_NAME, O_RDWR);
    if (s_fd < 0) {
        Serial.println("[P4IMX219] Failed to open CSI device");
        return false;
    }

    // Set format: RAW10 bayer, full sensor resolution
    struct v4l2_format fmt = {};
    fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    fmt.fmt.pix.width = kSensorWidth;
    fmt.fmt.pix.height = kSensorHeight;
    fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_SBGGR10;
    ioctl(s_fd, VIDIOC_S_FMT, &fmt);

    // Request 2 MMAP buffers
    struct v4l2_requestbuffers req = {};
    req.count = 2;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;
    ioctl(s_fd, VIDIOC_REQBUFS, &req);

    // Map and queue buffers
    for (int i = 0; i < 2; i++) {
        struct v4l2_buffer b = {};
        b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        b.memory = V4L2_MEMORY_MMAP;
        b.index = i;
        ioctl(s_fd, VIDIOC_QUERYBUF, &b);
        s_mappedBufs[i] = mmap(NULL, b.length, PROT_READ | PROT_WRITE, MAP_SHARED, s_fd, b.m.offset);
        ioctl(s_fd, VIDIOC_QBUF, &b);
    }

    // Start streaming
    int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    ioctl(s_fd, VIDIOC_STREAMON, &type);

    // Allocate processing buffers in PSRAM
    s_rgbBuf = (uint8_t*)heap_caps_malloc(s_targetW * s_targetH * 3, MALLOC_CAP_SPIRAM);
    s_grayBuf = (uint8_t*)heap_caps_malloc(s_targetW * s_targetH, MALLOC_CAP_SPIRAM);

    Serial.println("[P4IMX219] Camera initialized (V4L2 path)");
    return true;
}

uint8_t* CaptureFrame(int* outWidth, int* outHeight) {
    if (s_fd < 0 || !s_rgbBuf || !s_grayBuf) return nullptr;

    // Dequeue a filled buffer
    struct v4l2_buffer bufDq = {};
    bufDq.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    bufDq.memory = V4L2_MEMORY_MMAP;

    if (ioctl(s_fd, VIDIOC_DQBUF, &bufDq) != 0) {
        return nullptr;
    }

    uint8_t* raw = (uint8_t*)s_mappedBufs[bufDq.index];

    // RAW10 bayer → RGB888 (center-crop + downscale in one step)
    demosaicBGGR(raw, s_rgbBuf);

    // RGB888 → grayscale
    rgbToGray(s_rgbBuf, s_grayBuf, s_targetW * s_targetH);

    // Re-queue the V4L2 buffer
    ioctl(s_fd, VIDIOC_QBUF, &bufDq);

    if (outWidth) *outWidth = s_targetW;
    if (outHeight) *outHeight = s_targetH;
    return s_grayBuf;
}

void ReturnFrame() {
    // V4L2 buffer already re-queued in CaptureFrame — nothing to do
}

void Deinit() {
    if (s_fd >= 0) {
        int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        ioctl(s_fd, VIDIOC_STREAMOFF, &type);
        for (int i = 0; i < 2; i++) {
            if (s_mappedBufs[i]) munmap(s_mappedBufs[i], 0);
            s_mappedBufs[i] = nullptr;
        }
        close(s_fd);
        s_fd = -1;
    }
    if (s_rgbBuf) { heap_caps_free(s_rgbBuf); s_rgbBuf = nullptr; }
    if (s_grayBuf) { heap_caps_free(s_grayBuf); s_grayBuf = nullptr; }
    if (s_xLut) { free(s_xLut); s_xLut = nullptr; }
    if (s_yLut) { free(s_yLut); s_yLut = nullptr; }
}

} // namespace P4IMX219

#else
// ============================================================================
// Fallback: no camera library available
// ============================================================================
namespace P4IMX219 {
bool Init(int, int) { Serial.println("[P4IMX219] No camera library found"); return false; }
uint8_t* CaptureFrame(int*, int*) { return nullptr; }
void ReturnFrame() {}
void Deinit() {}
}
#endif // __has_include paths

#else
// ============================================================================
// Non-P4 stubs
// ============================================================================
namespace P4IMX219 {
bool Init(int, int) { return false; }
uint8_t* CaptureFrame(int*, int*) { return nullptr; }
void ReturnFrame() {}
void Deinit() {}
}
#endif // CONFIG_IDF_TARGET_ESP32P4
