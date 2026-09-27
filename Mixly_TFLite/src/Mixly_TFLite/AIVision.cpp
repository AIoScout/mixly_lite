#include "AIVision.hpp"

#if defined(CONFIG_IDF_TARGET_ESP32P4)
// ============================================================================
// AI Eye: ESP32-P4 (camera + inference + UART send)
// ============================================================================
#include "TFLiteEngine.hpp"
#include "CameraCapture.hpp"
#include "UARTBridge.hpp"
#include "model_data.h"

namespace AIVision {

static int s_uartTx = 43;
static int s_uartRx = 44;
static bool s_initialized = false;
static Prediction s_lastPred = {0, 0.0f, "unknown"};
static bool s_hasNew = false;
static uint16_t s_frameId = 0;

void SetUARTPins(int txPin, int rxPin) {
    s_uartTx = txPin;
    s_uartRx = rxPin;
}

bool InitEye(int width, int height,
             const unsigned char* modelData, unsigned int modelLen,
             bool usePSRAM) {
    if (!InitCamera(width, height)) {
        Serial.println("[AIVision] Camera init failed");
        return false;
    }
    if (!TFLiteVision::InitModel(modelData, modelLen, usePSRAM)) {
        Serial.println("[AIVision] Model init failed");
        return false;
    }
    if (!UARTBridge::InitTX(s_uartTx, s_uartRx)) {
        Serial.println("[AIVision] UART TX init failed");
        return false;
    }
    s_initialized = true;
    Serial.println("[AIVision] AI Eye ready (P4 + camera + UART TX)");
    return true;
}

bool InitBody(const unsigned char* modelData, unsigned int modelLen) {
    // P4 should not be used as body, but handle gracefully
    Serial.println("[AIVision] Warning: P4 board used as AI Body (no UART RX role)");
    s_initialized = true;
    return true;
}

Prediction Predict() {
    if (!s_initialized) return {0, 0.0f, "not initialized"};

    s_lastPred = TFLiteVision::Predict();
    s_hasNew = true;
    s_frameId++;

    // Auto-send result via UART
    UARTBridge::SendResult(s_lastPred.classIndex, s_lastPred.confidence, s_frameId);

    return s_lastPred;
}

const char* GetLabel(int index) {
    return TFLiteVision::GetLabel(index);
}

float GetConfidence(int index) {
    return TFLiteVision::GetConfidence(index);
}

int GetClassCount() {
    return TFLiteVision::GetClassCount();
}

bool HasNewResult() {
    return s_hasNew;
}

void SendResult() {
    UARTBridge::SendResult(s_lastPred.classIndex, s_lastPred.confidence, s_frameId);
}

} // namespace AIVision

#elif defined(ESP32)
// ============================================================================
// AI Body: ESP32-S3 (UART receive) or standalone S3 inference
// ============================================================================
#include "TFLiteEngine.hpp"
#include "CameraCapture.hpp"
#include "UARTBridge.hpp"
#include "model_data.h"

namespace AIVision {

static int s_uartTx = 43;
static int s_uartRx = 44;
static bool s_initialized = false;
static bool s_isEye = false;
static bool s_isBody = false;
static Prediction s_lastPred = {0, 0.0f, "waiting"};
static bool s_hasNew = false;

void SetUARTPins(int txPin, int rxPin) {
    s_uartTx = txPin;
    s_uartRx = rxPin;
}

bool InitEye(int width, int height,
             const unsigned char* modelData, unsigned int modelLen,
             bool usePSRAM) {
    // S3 can also act as AI Eye with its own camera
    if (!InitCamera(width, height)) {
        Serial.println("[AIVision] Camera init failed");
        return false;
    }
    if (!TFLiteVision::InitModel(modelData, modelLen, usePSRAM)) {
        Serial.println("[AIVision] Model init failed");
        return false;
    }
    s_isEye = true;
    s_initialized = true;
    Serial.println("[AIVision] AI Eye ready (S3 + camera + inference)");
    return true;
}

bool InitBody(const unsigned char* modelData, unsigned int modelLen) {
    // S3 as AI Body: receive results from P4 via UART
    // We still need model data for label lookup
    // Store reference for label resolution (model_data.h globals)
    if (!UARTBridge::InitRX(s_uartRx, s_uartTx)) {
        Serial.println("[AIVision] UART RX init failed");
        return false;
    }
    s_isBody = true;
    s_initialized = true;
    Serial.println("[AIVision] AI Body ready (S3 + UART RX)");
    return true;
}

Prediction Predict() {
    if (!s_initialized) return {0, 0.0f, "not initialized"};

    if (s_isEye) {
        // S3 with camera: run inference locally
        s_lastPred = TFLiteVision::Predict();
        s_hasNew = true;
        return s_lastPred;
    }

    if (s_isBody) {
        // S3 as receiver: poll UART for new results
        if (UARTBridge::Update()) {
            int labelId = UARTBridge::GetLabelId();
            s_lastPred.classIndex = labelId;
            s_lastPred.confidence = UARTBridge::GetConfidence();
            s_lastPred.label = TFLiteVision::GetLabel(labelId);
            s_hasNew = true;
        }
        return s_lastPred;
    }

    return s_lastPred;
}

const char* GetLabel(int index) {
    return TFLiteVision::GetLabel(index);
}

float GetConfidence(int index) {
    return TFLiteVision::GetConfidence(index);
}

int GetClassCount() {
    return TFLiteVision::GetClassCount();
}

bool HasNewResult() {
    // S3 body: poll UART for new packets before checking
    if (s_isBody && !s_hasNew) {
        if (UARTBridge::Update()) {
            int labelId = UARTBridge::GetLabelId();
            s_lastPred.classIndex = labelId;
            s_lastPred.confidence = UARTBridge::GetConfidence();
            s_lastPred.label = TFLiteVision::GetLabel(labelId);
            s_hasNew = true;
        }
    }
    bool result = s_hasNew;
    s_hasNew = false;
    return result;
}

void SendResult() {
    // S3 Eye mode doesn't auto-send via UART (no partner to send to)
    // But support explicit send if UART is initialized
}

} // namespace AIVision

#else
// ============================================================================
// Fallback stubs
// ============================================================================
namespace AIVision {
void SetUARTPins(int, int) {}
bool InitEye(int, int, const unsigned char*, unsigned int, bool) { return false; }
bool InitBody(const unsigned char*, unsigned int) { return false; }
Prediction Predict() { return {0, 0.0f, "unsupported"}; }
const char* GetLabel(int) { return "unsupported"; }
float GetConfidence(int) { return 0.0f; }
int GetClassCount() { return 0; }
bool HasNewResult() { return false; }
void SendResult() {}
}
#endif
