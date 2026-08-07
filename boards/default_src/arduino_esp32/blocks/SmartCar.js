import * as Blockly from 'blockly/core';

const SMARTCAR_HUE = 290;  // Purple/magenta color for SmartCar category

// ============================================
// MOTOR BLOCKS
// ============================================

export const smartcar_move_forward = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_MOVE_FORWARD || "move forward");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_MOVE_FORWARD_TOOLTIP || "Make the car move forward");
        this.setHelpUrl("");
    }
};

export const smartcar_move_backward = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_MOVE_BACKWARD || "move backward");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_MOVE_BACKWARD_TOOLTIP || "Make the car move backward");
    }
};

export const smartcar_rotate_left = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_ROTATE_LEFT || "rotate left");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_ROTATE_LEFT_TOOLTIP || "Rotate the car left (counter-clockwise)");
    }
};

export const smartcar_rotate_right = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_ROTATE_RIGHT || "rotate right");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_ROTATE_RIGHT_TOOLTIP || "Rotate the car right (clockwise)");
    }
};

export const smartcar_stop = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_STOP || "stop");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_STOP_TOOLTIP || "Stop all motors");
    }
};

export const smartcar_set_speed = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_SET_SPEED || "set motor speed");
        this.appendValueInput("SPEED")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_SPEED || "speed (0-4095)");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_SET_SPEED_TOOLTIP || "Set the speed for both motors (0-4095 PWM duty cycle)");
    }
};

// ============================================
// IR SENSOR BLOCKS
// ============================================

export const ir_data_updata = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_IR_DATA_UPDATA || "IR data update");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_IR_DATA_UPDATA_TOOLTIP || "Read IR sensors and update the cached IR data");
    }
};

export const smartcar_read_ir_left = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_READ_IR_LEFT || "IR left sensor");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_READ_IR_LEFT_TOOLTIP || "Read left IR sensor (true = black line detected)");
    }
};

export const smartcar_read_ir_middle = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_READ_IR_MIDDLE || "IR middle sensor");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_READ_IR_MIDDLE_TOOLTIP || "Read middle IR sensor (true = black line detected)");
    }
};

export const smartcar_read_ir_right = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_READ_IR_RIGHT || "IR right sensor");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_READ_IR_RIGHT_TOOLTIP || "Read right IR sensor (true = black line detected)");
    }
};

export const smartcar_get_track_state = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_TRACK_STATE || "track state");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_TRACK_STATE_TOOLTIP || "Get current track state (0-7)");
    }
};

// ============================================
// ULTRASONIC SENSOR BLOCKS
// ============================================

export const smartcar_get_distance_cm = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_DISTANCE || "distance (cm)");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_DISTANCE_TOOLTIP || "Get distance from ultrasonic sensor in centimeters");
    }
};

// ============================================
// RFID BLOCKS
// ============================================

export const smartcar_read_rfid_tag = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_READ_RFID || "RFID tag UID");
        this.setOutput(true, String);
        this.setTooltip(Blockly.Msg.SMARTCAR_READ_RFID_TOOLTIP || "Read the current RFID tag UID");
    }
};

export const smartcar_has_new_tag = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_HAS_NEW_TAG || "has new RFID tag");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_HAS_NEW_TAG_TOOLTIP || "Check if a new RFID tag is present");
    }
};

export const smartcar_rfid_update = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_RFID_UPDATE || "RFID update");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_RFID_UPDATE_TOOLTIP || "Read the RFID card serial data and Returns true if a UID could be read");
    }
};

// ============================================
// BUZZER BLOCKS
// ============================================

export const smartcar_play_tone = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_PLAY_TONE || "play tone");
        this.appendValueInput("FREQUENCY")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_FREQUENCY || "frequency (Hz)");
        this.appendValueInput("DURATION")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_DURATION || "duration (ms)");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_PLAY_TONE_TOOLTIP || "Play a tone on the buzzer");
    }
};

export const smartcar_buzzer_stop = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_BUZZER_STOP || "stop buzzer");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_BUZZER_STOP_TOOLTIP || "Stop the buzzer");
    }
};

// ============================================
// FIREBASE BLOCKS
// ============================================

export const smartcar_is_exam_activated = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_IS_EXAM_ACTIVATED || "exam is activated");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_IS_EXAM_ACTIVATED_TOOLTIP || "Check if the exam is currently activated");
    }
};

export const smartcar_get_traffic_light_state = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_TRAFFIC_LIGHT || "traffic light");
        this.appendValueInput("LIGHT_ID")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_LIGHT_ID || "ID");
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_STATE || "state");
        this.setInputsInline(true);
        this.setOutput(true, String);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_TRAFFIC_LIGHT_TOOLTIP || "Get traffic light state (RED, YELLOW, GREEN)");
    }
};

export const smartcar_get_time_remain = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_TRAFFIC_LIGHT || "traffic light");
        this.appendValueInput("LIGHT_ID")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_LIGHT_ID || "ID");
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_TIME_REMAIN || "time remain");
        this.setInputsInline(true);
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_TIME_REMAIN_TOOLTIP || "Get time remaining for traffic light");
    }
};

// ============================================
// PID CONTROL BLOCKS
// ============================================

export const smartcar_set_pid_gains = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_SET_PID || "set PID gains");
        this.appendValueInput("KP")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField("Kp");
        this.appendValueInput("KI")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField("Ki");
        this.appendValueInput("KD")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField("Kd");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_SET_PID_TOOLTIP || "Set PID controller gains for both wheels");
    }
};

export const smartcar_get_left_rpm = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_LEFT_RPM || "left wheel RPM");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_LEFT_RPM_TOOLTIP || "Get current RPM of left wheel");
    }
};

export const smartcar_get_right_rpm = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_GET_RIGHT_RPM || "right wheel RPM");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_GET_RIGHT_RPM_TOOLTIP || "Get current RPM of right wheel");
    }
};

export const smartcar_set_target_rpm = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_SET_TARGET_RPM || "set target RPM");
        this.appendValueInput("TARGET")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_TARGET || "RPM");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_SET_TARGET_RPM_TOOLTIP || "Set target RPM for both wheels");
    }
};

export const smartcar_pid_update_loop = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_PID_UPDATE_LOOP || "PID update loop");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_PID_UPDATE_LOOP_TOOLTIP || "Update encoder RPM and apply PID output to both wheel speeds");
    }
};
