#include "servo_control.h"

ServoControl::ServoControl() {}

void ServoControl::begin() {
  // Configure LEDC PWM
  ledcSetup(pwmChannel, pwmFrequency, pwmResolution);
  ledcAttachPin(servoPin, pwmChannel);
}

void ServoControl::testMovement() {
  Serial.println("Starting 30-second oscillation between 60° and 120°");
  unsigned long startTime = millis();
  
  while (millis() - startTime < 30000) {
    moveToAngle(60);
    delay(1000);
    moveToAngle(120);
    delay(1000);
  }
  moveToAngle(90);
  Serial.println("Oscillation complete");
}

void ServoControl::moveToAngle(int angle) {
  int pulseWidth = map(angle, 0, 180, 500, 2400);
  int duty = (pulseWidth * pwmFrequency) * (1 << pwmResolution) / 1000000;
  ledcWrite(pwmChannel, duty);
  Serial.printf("Servo moved to %d°\n", angle);
}
