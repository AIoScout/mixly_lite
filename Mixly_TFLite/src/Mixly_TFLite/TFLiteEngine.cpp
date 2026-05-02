#include "TFLiteEngine.hpp"
#include "ImagePreprocessor.hpp"
#include "model_data.h"

#if defined(ESP32)
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/all_ops_resolver.h"
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

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(s_model, resolver, s_arena, arenaSize);
    s_interpreter = &static_interpreter;

    if (s_interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("[TFLite] AllocateTensors failed");
        return false;
    }

    TfLiteTensor* output = s_interpreter->output(0);
    s_lastClassCount = output->dims->data[output->dims->size - 1];
    if (s_lastClassCount > 64) s_lastClassCount = 64;

    Serial.print("[TFLite] Model loaded, ");
    Serial.print(s_lastClassCount);
    Serial.println(" classes");
    return true;
}

Prediction Predict() {
    Prediction pred = {0, 0.0f, "unknown"};

    if (!s_interpreter) return pred;

    int camW = 0, camH = 0;
    uint8_t* frameBuf = CaptureFrame(&camW, &camH);
    if (!frameBuf) return pred;

    TfLiteTensor* input = s_interpreter->input(0);
    int inputH = input->dim(1);
    int inputW = input->dim(2);

    float* inputData = input->data.f;
    PreprocessFrame(frameBuf, inputData, inputW, inputH, camW, camH);

    ReturnFrame(frameBuf);

    if (s_interpreter->Invoke() != kTfLiteOk) {
        Serial.println("[TFLite] Invoke failed");
        return pred;
    }

    TfLiteTensor* output = s_interpreter->output(0);
    int bestIdx = 0;
    float bestVal = output->data.f[0];
    for (int i = 0; i < s_lastClassCount; i++) {
        s_lastOutput[i] = output->data.f[i];
        if (output->data.f[i] > bestVal) {
            bestVal = output->data.f[i];
            bestIdx = i;
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
