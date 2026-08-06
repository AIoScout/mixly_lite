// MicroPython Generators for SmartCar

// ============================================
// MOTOR GENERATORS
// ============================================

export const smartcar_move_forward = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    generator.definitions_['smartcar_init_motors'] = 'Movement.init_motors()';
    return 'Movement.move_forward()\n';
}

export const smartcar_move_backward = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    generator.definitions_['smartcar_init_motors'] = 'Movement.init_motors()';
    return 'Movement.move_backward()\n';
}

export const smartcar_rotate_left = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    generator.definitions_['smartcar_init_motors'] = 'Movement.init_motors()';
    return 'Movement.rotate_left()\n';
}

export const smartcar_rotate_right = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    generator.definitions_['smartcar_init_motors'] = 'Movement.init_motors()';
    return 'Movement.rotate_right()\n';
}

export const smartcar_stop = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    return 'Movement.stop()\n';
}

export const smartcar_set_speed = function (_, generator) {
    generator.definitions_['import_smartcar_movement'] = 'from smartcar import Movement';
    var speed = generator.valueToCode(this, 'SPEED', generator.ORDER_ATOMIC);
    return 'Movement.set_speed(' + speed + ')\n';
}

// ============================================
// IR SENSOR GENERATORS
// ============================================

export const smartcar_read_ir_left = function (_, generator) {
    generator.definitions_['import_smartcar_sensors'] = 'from smartcar import IRSensors';
    generator.definitions_['smartcar_init_ir'] = 'IRSensors.init()';
    return ['IRSensors.read_left()', generator.ORDER_ATOMIC];
}

export const smartcar_read_ir_middle = function (_, generator) {
    generator.definitions_['import_smartcar_sensors'] = 'from smartcar import IRSensors';
    generator.definitions_['smartcar_init_ir'] = 'IRSensors.init()';
    return ['IRSensors.read_middle()', generator.ORDER_ATOMIC];
}

export const smartcar_read_ir_right = function (_, generator) {
    generator.definitions_['import_smartcar_sensors'] = 'from smartcar import IRSensors';
    generator.definitions_['smartcar_init_ir'] = 'IRSensors.init()';
    return ['IRSensors.read_right()', generator.ORDER_ATOMIC];
}

export const smartcar_get_track_state = function (_, generator) {
    generator.definitions_['import_smartcar_sensors'] = 'from smartcar import IRSensors';
    generator.definitions_['smartcar_init_ir'] = 'IRSensors.init()';
    return ['IRSensors.get_track_state()', generator.ORDER_ATOMIC];
}

// ============================================
// ULTRASONIC SENSOR GENERATORS
// ============================================

export const smartcar_get_distance_cm = function (_, generator) {
    generator.definitions_['import_smartcar_sensors'] = 'from smartcar import UltrasonicSensor';
    generator.definitions_['smartcar_init_ultrasonic'] = 'UltrasonicSensor.init()';
    return ['UltrasonicSensor.get_distance_cm()', generator.ORDER_ATOMIC];
}

// ============================================
// RFID GENERATORS
// ============================================

export const smartcar_read_rfid_tag = function (_, generator) {
    generator.definitions_['import_smartcar_rfid'] = 'from smartcar import RFIDReader';
    generator.definitions_['smartcar_init_rfid'] = 'RFIDReader.init()';
    return ['RFIDReader.read_tag()', generator.ORDER_ATOMIC];
}

export const smartcar_has_new_tag = function (_, generator) {
    generator.definitions_['import_smartcar_rfid'] = 'from smartcar import RFIDReader';
    generator.definitions_['smartcar_init_rfid'] = 'RFIDReader.init()';
    return ['RFIDReader.has_new_tag()', generator.ORDER_ATOMIC];
}

// ============================================
// BUZZER GENERATORS
// ============================================

export const smartcar_play_tone = function (_, generator) {
    generator.definitions_['import_smartcar_buzzer'] = 'from smartcar import Buzzer';
    generator.definitions_['import_machine'] = 'from machine import Pin, PWM';
    var frequency = generator.valueToCode(this, 'FREQUENCY', generator.ORDER_ATOMIC);
    var duration = generator.valueToCode(this, 'DURATION', generator.ORDER_ATOMIC);
    return 'Buzzer.play_tone(' + frequency + ', ' + duration + ')\n';
}

export const smartcar_buzzer_stop = function (_, generator) {
    generator.definitions_['import_smartcar_buzzer'] = 'from smartcar import Buzzer';
    return 'Buzzer.stop()\n';
}

// ============================================
// FIREBASE GENERATORS
// ============================================

export const smartcar_is_exam_activated = function (_, generator) {
    generator.definitions_['import_smartcar_firebase'] = 'from smartcar import Firebase';
    generator.definitions_['smartcar_init_firebase'] = 'Firebase.init()';
    return ['Firebase.is_exam_activated()', generator.ORDER_ATOMIC];
}

export const smartcar_get_traffic_light_state = function (_, generator) {
    generator.definitions_['import_smartcar_firebase'] = 'from smartcar import Firebase';
    var light_id = generator.valueToCode(this, 'LIGHT_ID', generator.ORDER_ATOMIC);
    return ['Firebase.get_traffic_light_state(' + light_id + ')', generator.ORDER_ATOMIC];
}

export const smartcar_get_time_remain = function (_, generator) {
    generator.definitions_['import_smartcar_firebase'] = 'from smartcar import Firebase';
    var light_id = generator.valueToCode(this, 'LIGHT_ID', generator.ORDER_ATOMIC);
    return ['Firebase.get_time_remain(' + light_id + ')', generator.ORDER_ATOMIC];
}

// ============================================
// PID CONTROL GENERATORS
// ============================================

export const smartcar_set_pid_gains = function (_, generator) {
    generator.definitions_['import_smartcar_pid'] = 'from smartcar import PIDController';
    var kp = generator.valueToCode(this, 'KP', generator.ORDER_ATOMIC);
    var ki = generator.valueToCode(this, 'KI', generator.ORDER_ATOMIC);
    var kd = generator.valueToCode(this, 'KD', generator.ORDER_ATOMIC);
    return 'PIDController.set_gains(' + kp + ', ' + ki + ', ' + kd + ')\n';
}

export const smartcar_get_left_rpm = function (_, generator) {
    generator.definitions_['import_smartcar_pid'] = 'from smartcar import PIDController';
    return ['PIDController.get_left_rpm()', generator.ORDER_ATOMIC];
}

export const smartcar_get_right_rpm = function (_, generator) {
    generator.definitions_['import_smartcar_pid'] = 'from smartcar import PIDController';
    return ['PIDController.get_right_rpm()', generator.ORDER_ATOMIC];
}

export const smartcar_set_target_rpm = function (_, generator) {
    generator.definitions_['import_smartcar_pid'] = 'from smartcar import PIDController';
    var target = generator.valueToCode(this, 'TARGET', generator.ORDER_ATOMIC);
    return 'PIDController.set_target_rpm(' + target + ')\n';
}
