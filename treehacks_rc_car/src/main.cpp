#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "Treehacks-2025";
const char* password = "treehacks2025!";

WebServer server(80);

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

    server.on("/", []() {
        server.send(200, "text/plain", "ESP32 Web Server is Running!");
    });

    server.begin();
}

void loop() {
    server.handleClient();
}
