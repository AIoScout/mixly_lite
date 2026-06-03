import * as Blockly from 'blockly/core';
import { FieldFileUpload } from './FieldFileUpload';

const AIVISION_HUE = '#FF6F00';  // Orange for AI Vision

// ============================================
// AI EYE INIT (P4 — camera + model + UART TX)
// ============================================

export const aivision_init_eye = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_INIT_EYE || "initialize AI Eye (camera + AI)");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg.AIVISION_USE_PSRAM || "use PSRAM", "true"],
                [Blockly.Msg.AIVISION_USE_INTERNAL || "use internal RAM", "false"]
            ]), "USE_PSRAM");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_INIT_EYE_TOOLTIP || "Initialize camera, AI model, and communication on the AI Eye board");
    }
};

// ============================================
// AI BODY INIT (S3 — UART RX)
// ============================================

export const aivision_init_body = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_INIT_BODY || "initialize AI Body (receive results)");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_INIT_BODY_TOOLTIP || "Initialize as the AI Body board to receive AI results from the AI Eye");
    }
};

// ============================================
// UPLOAD MODEL
// ============================================

export const aivision_upload_model = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_UPLOAD_MODEL || "load AI model");
        this.appendDummyInput('MODEL_FILE')
            .appendField(new FieldFileUpload(''), 'MODEL');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_UPLOAD_MODEL_TOOLTIP || "Upload a .tflite model and labels file");
    }
};

// ============================================
// PREDICT
// ============================================

export const aivision_predict = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_PREDICT || "AI prediction");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg.AIVISION_PREDICT_LABEL || "label", "LABEL"],
                [Blockly.Msg.AIVISION_PREDICT_INDEX || "class index", "INDEX"],
                [Blockly.Msg.AIVISION_PREDICT_CONFIDENCE || "confidence", "CONFIDENCE"]
            ]), "RESULT_TYPE");
        this.setOutput(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_PREDICT_TOOLTIP || "Get AI prediction result");
    }
};

// ============================================
// CLASS COUNT
// ============================================

export const aivision_class_count = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_CLASS_COUNT || "number of classes");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.AIVISION_CLASS_COUNT_TOOLTIP || "Get total number of classes in the AI model");
    }
};

// ============================================
// HAS NEW RESULT
// ============================================

export const aivision_has_new_result = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_HAS_NEW_RESULT || "has new AI result");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.AIVISION_HAS_NEW_RESULT_TOOLTIP || "True when a new AI result is available");
    }
};

// ============================================
// SEND RESULT
// ============================================

export const aivision_send_result = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_SEND_RESULT || "send AI result to partner");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_SEND_RESULT_TOOLTIP || "Send the last AI prediction to the partner board (auto-sent by default)");
    }
};

// ============================================
// SET UART PINS
// ============================================

export const aivision_set_uart_pins = {
    init: function () {
        this.setColour(AIVISION_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.AIVISION_SET_UART_PINS || "set communication pins");
        this.appendValueInput("TX_PIN")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField("TX");
        this.appendValueInput("RX_PIN")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField("RX");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.AIVISION_SET_UART_PINS_TOOLTIP || "Set UART communication pins (default: TX=43, RX=44)");
    }
};
