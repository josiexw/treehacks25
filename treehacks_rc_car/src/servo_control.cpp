#include "servo_control.h"

ServoControl::ServoControl() {}

void ServoControl::begin() {
  // Configure LEDC PWM
  ledcSetup(pwmChannel, pwmFrequency, pwmResolution);
  ledcAttachPin(servoPin, pwmChannel);
}

void ServoControl::testMovement() {
  Serial.println("Sweeping servo 0->180 degrees");
  for(int angle = 0; angle <= 180; angle += 10) {
    int pulseWidth = map(angle, 0, 180, 500, 2400);
    int duty = (pulseWidth * pwmFrequency) / 1000000.0 * (pow(2, pwmResolution) - 1);
    ledcWrite(pwmChannel, duty);
    Serial.printf("Angle: %d°\n", angle);
    delay(500);
  }
  
  Serial.println("Sweeping back 180->0 degrees");
  for(int angle = 180; angle >= 0; angle -= 10) {
    int pulseWidth = map(angle, 0, 180, 500, 2400);
    int duty = (pulseWidth * pwmFrequency) / 1000000.0 * (pow(2, pwmResolution) - 1);
    ledcWrite(pwmChannel, duty);
    Serial.printf("Angle: %d°\n", angle);
    delay(500);
  }
}
