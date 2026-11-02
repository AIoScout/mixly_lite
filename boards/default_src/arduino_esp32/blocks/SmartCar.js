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

// ============================================
// P4 UART LINK BLOCKS (road-sign recognition)
// ============================================

export const smartcar_p4_start_link = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_START_LINK || "P4 link start (road-sign)");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_START_LINK_TOOLTIP || "Open the UART link to the AI Eye (P4) board and start receiving road-sign results in the background. Use in setup. Add a serial block (115200 baud) to see detection logs.");
    }
};

export const smartcar_p4_wait_sign_confirmed = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_WAIT_SIGN || "P4 wait until sign confirmed");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_WAIT_SIGN_TOOLTIP || "Start a fresh voting session and wait (blocking) until the AI Eye board confirms one road sign. Stop the car first. Follow with the confirmed-class / confidence blocks, then end the session.");
    }
};

export const smartcar_p4_confirmed_label = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_CONFIRMED_LABEL || "P4 confirmed class #");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_CONFIRMED_LABEL_TOOLTIP || "Class number of the confirmed sign. Class numbers follow the class order in the AI Training app (0, 1, 2, ...).");
    }
};

export const smartcar_p4_sign_is_class = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_SIGN_IS || "P4 confirmed sign is class");
        this.appendValueInput("CLASS")
            .setCheck(Number);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_SIGN_IS_TAIL || "");
        this.setInputsInline(true);
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_SIGN_IS_TOOLTIP || "True when the confirmed sign's class number equals the given number. Class numbers follow the class order in the AI Training app.");
    }
};

export const smartcar_p4_confirmed_confidence = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_CONFIRMED_CONF || "P4 confirmed confidence");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_CONFIRMED_CONF_TOOLTIP || "Confidence of the confirmed sign, 0-255.");
    }
};

export const smartcar_p4_end_decision = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_END_DECISION || "P4 end decision session");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_END_DECISION_TOOLTIP || "End the voting session and let the AI Eye board resume sending results. Call after finishing the sign manoeuvre.");
    }
};

// ============================================
// LINE FOLLOWING COMPOSITE BLOCKS
// ============================================

export const smartcar_ir_all_black = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_IR_ALL_BLACK || "all-black on line");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_IR_ALL_BLACK_TOOLTIP || "True when all three line sensors see black (a stop marker). Update the IR sensors first.");
    }
};

export const smartcar_follow_line_until_stop = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_FOLLOW_UNTIL || "follow line until");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg.SMARTCAR_STOP_ALL_BLACK || "all-black marker", "allblack"],
                [Blockly.Msg.SMARTCAR_STOP_ALL_BLACK_OR_RFID || "all-black marker or RFID tag", "allblack_rfid"],
                [Blockly.Msg.SMARTCAR_STOP_ULTRASONIC || "ultrasonic obstacle", "ultrasonic"]
            ]), "TRIGGER");
        this.appendValueInput("DIST")
            .setCheck(Number)
            .appendField(Blockly.Msg.SMARTCAR_STOP_DISTANCE || "cm");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_FOLLOW_UNTIL_TOOLTIP || "Follow the line with PID speed control until the stop trigger fires, then stop the car and continue with the next blocks (e.g. buzzer, then P4 wait until sign confirmed).");
    }
};

export const smartcar_wait_until_centered = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_WAIT_CENTERED || "wait until centered on line");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_WAIT_CENTERED_TOOLTIP || "Wait until the car is centered on the line again (after a turn). Also stops if a stop trigger fires. Use together with the follow-line-until block.");
    }
};

// ============================================
// OBSTACLE / RFID / LEFT-MOTOR / PLATE BLOCKS
// ============================================

export const smartcar_obstacle_wait_clear = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_OBSTACLE_WAIT || "wait until obstacle clears");
        this.appendValueInput("RESUME_CM")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_OBSTACLE_RESUME || "resume beyond cm");
        this.appendValueInput("TIMEOUT_S")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_OBSTACLE_TIMEOUT || "timeout s");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_OBSTACLE_WAIT_TOOLTIP || "Wait (car stopped) until the distance grows beyond the resume value, or the timeout elapses. Check distance roughly every 100 ms.");
    }
};

export const smartcar_rfid_report_new_tag = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_RFID_REPORT || "report new RFID tag");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_RFID_REPORT_TOOLTIP || "Check the RFID reader once and print the tag UID to Serial when a new (different) tag appears. Call repeatedly, e.g. in the loop.");
    }
};

export const smartcar_left_motor_run = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_LEFT_MOTOR || "left motor");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Msg.SMARTCAR_CLOCKWISE || "clockwise", "cw"],
                [Blockly.Msg.SMARTCAR_ANTICLOCKWISE || "anticlockwise", "acw"]
            ]), "DIR");
        this.appendValueInput("DUTY")
            .setCheck(Number)
            .appendField(Blockly.Msg.SMARTCAR_DUTY || "duty %");
        this.appendValueInput("DURATION")
            .setCheck(Number)
            .appendField(Blockly.Msg.SMARTCAR_FOR_MS || "for ms");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_LEFT_MOTOR_TOOLTIP || "Run only the left motor in the given direction at a PWM duty percentage for the given time, then brake. The right motor stays stopped.");
    }
};

export const smartcar_left_motor_sequence = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_LEFT_SEQUENCE || "left motor startup sequence");
        this.appendValueInput("DUTY")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_DUTY || "duty %");
        this.appendValueInput("CW_MS")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_CW_MS || "clockwise ms");
        this.appendValueInput("PAUSE_MS")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_PAUSE_MS || "pause ms");
        this.appendValueInput("ACW_MS")
            .setCheck(Number)
            .setAlign(Blockly.inputs.Align.RIGHT)
            .appendField(Blockly.Msg.SMARTCAR_ACW_MS || "anticlockwise ms");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_LEFT_SEQUENCE_TOOLTIP || "The turnstile startup routine: clockwise, brake+pause, anticlockwise, brake — all on the left motor at one duty setting.");
    }
};

export const smartcar_p4_plate_start_link = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_PLATE_START || "P4 link start (licence plate)");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_PLATE_START_TOOLTIP || "Open the UART link to the AI Eye (P4) board running the multi-plate firmware. Use in setup; add a serial block (115200 baud) to see detection logs.");
    }
};

export const smartcar_p4_plate_update = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_PLATE_UPDATE || "P4 plate update");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_PLATE_UPDATE_TOOLTIP || "Process incoming licence-plate packets once. Call every loop.");
    }
};

export const smartcar_p4_plate_ready = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_PLATE_READY || "P4 plate confirmed?");
        this.setOutput(true, Boolean);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_PLATE_READY_TOOLTIP || "True when the same plate has been confirmed three frames in a row (confidence 120+). Do the action, then call the action-done block.");
    }
};

export const smartcar_p4_plate_action_done = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_PLATE_DONE || "P4 plate action done");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_PLATE_DONE_TOOLTIP || "Tell the AI Eye board the plate action finished so it resumes sending results. Call after the manoeuvre.");
    }
};

export const smartcar_p4_plate_latest_index = {
    init: function () {
        this.setColour(SMARTCAR_HUE);
        this.appendDummyInput()
            .appendField(Blockly.Msg.SMARTCAR_P4_PLATE_INDEX || "P4 latest plate #");
        this.setOutput(true, Number);
        this.setTooltip(Blockly.Msg.SMARTCAR_P4_PLATE_INDEX_TOOLTIP || "Plate index (0-253) of the latest valid packet, or 255 when no plate is visible.");
    }
};
