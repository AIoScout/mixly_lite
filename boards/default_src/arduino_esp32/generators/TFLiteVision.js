// ============================================
// AI Vision Code Generators for Arduino ESP32
// ============================================

const addAIVisionDefinitions = function (generator) {
    generator.definitions_['include_AIVision'] = '#include "Mixly_TFLite/AIVision.hpp"';
    generator.definitions_['include_model_data'] = '#include "Mixly_TFLite/model_data.h"';
};

// ============================================
// AI EYE INIT
// ============================================

export const aivision_init_eye = function (_, generator) {
    addAIVisionDefinitions(generator);

    var usePSRAM = this.getFieldValue('USE_PSRAM');

    generator.setups_['aivision_init'] =
        '  AIVision::InitEye(96, 96, g_model_data, g_model_data_len, ' + usePSRAM + ');\n';

    return '';
};

// ============================================
// AI BODY INIT
// ============================================

export const aivision_init_body = function (_, generator) {
    addAIVisionDefinitions(generator);

    generator.setups_['aivision_init'] =
        '  AIVision::InitBody(g_model_data, g_model_data_len);\n';

    return '';
};

// ============================================
// UPLOAD MODEL
// ============================================

export const aivision_upload_model = function (_, generator) {
    // Provides UI for uploading model+labels (handled by FieldFileUpload).
    // Ensures model_data.h is included so the server knows to deploy the lib.
    addAIVisionDefinitions(generator);

    return '';
};

// ============================================
// PREDICT
// ============================================

export const aivision_predict = function (_, generator) {
    addAIVisionDefinitions(generator);

    var resultType = this.getFieldValue('RESULT_TYPE');

    var codeMap = {
        LABEL: 'AIVision::Predict().label',
        INDEX: 'AIVision::Predict().classIndex',
        CONFIDENCE: 'AIVision::Predict().confidence'
    };

    return [codeMap[resultType] || codeMap['LABEL'], generator.ORDER_ATOMIC];
};

// ============================================
// CLASS COUNT
// ============================================

export const aivision_class_count = function (_, generator) {
    addAIVisionDefinitions(generator);

    return ['AIVision::GetClassCount()', generator.ORDER_ATOMIC];
};

// ============================================
// HAS NEW RESULT
// ============================================

export const aivision_has_new_result = function (_, generator) {
    addAIVisionDefinitions(generator);

    return ['AIVision::HasNewResult()', generator.ORDER_ATOMIC];
};

// ============================================
// SEND RESULT
// ============================================

export const aivision_send_result = function (_, generator) {
    addAIVisionDefinitions(generator);

    return 'AIVision::SendResult();\n';
};

// ============================================
// SET UART PINS
// ============================================

export const aivision_set_uart_pins = function (_, generator) {
    addAIVisionDefinitions(generator);

    var txPin = generator.valueToCode(this, 'TX_PIN', generator.ORDER_ATOMIC) || '43';
    var rxPin = generator.valueToCode(this, 'RX_PIN', generator.ORDER_ATOMIC) || '44';

    generator.setups_['aivision_uart_pins'] =
        '  AIVision::SetUARTPins(' + txPin + ', ' + rxPin + ');\n';

    return '';
};
