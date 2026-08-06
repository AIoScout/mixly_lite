#ifndef ROBOT_MOVEMENT_H
#define ROBOT_MOVEMENT_H

#include <stdint.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "esp32-hal-ledc.h"
#include "SmartCar/MotorControl.hpp"

namespace Movement {
    // Function declarations
    void RotateLeft();
    void RotateRight();
    void MoveForward();
    void MoveBackward();
    void Stop();
}

#endif // ROBOT_MOVEMENT_H
