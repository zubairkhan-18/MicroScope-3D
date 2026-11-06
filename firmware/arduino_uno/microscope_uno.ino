/*
 * MicroScope 3D — Arduino Uno R3 firmware v1.3.0
 * Diagnostic shield wiring is mandatory for DIAG:
 *  - D3..D13 each -> 1k series resistor -> A0 (shared digital sense bus)
 *  - A0 -> 10k resistor -> GND (sense pulldown)
 *  - D2 -> 1k series resistor -> A1..A5 (each analog input via its own 1k)
 *  - A1..A5 each -> 10k resistor -> GND
 * D0/D1 are reserved for USB serial; D2 is analog stimulus; A0 is digital sense.
 * Do not connect the shield while powered unless the wiring has been verified.
 */
#include <Arduino.h>
#define FW_VERSION "1.3.0"
#define BAUD_RATE 115200

// SAFETY INTERLOCK:
// Keep 0 for USB-only use. Set to 1 ONLY after the diagnostic shield is
// physically assembled, wired exactly as hardware/uno_diagnostic_shield.md,
// continuity-checked with USB/power disconnected, and then re-upload firmware.
// This is a build-time declaration, NOT automatic electrical detection.
#define DIAGNOSTIC_SHIELD_ENABLED 0
const uint8_t DIGITAL_TEST_PINS[] = {3,4,5,6,7,8,9,10,11,12,13};
const uint8_t ANALOG_TEST_PINS[] = {A1,A2,A3,A4,A5};
const uint8_t DIGITAL_COUNT = sizeof(DIGITAL_TEST_PINS);
const uint8_t ANALOG_COUNT = sizeof(ANALOG_TEST_PINS);

void jsonBoardInfo() {
  Serial.print(F("{\"type\":\"board_info\",\"board\":\"ARDUINO_UNO_R3\",\"mcu\":\"ATmega328P\",\"firmware\":\""));
  Serial.print(FW_VERSION);
  Serial.print(F("\",\"status\":\"CONNECTED\",\"digital_pins\":14,\"analog_pins\":6,\"test_shield\":")); Serial.print(DIAGNOSTIC_SHIELD_ENABLED ? F("true") : F("false")); Serial.println(F("}"));
}
void jsonPin(const char* pin, const char* kind, const char* status, int raw, float voltage, const char* detail) {
  Serial.print(F("{\"type\":\"pin_result\",\"pin\":\"")); Serial.print(pin);
  Serial.print(F("\",\"kind\":\"")); Serial.print(kind);
  Serial.print(F("\",\"status\":\"")); Serial.print(status);
  Serial.print(F("\",\"raw\":")); Serial.print(raw);
  Serial.print(F(",\"voltage\":")); Serial.print(voltage, 3);
  Serial.print(F(",\"detail\":\"")); Serial.print(detail); Serial.println(F("\"}"));
}
void testDigitalPins() {
  pinMode(A0, INPUT);
  for (uint8_t i=0; i<DIGITAL_COUNT; i++) {
    uint8_t pin = DIGITAL_TEST_PINS[i];
    pinMode(pin, INPUT); digitalWrite(pin, LOW);
  }
  delay(5);
  for (uint8_t i=0; i<DIGITAL_COUNT; i++) {
    uint8_t pin = DIGITAL_TEST_PINS[i];
    pinMode(pin, OUTPUT); digitalWrite(pin, LOW); delay(3);
    int lowRead = analogRead(A0);
    digitalWrite(pin, HIGH); delay(3);
    int highRead = analogRead(A0);
    digitalWrite(pin, LOW); pinMode(pin, INPUT);
    bool pass = (lowRead < 120 && highRead > 700);
    char name[5]; snprintf(name, sizeof(name), "D%u", pin);
    jsonPin(name, "digital", pass ? "passed" : "failed", highRead,
      highRead * (5.0 / 1023.0), pass ? "LOW/HIGH response seen through shield" : "Loopback response outside expected thresholds");
  }
  pinMode(A0, INPUT);
}
void testAnalogPins() {
  const uint8_t stimulus = 2;
  pinMode(stimulus, OUTPUT);
  for (uint8_t i=0; i<ANALOG_COUNT; i++) {
    pinMode(ANALOG_TEST_PINS[i], INPUT);
  }
  for (uint8_t i=0; i<ANALOG_COUNT; i++) {
    uint8_t pin = ANALOG_TEST_PINS[i];
    digitalWrite(stimulus, LOW); delay(3);
    int lowRead = analogRead(pin);
    digitalWrite(stimulus, HIGH); delay(3);
    int highRead = analogRead(pin);
    digitalWrite(stimulus, LOW);
    char name[5]; snprintf(name, sizeof(name), "A%u", i+1);
    bool pass = (lowRead < 120 && highRead > 700);
    jsonPin(name, "analog", pass ? "passed" : "failed", highRead,
      highRead * (5.0 / 1023.0), pass ? "LOW/HIGH response seen through shield" : "Analog loopback response outside expected thresholds");
  }
  digitalWrite(stimulus, LOW); pinMode(stimulus, INPUT);
}
void runDiagnostic() {
  Serial.println(F("{\"type\":\"diagnostic_started\",\"message\":\"Sequential shield test\"}"));
  testDigitalPins();
  testAnalogPins();
  Serial.println(F("{\"type\":\"diagnostic_done\"}"));
}
void readAll() {
  for (uint8_t i=0; i<6; i++) {
    int raw = analogRead(i);
    Serial.print(F("{\"type\":\"sample\",\"channel\":\"A")); Serial.print(i);
    Serial.print(F("\",\"value\":")); Serial.print(raw); Serial.println(F("}"));
  }
}
void handleLine(char* line) {
  // Commands arrive as one JSON object per line, e.g. {"command":"DIAG"}.
  if (strstr(line, "\"command\":\"HELLO\"") || strstr(line, "\"command\": \"HELLO\"") ||
      strstr(line, "\"command\":\"SCAN\"") || strstr(line, "\"command\": \"SCAN\"")) { jsonBoardInfo(); return; }
  if (strstr(line, "\"command\":\"DIAG\"") || strstr(line, "\"command\": \"DIAG\"")) {
    // Firmware-side interlock: require an explicit UI safety acknowledgement.
    // This is NOT physical shield detection; the operator must verify the wiring.
    if (DIAGNOSTIC_SHIELD_ENABLED && (strstr(line, "\"shield_confirmed\":true") || strstr(line, "\"shield_confirmed\": true"))) {
      runDiagnostic();
    } else {
      Serial.println(F("{\"type\":\"error\",\"message\":\"Diagnostic blocked: firmware shield interlock is disabled. Pins remain NOT TESTED.\"}"));
    }
    return;
  }
  if (strstr(line, "\"command\":\"READ_ALL\"") || strstr(line, "\"command\": \"READ_ALL\"")) { readAll(); return; }
  if (strstr(line, "\"command\":\"PING\"") || strstr(line, "\"command\": \"PING\"")) { Serial.println(F("{\"type\":\"pong\"}")); return; }
  if (strstr(line, "\"command\":\"WAVE\"") || strstr(line, "\"command\": \"WAVE\"")) {
    for (uint16_t i=0; i<100; i++) {
      Serial.print(F("{\"type\":\"sample\",\"value\":")); Serial.print(analogRead(A1));
      Serial.println(F("}")); delay(50);
    }
    return;
  }
  Serial.println(F("{\"type\":\"error\",\"message\":\"Unknown command\"}"));
}
void setup() {
  Serial.begin(BAUD_RATE);
  for (uint8_t i=0; i<DIGITAL_COUNT; i++) pinMode(DIGITAL_TEST_PINS[i], INPUT);
  pinMode(2, INPUT);
  delay(400);
  jsonBoardInfo();
}
void loop() {
  static char line[80]; static uint8_t index=0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (index) { line[index]='\0'; handleLine(line); index=0; }
    } else if (index < sizeof(line)-1) line[index++]=c;
    else index=0;
  }
}
