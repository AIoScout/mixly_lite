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

// ============================================
// P4 UART LINK GENERATORS (road-sign recognition)
// ============================================

const smartcarAddP4Include = function (generator) {
    generator.definitions_['include_SmartCar_P4UartReceiver'] = '#include "SmartCar/P4UartReceiver.hpp"';
};

export const smartcar_p4_start_link = function (_, generator) {
    smartcarAddP4Include(generator);
    generator.definitions_['smartcar_p4_update_task'] =
        'void SmartCarP4UpdateTask(void* pvParameters) {\n'
        + '  (void)pvParameters;\n'
        + '  for (;;) {\n'
        + '    P4UartReceiver::Update();\n'
        + '    vTaskDelay(1);\n'
        + '  }\n'
        + '}';
    generator.setups_['smartcar_p4_start'] =
        'P4UartReceiver::StartCommunication();\n'
        + '  xTaskCreatePinnedToCore(SmartCarP4UpdateTask, "p4_uart", 4096, NULL, 3, NULL, 0);';

    return '';
};

export const smartcar_p4_wait_sign_confirmed = function (_, generator) {
    smartcarAddP4Include(generator);

    var code = 'P4UartReceiver::BeginDecisionCollection();\n';
    code += 'while (!P4UartReceiver::IsDecisionCollectionReady()) { delay(1); }\n';
    code += 'while (!P4UartReceiver::HasConfirmedSign()) { delay(10); }\n';
    return code;
};

export const smartcar_p4_confirmed_label = function (_, generator) {
    smartcarAddP4Include(generator);

    return ['P4UartReceiver::GetConfirmedLabelId()', generator.ORDER_ATOMIC];
};

export const smartcar_p4_sign_is_class = function (_, generator) {
    smartcarAddP4Include(generator);

    var cls = generator.valueToCode(this, 'CLASS', generator.ORDER_ATOMIC) || '0';
    return ['(P4UartReceiver::GetConfirmedLabelId() == (' + cls + '))', generator.ORDER_ATOMIC];
};

export const smartcar_p4_confirmed_confidence = function (_, generator) {
    smartcarAddP4Include(generator);

    return ['P4UartReceiver::GetConfirmedConfidence()', generator.ORDER_ATOMIC];
};

export const smartcar_p4_end_decision = function (_, generator) {
    smartcarAddP4Include(generator);

    return 'P4UartReceiver::EndDecisionCollection();\n';
};

// ============================================
// LINE FOLLOWING COMPOSITE GENERATORS
// ============================================

export const smartcar_ir_all_black = function (_, generator) {
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';

    var code = '(IRSensors::IRData.Read_IR_L && IRSensors::IRData.Read_IR_M && IRSensors::IRData.Read_IR_R)';
    return [code, generator.ORDER_ATOMIC];
};

export const smartcar_follow_line_until_stop = function (_, generator) {
    smartcarAddPIDDefinitions(generator);
    smartcarAddUltraHelpers(generator);
    generator.definitions_['include_SmartCar_Movement'] = '#include "SmartCar/Movement.hpp"';
    generator.definitions_['include_SmartCar_IRSensors'] = '#include "SmartCar/IRSensors.hpp"';
    generator.definitions_['include_SmartCar_RFIDReader'] = '#include "SmartCar/RFIDReader.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';
    generator.setups_['smartcar_init_encoder'] = 'Encoder::Init();';
    generator.setups_['smartcar_init_ir'] = 'IRSensors::Init();';
    generator.setups_['smartcar_init_rfid'] = 'RFIDReader::Init();';
    generator.definitions_['include_SmartCar_UltrasonicSensor'] = '#include "SmartCar/UltrasonicSensor.hpp"';
    generator.definitions_['include_SmartCar_Pinout'] = '#include "SmartCar/Pinout.hpp"';
    generator.setups_['smartcar_init_ultrasonic'] = 'UltrasonicSensor::Init();';

    generator.definitions_['smartcar_follow_helpers'] =
        'static float SmartCarSampleDistanceCm();\n'
        + 'static bool SmartCarUseRfidStop = false;\n'
        + 'static bool SmartCarUseUltrasonicStop = false;\n'
        + 'static float SmartCarStopDistanceCm = 10.0f;\n'
        + 'static bool SmartCarRfidStopLatch = false;\n'
        + 'static void SmartCarRfidPollLatch() {\n'
        + '  static String latchedUid = "";\n'
        + '  static uint8_t missedReads = 0;\n'
        + '  byte atqa[2];\n'
        + '  byte atqaSize = sizeof(atqa);\n'
        + '  const byte status = RFIDReader::mfrc522.PICC_WakeupA(atqa, &atqaSize);\n'
        + '  if ((status == MFRC522::STATUS_OK || status == MFRC522::STATUS_COLLISION) &&\n'
        + '      RFIDReader::mfrc522.PICC_ReadCardSerial()) {\n'
        + '    const String tagUid = RFIDReader::GetTagUID();\n'
        + '    if (latchedUid.length() == 0 || tagUid != latchedUid) {\n'
        + '      latchedUid = tagUid;\n'
        + '      SmartCarRfidStopLatch = true;\n'
        + '    }\n'
        + '    missedReads = 0;\n'
        + '    RFIDReader::mfrc522.PICC_HaltA();\n'
        + '  } else if (latchedUid.length() > 0) {\n'
        + '    if (++missedReads >= 4) {\n'
        + '      latchedUid = "";\n'
        + '      missedReads = 0;\n'
        + '    }\n'
        + '  }\n'
        + '}\n'
        + 'static bool SmartCarStopTriggered() {\n'
        + '  if (IRSensors::IRData.Read_IR_L && IRSensors::IRData.Read_IR_M && IRSensors::IRData.Read_IR_R) {\n'
        + '    return true;\n'
        + '  }\n'
        + '  if (SmartCarUseUltrasonicStop && SmartCarSampleDistanceCm() <= SmartCarStopDistanceCm) {\n'
        + '    return true;\n'
        + '  }\n'
        + '  if (SmartCarUseRfidStop) {\n'
        + '    SmartCarRfidPollLatch();\n'
        + '  }\n'
        + '  return SmartCarRfidStopLatch;\n'
        + '}\n'
        + 'static bool SmartCarWaitCenteredOrStop() {\n'
        + '  for (;;) {\n'
        + '    delay(10);\n'
        + '    IRSensors::IRData.state = IRSensors::ReadSensorState(IRSensors::IRData);\n'
        + '    if (SmartCarStopTriggered()) {\n'
        + '      Movement::Stop();\n'
        + '      return true;\n'
        + '    }\n'
        + '    if (!IRSensors::IRData.Read_IR_L && IRSensors::IRData.Read_IR_M && !IRSensors::IRData.Read_IR_R) {\n'
        + '      return false;\n'
        + '    }\n'
        + '  }\n'
        + '}\n'
        + 'static bool SmartCarWaitDurationOrStop(uint32_t durationMs) {\n'
        + '  const uint32_t start = millis();\n'
        + '  while (millis() - start < durationMs) {\n'
        + '    delay(10);\n'
        + '    IRSensors::IRData.state = IRSensors::ReadSensorState(IRSensors::IRData);\n'
        + '    if (SmartCarStopTriggered()) {\n'
        + '      Movement::Stop();\n'
        + '      return true;\n'
        + '    }\n'
        + '  }\n'
        + '  return false;\n'
        + '}\n'
        + 'static void SmartCarFollowUntilStop() {\n'
        + '  for (;;) {\n'
        + '    delay(10);\n'
        + '    Encoder::RPMCounterFromEncoder(LeftWheelRPM);\n'
        + '    Encoder::RPMCounterFromEncoder(RightWheelRPM);\n'
        + '    MotorControl::LeftWheel.Speed = constrain((int)LeftWheelPID.PID_realize(LeftWheelRPM.rpm), 0, 4095);\n'
        + '    MotorControl::RightWheel.Speed = constrain((int)RightWheelPID.PID_realize(RightWheelRPM.rpm), 0, 4095);\n'
        + '    IRSensors::IRData.state = IRSensors::ReadSensorState(IRSensors::IRData);\n'
        + '    if (SmartCarStopTriggered()) {\n'
        + '      Movement::Stop();\n'
        + '      return;\n'
        + '    }\n'
        + '    const bool readL = IRSensors::IRData.Read_IR_L;\n'
        + '    const bool readM = IRSensors::IRData.Read_IR_M;\n'
        + '    const bool readR = IRSensors::IRData.Read_IR_R;\n'
        + '    if (!readL && readM && !readR) {\n'
        + '      Movement::MoveForward();\n'
        + '    } else if (readL && readM && !readR) {\n'
        + '      Movement::MoveForward();\n'
        + '      if (SmartCarWaitDurationOrStop(600)) { return; }\n'
        + '      Movement::RotateLeft();\n'
        + '      if (SmartCarWaitCenteredOrStop()) { return; }\n'
        + '    } else if (readL && !readM && readR) {\n'
        + '      Movement::Stop();\n'
        + '    } else if (!readL && readM && readR) {\n'
        + '      Movement::MoveForward();\n'
        + '      if (SmartCarWaitDurationOrStop(600)) { return; }\n'
        + '      Movement::RotateRight();\n'
        + '      if (SmartCarWaitCenteredOrStop()) { return; }\n'
        + '    } else if (!readL && !readM && readR) {\n'
        + '      Movement::RotateRight();\n'
        + '      if (SmartCarWaitCenteredOrStop()) { return; }\n'
        + '    } else if (readL && !readM && !readR) {\n'
        + '      Movement::RotateLeft();\n'
        + '      if (SmartCarWaitCenteredOrStop()) { return; }\n'
        + '    }\n'
        + '  }\n'
        + '}';

    var trigger = this.getFieldValue('TRIGGER');
    var useRfid = trigger === 'allblack_rfid' ? 'true' : 'false';
    var useUltra = trigger === 'ultrasonic' ? 'true' : 'false';
    var dist = generator.valueToCode(this, 'DIST', generator.ORDER_ATOMIC) || '10';

    var code = 'SmartCarUseRfidStop = ' + useRfid + ';\n';
    code += 'SmartCarUseUltrasonicStop = ' + useUltra + ';\n';
    code += 'SmartCarStopDistanceCm = ' + dist + ';\n';
    code += 'SmartCarFollowUntilStop();\n';
    return code;
};

export const smartcar_wait_until_centered = function (_, generator) {
    // SmartCarWaitCenteredOrStop() comes from the follow-line-until helper
    // definitions; the block is documented as requiring that block.
    return 'SmartCarWaitCenteredOrStop();\n';
};

// ============================================
// OBSTACLE / RFID / LEFT-MOTOR / PLATE GENERATORS
// ============================================

const smartcarAddUltraHelpers = function (generator) {
    generator.definitions_['include_SmartCar_UltrasonicSensor'] = '#include "SmartCar/UltrasonicSensor.hpp"';
    generator.definitions_['include_SmartCar_Pinout'] = '#include "SmartCar/Pinout.hpp"';
    generator.setups_['smartcar_init_ultrasonic'] = 'UltrasonicSensor::Init();';
    generator.definitions_['smartcar_ultra_defs'] =
        'static float SmartCarSampleDistanceCm() {\n'
        + '  static bool sampled = false;\n'
        + '  static uint32_t lastSampleMs = 0;\n'
        + '  static float lastCm = 999.0f;\n'
        + '  const uint32_t now = millis();\n'
        + '  if (sampled && now - lastSampleMs < 100) {\n'
        + '    return lastCm;\n'
        + '  }\n'
        + '  sampled = true;\n'
        + '  lastSampleMs = now;\n'
        + '  digitalWrite(Pinout::UltrasonicTrigPin, LOW);\n'
        + '  delayMicroseconds(2);\n'
        + '  digitalWrite(Pinout::UltrasonicTrigPin, HIGH);\n'
        + '  delayMicroseconds(10);\n'
        + '  digitalWrite(Pinout::UltrasonicTrigPin, LOW);\n'
        + '  const unsigned long echoUs = pulseIn(Pinout::UltrasonicEchoPin, HIGH, 25000);\n'
        + '  lastCm = echoUs == 0 ? 999.0f : echoUs * 0.017f;\n'
        + '  return lastCm;\n'
        + '}\n'
        + 'static void SmartCarWaitObstacleClear(float resumeCm, uint32_t timeoutMs) {\n'
        + '  const uint32_t start = millis();\n'
        + '  for (;;) {\n'
        + '    delay(100);\n'
        + '    if (SmartCarSampleDistanceCm() > resumeCm) {\n'
        + '      return;\n'
        + '    }\n'
        + '    if (timeoutMs > 0 && millis() - start >= timeoutMs) {\n'
        + '      return;\n'
        + '    }\n'
        + '  }\n'
        + '}';
};

export const smartcar_obstacle_wait_clear = function (_, generator) {
    smartcarAddUltraHelpers(generator);

    var resume = generator.valueToCode(this, 'RESUME_CM', generator.ORDER_ATOMIC) || '11';
    var timeout = generator.valueToCode(this, 'TIMEOUT_S', generator.ORDER_ATOMIC) || '10';

    return 'SmartCarWaitObstacleClear(' + resume + ', ' + timeout + ' * 1000);\n';
};

export const smartcar_rfid_report_new_tag = function (_, generator) {
    generator.definitions_['include_SmartCar_RFIDReader'] = '#include "SmartCar/RFIDReader.hpp"';
    generator.setups_['smartcar_init_rfid'] = 'RFIDReader::Init();';

    generator.definitions_['smartcar_rfid_report'] =
        'static void SmartCarRfidReportNewTag() {\n'
        + '  static String lastUid = "";\n'
        + '  static uint8_t missedReads = 0;\n'
        + '  byte atqa[2];\n'
        + '  byte atqaSize = sizeof(atqa);\n'
        + '  const byte status = RFIDReader::mfrc522.PICC_WakeupA(atqa, &atqaSize);\n'
        + '  if ((status == MFRC522::STATUS_OK || status == MFRC522::STATUS_COLLISION) &&\n'
        + '      RFIDReader::mfrc522.PICC_ReadCardSerial()) {\n'
        + '    const String uid = RFIDReader::GetTagUID();\n'
        + '    if (uid != lastUid) {\n'
        + '      Serial.print("RFID tag: ");\n'
        + '      Serial.println(uid);\n'
        + '      lastUid = uid;\n'
        + '    }\n'
        + '    missedReads = 0;\n'
        + '    RFIDReader::mfrc522.PICC_HaltA();\n'
        + '  } else if (lastUid.length() > 0) {\n'
        + '    if (++missedReads >= 4) {\n'
        + '      lastUid = "";\n'
        + '      missedReads = 0;\n'
        + '    }\n'
        + '  }\n'
        + '}';

    return 'SmartCarRfidReportNewTag();\n';
};

export const smartcar_left_motor_run = function (_, generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var dir = this.getFieldValue('DIR');
    var duty = generator.valueToCode(this, 'DUTY', generator.ORDER_ATOMIC) || '17';
    var dur = generator.valueToCode(this, 'DURATION', generator.ORDER_ATOMIC) || '500';
    var call = dir === 'acw' ? 'TurnAntiClockwise' : 'TurnClockwise';

    var code = 'MotorControl::LeftWheel.Speed = (int)((4095L * ' + duty + ' + 50) / 100);\n';
    code += 'MotorControl::DCMotorControl::' + call + '(MotorControl::LeftWheel);\n';
    code += 'delay(' + dur + ');\n';
    code += 'MotorControl::DCMotorControl::Stop(MotorControl::LeftWheel);\n';
    return code;
};

export const smartcar_left_motor_sequence = function (_, generator) {
    generator.definitions_['include_SmartCar_MotorControl'] = '#include "SmartCar/MotorControl.hpp"';
    generator.setups_['smartcar_init_motors'] = 'MotorControl::DCMotorControl::Init();';

    var duty = generator.valueToCode(this, 'DUTY', generator.ORDER_ATOMIC) || '17';
    var cw = generator.valueToCode(this, 'CW_MS', generator.ORDER_ATOMIC) || '700';
    var pause = generator.valueToCode(this, 'PAUSE_MS', generator.ORDER_ATOMIC) || '500';
    var acw = generator.valueToCode(this, 'ACW_MS', generator.ORDER_ATOMIC) || '250';

    var code = 'MotorControl::LeftWheel.Speed = (int)((4095L * ' + duty + ' + 50) / 100);\n';
    code += 'MotorControl::DCMotorControl::TurnClockwise(MotorControl::LeftWheel);\n';
    code += 'delay(' + cw + ');\n';
    code += 'MotorControl::DCMotorControl::Stop(MotorControl::LeftWheel);\n';
    code += 'delay(' + pause + ');\n';
    code += 'MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::LeftWheel);\n';
    code += 'delay(' + acw + ');\n';
    code += 'MotorControl::DCMotorControl::Stop(MotorControl::LeftWheel);\n';
    return code;
};

const smartcarAddPlateInclude = function (generator) {
    generator.definitions_['include_SmartCar_P4PlateReceiver'] = '#include "SmartCar/P4PlateReceiver.hpp"';
};

export const smartcar_p4_plate_start_link = function (_, generator) {
    smartcarAddPlateInclude(generator);
    generator.setups_['smartcar_p4_plate_start'] = 'P4PlateReceiver::StartCommunication();';
    return '';
};

export const smartcar_p4_plate_update = function (_, generator) {
    smartcarAddPlateInclude(generator);
    return 'P4PlateReceiver::Update();\n';
};

export const smartcar_p4_plate_ready = function (_, generator) {
    smartcarAddPlateInclude(generator);
    return ['P4PlateReceiver::IsReadyForAction()', generator.ORDER_ATOMIC];
};

export const smartcar_p4_plate_action_done = function (_, generator) {
    smartcarAddPlateInclude(generator);
    return 'P4PlateReceiver::CompleteAction();\n';
};

export const smartcar_p4_plate_latest_index = function (_, generator) {
    smartcarAddPlateInclude(generator);
    return ['P4PlateReceiver::GetLabelId()', generator.ORDER_ATOMIC];
};

