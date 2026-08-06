// ============================================
// SmartCar Code Generators for Arduino ESP32
// ============================================

// ============================================
// MOTOR GENERATORS
// ============================================

export const smartcar_move_forward = function (_, generator) {
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var code = 'Movement::MoveForward();\n';
    return code;
};
export const smartcar_move_backward = function (_, generator) {
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var code = 'Movement::MoveBackward();\n';
    return code;
};

export const smartcar_rotate_left = function (_, generator) {
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var code = 'Movement::RotateLeft();\n';
    return code;
};

export const smartcar_rotate_right = function (_, generator) {
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var code = 'Movement::RotateRight();\n';
    return code;
};

export const smartcar_stop = function (_, generator) {
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var code = 'Movement::Stop();\n';
    return code;
};

export const smartcar_set_speed = function (_, generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var speed = generator.valueToCode(this, 'SPEED', generator.ORDER_ATOMIC) || '0';
    var code = 'MotorControl::LeftWheel.Speed = ' + speed + ';\n';
    code += 'MotorControl::RightWheel.Speed = ' + speed + ';\n';
    return code;
};

// ============================================
// IR SENSOR GENERATORS
// ============================================

export const ir_data_updata = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = 'IRSensors::IRData.state = IRSensors::ReadSensorState(IRSensors::IRData);\n';
    return code;
};

export const smartcar_read_ir_left = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = 'IRSensors::IRData.Read_IR_L';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_read_ir_middle = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = 'IRSensors::IRData.Read_IR_M';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_read_ir_right = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = 'IRSensors::IRData.Read_IR_R';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_get_track_state = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = 'IRSensors::ReadSensorState(IRSensors::IRData)';
    return [code, generator.ORDER_ATOMIC];
};

// ============================================
// ULTRASONIC SENSOR GENERATORS
// ============================================

export const smartcar_get_distance_cm = function (_, generator) {
    generator.definitions_['include_SmartCar_UltrasonicSensor'] = '#include "SmartCar/UltrasonicSensor.hpp"';
    generator.setups_['smartcar_init_ultrasonic'] = 'UltrasonicSensor::Init();';

    var code = 'UltrasonicSensor::GetDistance()';
    return [code, generator.ORDER_ATOMIC];
};

// ============================================
// RFID GENERATORS
// ============================================

export const smartcar_read_rfid_tag = function (_, generator) {
    generator.definitions_['include_SmartCar_RFIDReader'] = '#include "SmartCar/RFIDReader.hpp"';
    generator.setups_['smartcar_init_rfid'] = 'RFIDReader::Init();';

    var code = 'RFIDReader::GetTagUID()';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_has_new_tag = function (_, generator) {
    generator.definitions_['include_SmartCar_RFIDReader'] = '#include "SmartCar/RFIDReader.hpp"';
    generator.setups_['smartcar_init_rfid'] = 'RFIDReader::Init();';

    var code = 'RFIDReader::mfrc522.PICC_IsNewCardPresent()';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_rfid_update = function (_, generator) {
    generator.definitions_['include_SmartCar_RFIDReader'] = '#include "SmartCar/RFIDReader.hpp"';
    generator.setups_['smartcar_init_rfid'] = 'RFIDReader::Init();';

    var code = 'RFIDReader::mfrc522.PICC_ReadCardSerial()';
    return [code, generator.ORDER_ATOMIC];
};

// ============================================
// BUZZER GENERATORS
// ============================================

export const smartcar_play_tone = function (_, generator) {
    generator.definitions_['include_SmartCar_Buzzer'] = '#include "SmartCar/Buzzer.hpp"';
    generator.definitions_['include_SmartCar_Pinout'] = '#include "SmartCar/Pinout.hpp"';
    generator.setups_['smartcar_init_buzzer'] = 'Buzzer::Init();';

    var frequency = generator.valueToCode(this, 'FREQUENCY', generator.ORDER_ATOMIC) || '440';
    var duration = generator.valueToCode(this, 'DURATION', generator.ORDER_ATOMIC) || '100';

    var code = 'tone(Pinout::Buzzer, ' + frequency + ', ' + duration + ');\n';
    return code;
};

export const smartcar_buzzer_stop = function (_, generator) {
    generator.definitions_['include_SmartCar_Pinout'] = '#include "SmartCar/Pinout.hpp"';

    var code = 'noTone(Pinout::Buzzer);\n';
    return code;
};

// ============================================
// FIREBASE GENERATORS
// ============================================

export const smartcar_is_exam_activated = function (_, generator) {
    generator.definitions_['include_SmartCar_config'] = '#include "SmartCar/config.h"';

    var code = 'examState.activated';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_get_traffic_light_state = function (_, generator) {
    generator.definitions_['include_SmartCar_config'] = '#include "SmartCar/config.h"';

    var lightId = generator.valueToCode(this, 'LIGHT_ID', generator.ORDER_ATOMIC) || '0';

    var code = 'trafficLights[' + lightId + '].current_state';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_get_time_remain = function (_, generator) {
    generator.definitions_['include_SmartCar_config'] = '#include "SmartCar/config.h"';

    var lightId = generator.valueToCode(this, 'LIGHT_ID', generator.ORDER_ATOMIC) || '0';

    var code = 'trafficLights[' + lightId + '].time_remain';
    return [code, generator.ORDER_ATOMIC];
};

// ============================================
// PID CONTROL GENERATORS
// ============================================

const smartcarAddPIDDefinitions = function (generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.definitions_['smartcar_pid_controller'] =
        'struct SmartCarPID_t {\n'
        + '  volatile float Kp = 0.0f;\n'
        + '  volatile float Ki = 0.0f;\n'
        + '  volatile float Kd = 0.0f;\n'
        + '  volatile float target_val = 150.0f;\n'
        + '  float actual_val = 0.0f;\n'
        + '  float err = 0.0f;\n'
        + '  float err_last = 0.0f;\n'
        + '  float integral = 0.0f;\n'
        + '  float PID_realize(float temp_val) {\n'
        + '    err = target_val - temp_val;\n'
        + '    integral += err;\n'
        + '    actual_val = Kp * err + Ki * integral + Kd * (err - err_last);\n'
        + '    err_last = err;\n'
        + '    return actual_val;\n'
        + '  }\n'
        + '};\n'
        + 'SmartCarPID_t LeftWheelPID;\n'
        + 'SmartCarPID_t RightWheelPID;';
};

export const smartcar_set_pid_gains = function (_, generator) {
    smartcarAddPIDDefinitions(generator);

    var kp = generator.valueToCode(this, 'KP', generator.ORDER_ATOMIC) || '0';
    var ki = generator.valueToCode(this, 'KI', generator.ORDER_ATOMIC) || '0';
    var kd = generator.valueToCode(this, 'KD', generator.ORDER_ATOMIC) || '0';

    var code = 'LeftWheelPID.Kp = ' + kp + ';\n';
    code += 'LeftWheelPID.Ki = ' + ki + ';\n';
    code += 'LeftWheelPID.Kd = ' + kd + ';\n';
    code += 'RightWheelPID.Kp = ' + kp + ';\n';
    code += 'RightWheelPID.Ki = ' + ki + ';\n';
    code += 'RightWheelPID.Kd = ' + kd + ';\n';
    return code;
};

export const smartcar_get_left_rpm = function (_, generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_encoder'] = 'Encoder::Init();';

    var code = 'LeftWheelRPM.rpm';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_get_right_rpm = function (_, generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_encoder'] = 'Encoder::Init();';

    var code = 'RightWheelRPM.rpm';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_set_target_rpm = function (_, generator) {
    smartcarAddPIDDefinitions(generator);

    var target = generator.valueToCode(this, 'TARGET', generator.ORDER_ATOMIC) || '150';

    var code = 'LeftWheelPID.target_val = ' + target + ';\n';
    code += 'RightWheelPID.target_val = ' + target + ';\n';
    return code;
};

export const smartcar_pid_update_loop = function (_, generator) {
    smartcarAddPIDDefinitions(generator);
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';
    generator.setups_['smartcar_init_encoder'] = 'Encoder::Init();';

    var code = 'Encoder::RPMCounterFromEncoder(LeftWheelRPM);\n';
    code += 'Encoder::RPMCounterFromEncoder(RightWheelRPM);\n';
    code += 'MotorControl::LeftWheel.Speed = constrain((int)LeftWheelPID.PID_realize(LeftWheelRPM.rpm), 0, 4095);\n';
    code += 'MotorControl::RightWheel.Speed = constrain((int)RightWheelPID.PID_realize(RightWheelRPM.rpm), 0, 4095);\n';

    return code;
};
