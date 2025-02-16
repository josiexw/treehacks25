#ifndef SERVO_CONTROL_H
#define SERVO_CONTROL_H

#include <Arduino.h>

class ServoControl {
  public:
    ServoControl();
    void begin();
    void testMovement();
    void moveToAngle(int angle);
    void stop(bool immediate = false);
  private:
    const int servoPin = 25; // Updated to 25 per servo from serial pin 25
    const int pwmChannel = 0;
    const int pwmFrequency = 50; // Hz
    const int pwmResolution = 13; // bits
};

#endif // SERVO_CONTROL_H
