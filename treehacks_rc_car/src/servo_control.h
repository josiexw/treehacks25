#ifndef SERVO_CONTROL_H
#define SERVO_CONTROL_H

#include <Arduino.h>

class ServoControl {
  public:
    ServoControl();
    void begin();
    void testMovement();
    void moveToAngle(int angle);
  private:
    const int servoPin = 13; // Changed from 22 to 13
    const int pwmChannel = 0;
    const int pwmFrequency = 50; // Hz
    const int pwmResolution = 13; // bits
};

#endif // SERVO_CONTROL_H
