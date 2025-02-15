#include <Arduino.h>
#include "servo_control.h"

ServoControl servoControl;

void setup() {
  Serial.begin(115200);
  servoControl.begin();
  Serial.println("Starting servo test...");
  servoControl.testMovement();
  Serial.println("Servo test complete!");
}

void loop() {
  // Empty
}
