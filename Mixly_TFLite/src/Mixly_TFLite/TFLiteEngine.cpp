#include <Arduino.h>
#include "TFLiteEngine.hpp"

#if defined(ESP32)
#include "ImagePreprocessor.hpp"
#include "CameraCapture.hpp"
#include "model_data.h"
#include "SignPreprocess.hpp"
// Pull in the core-bundled TFLite Micro library by its declared entry header
// so arduino-cli's dependency resolver adds it (the tensorflow/lite/...
// subpath includes below do not match its `includes=` list).
#include <TFLIteMicro.h>
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/micro/system_setup.h"

#if CONFIG_SPIRAM_SUPPORT
#include "esp32-hal-psram.h"
#define TFLITE_USE_PSRAM 1
#else
#define TFLITE_USE_PSRAM 0
#endif

namespace TFLiteVision {

static const tflite::Model* s_model = nullptr;
static tflite::MicroInterpreter* s_interpreter = nullptr;
static uint8_t* s_arena = nullptr;
static constexpr int kArenaSizePSRAM = 1024 * 1024;
static constexpr int kArenaSizeInternal = 128 * 1024;
static float s_lastOutput[64] = {};
static int s_lastClassCount = 0;

// Training-app crop pipeline (sign/junction/manual), armed when the baked
// g_preprocess_mode in model_data.h is non-zero. Scratch is sized lazily on
// the first captured frame.
static SignPreprocess s_signPreprocess;
static bool s_signPpOomWarned = false;

bool InitModel(const unsigned char* modelData, unsigned int modelLen, bool usePSRAM) {
    tflite::InitializeTarget();

    s_model = tflite::GetModel(modelData);
    if (!s_model) {
        Serial.println("[TFLite] Failed to load model");
        return false;
    }

    int arenaSize = (usePSRAM && TFLITE_USE_PSRAM) ? kArenaSizePSRAM : kArenaSizeInternal;

    if (usePSRAM && TFLITE_USE_PSRAM) {
        s_arena = reinterpret_cast<uint8_t*>(ps_malloc(arenaSize));
        if (!s_arena) {
            Serial.println("[TFLite] PSRAM allocation failed, falling back to internal RAM");
            s_arena = reinterpret_cast<uint8_t*>(malloc(kArenaSizeInternal));
            arenaSize = kArenaSizeInternal;
        }
    } else {
        s_arena = reinterpret_cast<uint8_t*>(malloc(arenaSize));
    }

    if (!s_arena) {
        Serial.println("[TFLite] Arena allocation failed");
        return false;
    }

    // The esp32 3.3.x core's TFLM fork removed AllOpsResolver — register the
    // ops our int8 CNN models use explicitly (conv / depthwise / pooling /
    // reshape / dense / softmax + quantize bridges, plus a couple of spares).
    static tflite::MicroMutableOpResolver<10> resolver;
    resolver.AddQuantize();
    resolver.AddDequantize();
    resolver.AddConv2D();
    resolver.AddDepthwiseConv2D();
    resolver.AddMaxPool2D();
    resolver.AddAveragePool2D();
    resolver.AddReshape();
    resolver.AddFullyConnected();
    resolver.AddSoftmax();
    resolver.AddLogSoftmax();
    static tflite::MicroInterpreter static_interpreter(s_model, resolver, s_arena, arenaSize);
    s_interpreter = &static_interpreter;

    if (s_interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("[TFLite] AllocateTensors failed");
        return false;
    }

    TfLiteTensor* output = s_interpreter->output(0);
    s_lastClassCount = output->dims->data[output->dims->size - 1];
    if (s_lastClassCount > 64) s_lastClassCount = 64;

    TfLiteTensor* input = s_interpreter->input(0);
    Serial.print("[TFLite] Model loaded, ");
    Serial.print(s_lastClassCount);
    Serial.print(" classes, input type=");
    Serial.println(input->type == kTfLiteInt8 ? "int8" : "float");
    return true;
}

Prediction Predict() {
    Prediction pred = {0, 0.0f, "unknown"};

    if (!s_interpreter) return pred;

    int camW = 0, camH = 0, camBpp = 2;
    uint8_t* frameBuf = CaptureFrame(&camW, &camH, &camBpp);
    if (!frameBuf) return pred;

    TfLiteTensor* input = s_interpreter->input(0);
    int inputH = input->dims->data[1];
    int inputW = input->dims->data[2];

    // Fill input tensor based on its type
    if (input->type == kTfLiteInt8) {
        // Int8 quantized input
        int8_t* inputData = input->data.int8;

        // ── Training-app crop pipeline ──────────────────────────────────
        // Models exported through the training app carry their class filter
        // settings in model_data.h; mode 0 (or a scratch allocation failure)
        // keeps the legacy full-frame behavior.
        const int side = (camW > camH ? camW : camH);
        bool usePipeline = false;
        if (g_preprocess_mode != 0) {
            if (!s_signPreprocess.ready() || s_signPreprocess.maxSide() < side) {
                s_signPreprocess.end();
                if (!s_signPreprocess.begin(side)) {
                    if (!s_signPpOomWarned) {
                        Serial.println("[TFLite] preprocess scratch alloc failed — full-frame fallback");
                        s_signPpOomWarned = true;
                    }
                }
            }
            usePipeline = s_signPreprocess.ready();
        }
        if (usePipeline) {
            const int mode = g_preprocess_mode;
            if (camBpp == 1) {
                // P4 IMX219 grayscale path
                CropBox box;
                bool pad = false;
                if (mode == 1) {
                    box = s_signPreprocess.findSignCrop(frameBuf, camW, camH,
                                                        g_preprocess_dark, g_preprocess_lum);
                } else if (mode == 2) {
                    box = SignPreprocess::junctionCrop(camW, camH);
                    pad = true;
                } else {
                    box = SignPreprocess::manualCrop(g_preprocess_roi, camW, camH);
                }
                if (pad) {
                    s_signPreprocess.cropResizePadBilinearGray(frameBuf, camW, camH, box, inputW, inputData);
                } else {
                    s_signPreprocess.cropResizeBilinearGray(frameBuf, camW, camH, box, inputW, inputH, inputData);
                }
                SignPreprocess::contrastStretchInt8(inputData, inputW * inputH);
            } else {
                // S3 DVP RGB565 path: G channel drives the mask/search
                // (host uses the G channel too), BT.601 luma for the final
                // crop — both at camera resolution.
                static uint8_t* rgb888 = nullptr;
                static uint8_t* gch = nullptr;
                static int bufSide = 0;
                if (bufSide < side) {
                    free(rgb888); free(gch);
                    rgb888 = (uint8_t*)((TFLITE_USE_PSRAM ? ps_malloc : malloc)((size_t)side * side * 3));
                    gch = (uint8_t*)((TFLITE_USE_PSRAM ? ps_malloc : malloc)((size_t)side * side));
                    bufSide = (rgb888 && gch) ? side : 0;
                }
                if (bufSide == side) {
                    auto* srcPixels = reinterpret_cast<const uint16_t*>(frameBuf);
                    for (int i = 0; i < camW * camH; i++) {
                        uint16_t pixel = srcPixels[i];
                        rgb888[i * 3 + 0] = (uint8_t)(((pixel >> 11) & 0x1F) << 3);
                        rgb888[i * 3 + 1] = (uint8_t)(((pixel >> 5) & 0x3F) << 2);
                        rgb888[i * 3 + 2] = (uint8_t)((pixel & 0x1F) << 3);
                        gch[i] = rgb888[i * 3 + 1];
                    }
                    CropBox box;
                    bool pad = false;
                    if (mode == 1) {
                        box = s_signPreprocess.findSignCrop(gch, camW, camH,
                                                            g_preprocess_dark, g_preprocess_lum);
                    } else if (mode == 2) {
                        box = SignPreprocess::junctionCrop(camW, camH);
                        pad = true;
                    } else {
                        box = SignPreprocess::manualCrop(g_preprocess_roi, camW, camH);
                    }
                    if (pad) {
                        s_signPreprocess.cropResizePadBilinearRgb(rgb888, camW, camH, box, inputW, inputData);
                    } else {
                        s_signPreprocess.cropResizeBilinearRgb(rgb888, camW, camH, box, inputW, inputH, inputData);
                    }
                    SignPreprocess::contrastStretchInt8(inputData, inputH * inputW);
                } else {
                    usePipeline = false;  // rgb565 scratch alloc failed — legacy fill
                }
            }
        }
        if (!usePipeline) {
            if (camBpp == 1) {
                // Grayscale input (P4 IMX219) — direct to int8
                PreprocessGrayscaleToInt8(frameBuf, inputData, inputW * inputH);
            } else {
                // RGB565 input (S3 DVP) — convert to grayscale first, then int8
                // For now, use the float path and re-quantize
                // This handles the case where an int8 model is used with an RGB565 camera
                int pixelCount = inputW * inputH;
                float* floatBuf = new float[pixelCount];
                PreprocessFrame(frameBuf, (float*)nullptr, inputW, inputH, camW, camH);
                // Convert RGB565 to grayscale then to int8
                auto* srcPixels = reinterpret_cast<const uint16_t*>(frameBuf);
                float xRatio = static_cast<float>(camW) / inputW;
                float yRatio = static_cast<float>(camH) / inputH;
                for (int y = 0; y < inputH; y++) {
                    int srcY = static_cast<int>(y * yRatio);
                    if (srcY >= camH) srcY = camH - 1;
                    for (int x = 0; x < inputW; x++) {
                        int srcX = static_cast<int>(x * xRatio);
                        if (srcX >= camW) srcX = camW - 1;
                        uint16_t pixel = srcPixels[srcY * camW + srcX];
                        uint8_t r, g, b;
                        // Inline RGB565 extraction + luminance
                        r = ((pixel >> 11) & 0x1F) << 3;
                        g = ((pixel >> 5) & 0x3F) << 2;
                        b = (pixel & 0x1F) << 3;
                        uint8_t gray = (uint8_t)(((uint16_t)r * 30 + (uint16_t)g * 59 + (uint16_t)b * 11) / 100);
                        inputData[y * inputW + x] = static_cast<int8_t>((int)gray - 128);
                    }
                }
                delete[] floatBuf;
            }
        }
    } else {
        // Float input (original Teachable Machine models)
        float* inputData = input->data.f;
        PreprocessFrame(frameBuf, inputData, inputW, inputH, camW, camH);
    }

    ReturnFrame(frameBuf);

    if (s_interpreter->Invoke() != kTfLiteOk) {
        Serial.println("[TFLite] Invoke failed");
        return pred;
    }

    // Read output tensor
    TfLiteTensor* output = s_interpreter->output(0);
    int bestIdx = 0;
    float bestVal = -1e9f;

    if (output->type == kTfLiteInt8) {
        // Int8 quantized output — dequantize
        float scale = output->params.scale;
        int zeroPoint = output->params.zero_point;
        for (int i = 0; i < s_lastClassCount; i++) {
            float val = (output->data.int8[i] - zeroPoint) * scale;
            s_lastOutput[i] = val;
            if (val > bestVal) {
                bestVal = val;
                bestIdx = i;
            }
        }
    } else {
        // Float output
        bestVal = output->data.f[0];
        for (int i = 0; i < s_lastClassCount; i++) {
            s_lastOutput[i] = output->data.f[i];
            if (output->data.f[i] > bestVal) {
                bestVal = output->data.f[i];
                bestIdx = i;
            }
        }
    }

    pred.classIndex = bestIdx;
    pred.confidence = bestVal;
    pred.label = GetLabel(bestIdx);

    return pred;
}

const char* GetLabel(int index) {
    if (index >= 0 && index < (int)g_labels_count) {
        return g_labels[index];
    }
    return "unknown";
}

float GetConfidence(int index) {
    if (index >= 0 && index < s_lastClassCount) {
        return s_lastOutput[index];
    }
    return 0.0f;
}

int GetClassCount() {
    return s_lastClassCount;
}

} // namespace TFLiteVision

#else
namespace TFLiteVision {
bool InitModel(const unsigned char*, unsigned int, bool) { return false; }
Prediction Predict() { return {0, 0.0f, "unknown"}; }
const char* GetLabel(int) { return "unknown"; }
float GetConfidence(int) { return 0.0f; }
int GetClassCount() { return 0; }
}
#endif
