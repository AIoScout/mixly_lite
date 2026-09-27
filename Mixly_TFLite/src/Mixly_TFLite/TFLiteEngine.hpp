#ifndef MIXLY_TFLITE_ENGINE_HPP
#define MIXLY_TFLITE_ENGINE_HPP

#include "CameraCapture.hpp"

namespace TFLiteVision {

struct Prediction {
    int classIndex;
    float confidence;
    const char* label;
};

// Initialize TFLite interpreter with compiled-in model data.
// modelData: pointer to g_model_data array (from model_data.h)
// modelLen:  g_model_data_len
// usePSRAM:  allocate tensor arena in PSRAM for larger models
bool InitModel(const unsigned char* modelData, unsigned int modelLen,
               bool usePSRAM = true);

// Capture frame, preprocess, and run inference. Returns top prediction.
Prediction Predict();

// Get label string for a class index.
const char* GetLabel(int index);

// Get confidence for a specific class from the last Predict() call.
float GetConfidence(int index);

// Get total number of classes in the model.
int GetClassCount();

} // namespace TFLiteVision

#endif
