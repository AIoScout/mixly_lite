#ifndef PINOUT_H
#define PINOUT_H

#include <stdint.h>

namespace Pinout {
    // Debug and Status
    const uint8_t Debug = 0;
    const uint8_t Led = 13;

    // Buzzer 
    const uint8_t Buzzer = 2;

    // IR (Infra-red) Sensors
    const uint8_t IRLeft = 5;
    const uint8_t IRMiddle = 6;
    const uint8_t IRRight = 7;

    // Ultrasonic Sensor 
    const uint8_t UltrasonicTrigPin = 38;
    const uint8_t UltrasonicEchoPin = 37;
    // Left Motor (LM)
    const uint8_t LeftMotorIn1 = 12;
    const uint8_t LeftMotorIn2 = 13;
    const uint8_t LeftMotorEncoderA = 11;
    const uint8_t LeftMotorEncoderB = 10;

    // Right Motor (RM)
    const uint8_t RightMotorIn1 = 47;
    const uint8_t RightMotorIn2 = 21;
    const uint8_t RightMotorEncoderA = 35;
    const uint8_t RightMotorEncoderB = 48;

    //RFID Reader 
    const uint8_t RFID_RST = 42;
    const uint8_t  RFID_SCL = 41;
    const uint8_t  RFID_SDA = 40;
    const uint8_t  RFID_IRQ = 39;

    // ADC Checking
    const uint8_t Module_A_ADC = 4;
    const uint8_t Module_B_ADC = 1;

    // RGB Pin
    const uint8_t RGB_PIN = 14;
}

#endif // PINOUT_H
