#include "SmartCar/MotorControl.hpp"
#include "SmartCar/Pinout.hpp"
#include <Arduino.h>

// DC Motor

// Global motor instances
namespace MotorControl {
  DCMotor LeftWheel;
  DCMotor RightWheel;
}

void MotorControl::DCMotorControl::Init()
{
  // Setup the Motor ID to the struct
  LeftWheel.MotorID = 1;
  LeftWheel.PWMChannelIN1 = 1;
  LeftWheel.PWMChannelIN2 = 2;

  RightWheel.MotorID = 2;
  RightWheel.PWMChannelIN1 = 3;
  RightWheel.PWMChannelIN2 = 4;

  // Setup PWM channels for DC Motors (Side Wheels)
  ledcAttachChannel(Pinout::LeftMotorIn1,
                    LeftWheel.PWMFrequency,
                    LeftWheel.PWMResolution,
                    LeftWheel.PWMChannelIN1);
  ledcAttachChannel(Pinout::LeftMotorIn2,
                    LeftWheel.PWMFrequency,
                    LeftWheel.PWMResolution,
                    LeftWheel.PWMChannelIN2);
  ledcAttachChannel(Pinout::RightMotorIn1,
                    RightWheel.PWMFrequency,
                    RightWheel.PWMResolution,
                    RightWheel.PWMChannelIN1);
  ledcAttachChannel(Pinout::RightMotorIn2,
                    RightWheel.PWMFrequency,
                    RightWheel.PWMResolution,
                    RightWheel.PWMChannelIN2);

  // Set all the PWM Channels' Dutycycle to 0
  ledcWriteChannel(LeftWheel.PWMChannelIN1, 0);
  ledcWriteChannel(LeftWheel.PWMChannelIN2, 0);
  ledcWriteChannel(RightWheel.PWMChannelIN1, 0);
  ledcWriteChannel(RightWheel.PWMChannelIN2, 0);
};

void MotorControl::DCMotorControl::TurnClockwise(MotorControl::DCMotor& Motor)
{
  ledcWriteChannel(Motor.PWMChannelIN1, Motor.Speed);
  ledcWriteChannel(Motor.PWMChannelIN2, 0);
};

void MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::DCMotor& Motor)
{

  ledcWriteChannel(Motor.PWMChannelIN1, 0);
  ledcWriteChannel(Motor.PWMChannelIN2, Motor.Speed);
};

void MotorControl::DCMotorControl::Stop(MotorControl::DCMotor& Motor)
{
  ledcWriteChannel(Motor.PWMChannelIN1, 4096);
  ledcWriteChannel(Motor.PWMChannelIN2, 4096);
};

/*Init the Enocoder related Variables before the task starts*/
Encoder_t EncoderLeft = { 0,
                          0,
                          Pinout::LeftMotorEncoderA,
                          Pinout::LeftMotorEncoderB };
Encoder_t EncoderRight = { 0,
                           0,
                           Pinout::RightMotorEncoderA,
                           Pinout::RightMotorEncoderB };

/*Define 2 Sets of Variables using RPMCounter_t for 2 Wheel
Init the RPM related Variables before the task starts   */
RPMCounter_t LeftWheelRPM = { 0, 0, 0 };
RPMCounter_t RightWheelRPM = { 0, 0, 0 };
/*-------------------------------------------------------------------------------------------------------------------------*/
/*Interrupt Service Routine Function
  Since attachInterrupt() cannot using non Static function
  Below are 2 IRAM_ATTR function for handle the interrupts for the encoder*/
namespace Encoder {
  void IRAM_ATTR handleLeftEncoderInterrupt()
  {
    // init the local variable
    int change = 0;

    // Read the current state of the encoder pins
    EncoderLeft.pinAState = digitalRead(EncoderLeft.Encoder_A);
    EncoderLeft.pinBState = digitalRead(EncoderLeft.Encoder_B);

    // Determine the direction of rotation based on the phase change
    if (EncoderLeft.pinAState != EncoderLeft.pinBState) {
      change = (EncoderLeft.pinAState == HIGH) ? 1 : 0;
    } else {
      change = (EncoderLeft.pinAState == HIGH) ? 0 : 1;
    }

    // Update the encoder count
    LeftWheelRPM.encoderPulses += change;
  };

  void IRAM_ATTR handleRightEncoderInterrupt()
  {
    // init the local variable
    int change = 0;

    // Read the current state of the encoder pins
    EncoderRight.pinAState = digitalRead(EncoderRight.Encoder_A);
    EncoderRight.pinBState = digitalRead(EncoderRight.Encoder_B);

    // Determine the direction of rotation based on the phase change
    if (EncoderRight.pinAState != EncoderRight.pinBState) {
      change = (EncoderRight.pinAState == HIGH) ? 1 : 0;
    } else {
      change = (EncoderRight.pinAState == HIGH) ? 0 : 1;
    }

    // Update the encoder count
    RightWheelRPM.encoderPulses += change;
  };

  void Init()
  {
    // Init the PinMode for the Encoder Pins
    pinMode(Pinout::LeftMotorEncoderA, INPUT_PULLUP);
    pinMode(Pinout::LeftMotorEncoderB, INPUT_PULLUP);

    pinMode(Pinout::RightMotorEncoderA, INPUT_PULLUP);
    pinMode(Pinout::RightMotorEncoderB, INPUT_PULLUP);

    // Attach the interrupt service routine to the encoder pins
    attachInterrupt(digitalPinToInterrupt(Pinout::LeftMotorEncoderA),
                    handleLeftEncoderInterrupt,
                    CHANGE);
    attachInterrupt(digitalPinToInterrupt(Pinout::RightMotorEncoderA),
                    handleRightEncoderInterrupt,
                    CHANGE);
    Serial.println("Interrupt Pins Initialized");
  };

  void RPMCounterFromEncoder(RPMCounter_t& Counter)
  {
    unsigned long currentMillis = millis();

    // Check if the time interval has elapsed
    if (currentMillis - Counter.previousMillis >= interval) {
      // Calculate RPM
      float rotations = float(Counter.encoderPulses) / ((float)encoderResolution);
      float time =
        (currentMillis - Counter.previousMillis) / 1000.0f; // Convert to seconds
      Counter.rpm = (rotations / time) * 60.0f;

      // Reset encoder pulse count and update previousMillis
      Counter.encoderPulses = 0;
      Counter.previousMillis = currentMillis;

      // Print RPM
      Serial.println(Counter.rpm);
    }
  }
}
