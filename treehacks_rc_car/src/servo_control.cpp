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
  angle = constrain(angle, 0, 360); // Ensure valid range
  Serial.printf("[SERVO] Moving to %d° on pin %d\n", angle, servoPin);
  int pulseWidth = map(angle, 0, 180, 500, 2400);
  int duty = (pulseWidth * pwmFrequency) * (1 << pwmResolution) / 1000000;
  ledcWrite(pwmChannel, duty);
}

void ServoControl::stop(bool immediate) {
  if(immediate) {
    ledcWrite(pwmChannel, 0); // Cut power immediately
    Serial.println("[SERVO] Emergency stop!");
  } else {
    moveToAngle(90); // Smooth return to neutral
    Serial.println("[SERVO] Returning to neutral position");
  }
}
