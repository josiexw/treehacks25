#include <Arduino.h>
#include "servo_control.h"

ServoControl servoControl;

#define MOTOR_LEFT_FWD 5
#define MOTOR_LEFT_BCK 6
#define MOTOR_RIGHT_FWD 9
#define MOTOR_RIGHT_BCK 10

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

void moveForward() {
    digitalWrite(MOTOR_LEFT_FWD, HIGH);
    digitalWrite(MOTOR_RIGHT_FWD, HIGH);
}

void moveBackward() {
    digitalWrite(MOTOR_LEFT_BCK, HIGH);
    digitalWrite(MOTOR_RIGHT_BCK, HIGH);
}

void turnLeft() {
    digitalWrite(MOTOR_LEFT_BCK, HIGH);
    digitalWrite(MOTOR_RIGHT_FWD, HIGH);
}

void turnRight() {
    digitalWrite(MOTOR_LEFT_FWD, HIGH);
    digitalWrite(MOTOR_RIGHT_BCK, HIGH);
}

void stopMotors() {
    digitalWrite(MOTOR_LEFT_FWD, LOW);
    digitalWrite(MOTOR_LEFT_BCK, LOW);
    digitalWrite(MOTOR_RIGHT_FWD, LOW);
    digitalWrite(MOTOR_RIGHT_BCK, LOW);
}

