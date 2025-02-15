#include <Arduino.h>
#include "servo_control.h"

const char* ssid = "Treehacks-2025";
const char* password = "treehacks2025!";

WebServer server(80);

#define MOTOR_LEFT_FWD 5
#define MOTOR_LEFT_BCK 6
#define MOTOR_RIGHT_FWD 9
#define MOTOR_RIGHT_BCK 10

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }

    Serial.println("Connected to WiFi");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    pinMode(MOTOR_LEFT_FWD, OUTPUT);
    pinMode(MOTOR_LEFT_BCK, OUTPUT);
    pinMode(MOTOR_RIGHT_FWD, OUTPUT);
    pinMode(MOTOR_RIGHT_BCK, OUTPUT);

    server.on("/forward", []() { moveForward(); server.send(200, "text/plain", "Moving Forward"); });
    server.on("/backward", []() { moveBackward(); server.send(200, "text/plain", "Moving Backward"); });
    server.on("/left", []() { turnLeft(); server.send(200, "text/plain", "Turning Left"); });
    server.on("/right", []() { turnRight(); server.send(200, "text/plain", "Turning Right"); });
    server.on("/stop", []() { stopMotors(); server.send(200, "text/plain", "Stopping"); });

    server.begin();
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

