// ============================================
// TFLite Vision Code Generators for Arduino ESP32
// ============================================

const addTFLiteDefinitions = function (generator) {
    generator.definitions_['include_Mixly_TFLite'] = '#include "Mixly_TFLite/TFLiteEngine.hpp"';
    generator.definitions_['include_model_data'] = '#include "Mixly_TFLite/model_data.h"';
};

// ============================================
// CAMERA INIT
// ============================================

export const tflite_camera_init = function (_, generator) {
    addTFLiteDefinitions(generator);

    var width = generator.valueToCode(this, 'WIDTH', generator.ORDER_ATOMIC) || '96';
    var height = generator.valueToCode(this, 'HEIGHT', generator.ORDER_ATOMIC) || '96';

    generator.setups_['tflite_camera_init'] =
        '  TFLiteVision::InitCamera(' + width + ', ' + height + ');\n';

    return '';
};

// ============================================
// MODEL UPLOAD
// ============================================

export const tflite_upload_model = function (_, generator) {
    // This block's purpose is:
    // 1. Provide the UI for uploading model+labels (handled by FieldFileUpload)
    // 2. Ensure model_data.h is included (so the server knows to deploy the lib)
    addTFLiteDefinitions(generator);

    return '';
};

// ============================================
// MODEL INIT
// ============================================

export const tflite_model_init = function (_, generator) {
    addTFLiteDefinitions(generator);

    var usePSRAM = this.getFieldValue('USE_PSRAM');

    generator.setups_['tflite_model_init'] =
        '  TFLiteVision::InitModel(g_model_data, g_model_data_len, ' + usePSRAM + ');\n';

    return '';
};

// ============================================
// PREDICT
// ============================================

export const tflite_predict = function (_, generator) {
    addTFLiteDefinitions(generator);

    var resultType = this.getFieldValue('RESULT_TYPE');

    var codeMap = {
        LABEL: 'TFLiteVision::Predict().label',
        INDEX: 'TFLiteVision::Predict().classIndex',
        CONFIDENCE: 'TFLiteVision::Predict().confidence'
    };

    return [codeMap[resultType] || codeMap['LABEL'], generator.ORDER_ATOMIC];
};

// ============================================
// CLASS COUNT
// ============================================

export const tflite_get_class_count = function (_, generator) {
    addTFLiteDefinitions(generator);

    return ['TFLiteVision::GetClassCount()', generator.ORDER_ATOMIC];
};
