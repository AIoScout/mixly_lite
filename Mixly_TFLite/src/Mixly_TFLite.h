#ifndef MIXLY_TFLITE_H
#define MIXLY_TFLITE_H

// TFLIteMicro.h is the core-bundled TFLite Micro library's declared entry
// header — including it here is what makes arduino-cli's library discovery
// pull that library in (subpath includes like tensorflow/lite/... do not
// match its `includes=` list and the build fails with missing headers).
#include <TFLIteMicro.h>

#include "Mixly_TFLite/TFLiteEngine.hpp"
#include "Mixly_TFLite/AIVision.hpp"
#include "Mixly_TFLite/model_data.h"

#endif
