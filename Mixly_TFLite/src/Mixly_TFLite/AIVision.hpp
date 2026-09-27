#ifndef MIXLY_TFLITE_AI_VISION_HPP
#define MIXLY_TFLITE_AI_VISION_HPP

// Unified AI Vision API for Mixly block coding.
// Automatically selects the correct backend based on the board:
//   - ESP32-P4 ("AI Eye"): camera capture + TFLite inference + UART send
//   - ESP32-S3 ("AI Body"): UART receive (gets results from P4)
//
// Children use the same blocks regardless of board role.
// UART communication between boards is handled internally.

namespace AIVision {

// Prediction result from inference or UART receive.
struct Prediction {
    int classIndex;
    float confidence;
    const char* label;
};

// ---- Initialization ----

// Initialize as AI Eye (P4): camera + model + UART transmitter.
// Call this on the ESP32-P4 board that has the camera.
// modelData/modelLen: compiled-in model from model_data.h
// usePSRAM: allocate tensor arena in PSRAM for larger models
bool InitEye(int width, int height,
             const unsigned char* modelData, unsigned int modelLen,
             bool usePSRAM = true);

// Initialize as AI Body (S3): UART receiver only.
// Call this on the ESP32-S3 board that receives inference results.
// modelData/modelLen: needed to map label IDs to label strings.
bool InitBody(const unsigned char* modelData, unsigned int modelLen);

// Set UART pins (call before Init if non-default pins are needed).
// Default: TX=43, RX=44.
void SetUARTPins(int txPin, int rxPin);

// ---- Prediction ----

// Run inference and return prediction.
// P4: captures frame, runs TFLite, auto-sends result via UART, returns prediction.
// S3: polls UART for new packet, returns last received result.
//      Returns {0, 0.0, "waiting"} if no result yet.
Prediction Predict();

// ---- Result access ----

// Get label string for a class index (uses model_data.h labels).
const char* GetLabel(int index);

// Get confidence for a specific class from the last prediction.
float GetConfidence(int index);

// Get total number of classes in the model.
int GetClassCount();

// Check if a new result is available.
// P4: always true after Predict() captures a frame.
// S3: true when a new UART packet has been received.
bool HasNewResult();

// Explicitly send the last prediction result via UART (P4 only).
// Predict() already auto-sends, so this is optional.
void SendResult();

} // namespace AIVision

#endif
