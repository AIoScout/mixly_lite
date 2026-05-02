import * as Blockly from 'blockly/core';
import { FieldFileUpload } from './FieldFileUpload';

const TFLITE_HUE = '#FF6F00';  // Orange for AI Vision

// ============================================
// CAMERA INIT BLOCK
// ============================================

export const tflite_camera_init = {
    init: function () {
        this.setColour(TFLITE_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.TFLITE_CAMERA_INIT || "init camera");
        this.appendValueInput("WIDTH")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.TFLITE_WIDTH || "width");
        this.appendValueInput("HEIGHT")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.TFLITE_HEIGHT || "height");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip("Initialize ESP32-S3 camera with given resolution");
    }
};

// ============================================
// MODEL UPLOAD BLOCK
// ============================================

export const tflite_upload_model = {
    init: function () {
        this.setColour(TFLITE_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.TFLITE_UPLOAD_MODEL || "load AI model");
        this.appendDummyInput('MODEL_FILE')
            .appendField(new FieldFileUpload(''), 'MODEL');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip("Upload a Teachable Machine .tflite model and labels.txt");
    }
};

// ============================================
// MODEL INIT BLOCK
// ============================================

export const tflite_model_init = {
    init: function () {
        this.setColour(TFLITE_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.TFLITE_MODEL_INIT || "init AI model");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                ["use PSRAM", "true"],
                ["use internal RAM", "false"]
            ]), "USE_PSRAM");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip("Initialize the TFLite model interpreter");
    }
};

// ============================================
// PREDICT BLOCK
// ============================================

export const tflite_predict = {
    init: function () {
        this.setColour(TFLITE_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.TFLITE_PREDICT || "AI prediction");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                ["label", "LABEL"],
                ["class index", "INDEX"],
                ["confidence", "CONFIDENCE"]
            ]), "RESULT_TYPE");
        this.setOutput(true, null);
        this.setTooltip("Capture image and run AI prediction");
    }
};

// ============================================
// CLASS COUNT BLOCK
// ============================================

export const tflite_get_class_count = {
    init: function () {
        this.setColour(TFLITE_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.TFLITE_CLASS_COUNT || "number of classes");
        this.setOutput(true, Number);
        this.setTooltip("Get total number of classes in the model");
    }
};
