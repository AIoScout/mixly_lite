#ifndef MOTOR_CONTROL_H
#define MOTOR_CONTROL_H

#include <Arduino.h>
#include <stdint.h>

namespace MotorControl {

  // Configuration of DC Motor (Side Wheels)
  struct DCMotor
  {
    // PWM Configuration
    const uint16_t PWMFrequency = 2000;
    const uint8_t PWMResolution = 12;
    uint16_t PWMDuty = 0;
    uint8_t MotorID = 0; // ID = 1 (Left), = 2 (Right)
    uint8_t PWMChannelIN1 =
      0; // ensure the PWM channel for different motor is not the same
    uint8_t PWMChannelIN2 = 0;
    // Adjustable Parameter
    uint16_t Speed = 0; // Init set to 0
  };

  // Global motor instances

  extern DCMotor LeftWheel;
  extern DCMotor RightWheel;

  namespace DCMotorControl {
  /*Initialization of PWM channels for DC Motors*/
    void Init();
    void TurnClockwise(DCMotor& Motor);
    void TurnAntiClockwise(DCMotor& Motor);
    void Stop(DCMotor& Motor);
  };

}

// Interrupt Service Routine
// Create a struct to handle 2 motors encoder
struct Encoder_t
{
  int pinAState;
  int pinBState;
  int Encoder_A;
  int Encoder_B;
};
// Global motor encoder
extern Encoder_t EncoderLeft;
extern Encoder_t EncoderRight;

/*Constants for Encoder
  Find out the encoder resolution by yourself */
const int encoderResolution = 320; // Number of pulses per revolution
const unsigned long interval = 50; // Time interval in milliseconds 50ms

/*Encoder to RPM Function and Settings
  Creating RPMCounter_t for 2 Wheel Setting
  */
struct RPMCounter_t
{
  volatile int encoderPulses;
  unsigned long previousMillis;
  volatile float rpm;
};

extern RPMCounter_t LeftWheelRPM;
extern RPMCounter_t RightWheelRPM;

namespace Encoder {
  /*Interrupt for the encoder for both left & right wheel*/
  void handleLeftEncoderInterrupt();
  void handleRightEncoderInterrupt();
  void Init();
  void RPMCounterFromEncoder(RPMCounter_t& Counter);
};

#endif // MOTOR_CONTROL_H
