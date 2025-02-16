#include <Arduino.h>
#include <HardwareSerial.h>

// Pin definitions for L298N motors
const unsigned int EN_A = 26;
const unsigned int IN1_A = 27;
const unsigned int IN2_A = 25;
const unsigned int IN1_B = 23;
const unsigned int IN2_B = 22;
const unsigned int EN_B = 14;

// UART Pins
#define UART_RX2 16
#define UART_TX2 17

unsigned long lastCommandTime = 0;

void setup() {
    Serial.begin(115200);   // USB debug
    Serial2.begin(115200, SERIAL_8N1, UART_RX2, UART_TX2);  // UART control
    
    // Initialize motor pins
    pinMode(EN_A, OUTPUT);
    pinMode(IN1_A, OUTPUT);
    pinMode(IN2_A, OUTPUT);
    pinMode(EN_B, OUTPUT);
    pinMode(IN1_B, OUTPUT);
    pinMode(IN2_B, OUTPUT);
}

// Basic motor control functions
void forwardA() {
    digitalWrite(EN_A, HIGH);
    digitalWrite(IN1_A, HIGH);
    digitalWrite(IN2_A, LOW);
}

void backwardA() {
    digitalWrite(EN_A, HIGH);
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, HIGH);
}

void stopA() {
    digitalWrite(EN_A, LOW);
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, LOW);
}

void forwardB() {
    digitalWrite(EN_B, HIGH);
    digitalWrite(IN1_B, HIGH);
    digitalWrite(IN2_B, LOW);
}

void backwardB() {
    digitalWrite(EN_B, HIGH);
    digitalWrite(IN1_B, LOW);
    digitalWrite(IN2_B, HIGH);
}

void stopB() {
    digitalWrite(EN_B, LOW);
    digitalWrite(IN1_B, LOW);
    digitalWrite(IN2_B, LOW);
}

// Movement functions
void moveForward() {
    forwardA();
    forwardB();
}

void moveBackward() {
    backwardA();
    backwardB();
}

void turnRight() {
    forwardA();
    backwardB();
}

void turnLeft() {
    forwardB();
    backwardA();
}

void stopAll() {
    stopA();
    stopB();
}

void handleUARTCommand(char cmd) {
    switch(toupper(cmd)) {
        case 'F': 
            moveForward();
            Serial.println("UART: Moving forward");
            break;
        case 'B':
            moveBackward();
            Serial.println("UART: Moving backward");
            break;
        case 'R':
            turnRight();
            Serial.println("UART: Turning right");
            break;
        case 'L':
            turnLeft();
            Serial.println("UART: Turning left");
            break;
        default:
            stopAll();
            Serial.println("UART: Stop - Invalid command");
    }
}

void loop() {
    // Handle UART commands
    if (Serial2.available() > 0) {
        char cmd = Serial2.read();
        handleUARTCommand(cmd);
        lastCommandTime = millis();
    }
}
