#include "SmartCar/Movement.hpp"
#include "SmartCar/MotorControl.hpp"
#include "SmartCar/Pinout.hpp"
#include <Arduino.h>

/*------------The following config is for differential driving------------*/
    void Movement::RotateRight(){
        /*Config. of DC Motor (Side Wheel)*/
        MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::LeftWheel);
        MotorControl::DCMotorControl::TurnClockwise(MotorControl::RightWheel);
    };
    void Movement::RotateLeft(){
        /*Config. of DC Motor (Side Wheel)*/
        MotorControl::DCMotorControl::TurnClockwise(MotorControl::LeftWheel);
        MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::RightWheel);
    };

    void Movement::MoveForward(){
        /*Config. of DC Motor (Side Wheel)*/
        MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::LeftWheel);
        MotorControl::DCMotorControl::TurnAntiClockwise(MotorControl::RightWheel);
    };
    void Movement::MoveBackward(){
        /*Config. of DC Motor (Side Wheel)*/
        MotorControl::DCMotorControl::TurnClockwise(MotorControl::LeftWheel);
        MotorControl::DCMotorControl::TurnClockwise(MotorControl::RightWheel);
    };
    void Movement::Stop(){
        MotorControl::DCMotorControl::Stop(MotorControl::LeftWheel);
        MotorControl::DCMotorControl::Stop(MotorControl::RightWheel);
    }
