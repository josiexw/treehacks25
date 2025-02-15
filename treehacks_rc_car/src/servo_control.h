#ifndef SERVO_CONTROL_H
#define SERVO_CONTROL_H

#include <Arduino.h>

class ServoControl {
  public:
    ServoControl();
    void begin();
    void testMovement();
  private:
    const int servoPin = 22;
    const int pwmChannel = 0;
    const int pwmFrequency = 50; // Hz
    const int pwmResolution = 13; // bits
};

#endif // SERVO_CONTROL_H
