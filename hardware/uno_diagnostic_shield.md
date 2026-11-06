# MicroScope 3D — Arduino Uno R3 Diagnostic Shield

This is a **low-speed resistor-protected loopback fixture**, not a full electrical certification tool. It tests only the pins listed below. Do not use this Uno shield with ESP32.

## Bill of materials

- 16 × 1 kΩ resistors (¼ W, 5% or better): 11 digital sense branches + 5 analog stimulus branches
- 6 × 10 kΩ resistors (¼ W): one A0 pulldown + five analog input pulldowns
- 1 breadboard or small PCB, jumper wires, labels

## Wiring — build with USB disconnected

### Digital loopback: D3–D13 to A0

1. Connect D3 to one end of its own 1 kΩ resistor; connect the other end to the shared A0 sense bus.
2. Repeat independently for D4, D5, D6, D7, D8, D9, D10, D11, D12 and D13. Do not join the GPIO-side ends of these resistors together.
3. Connect A0 to GND through one 10 kΩ resistor.

### Analog loopback: D2 to A1–A5

1. Connect D2 to one end of a 1 kΩ resistor.
2. Connect the other end of that resistor to A1. Repeat with a separate 1 kΩ resistor from D2 to each of A2, A3, A4 and A5. The five resistor branches share D2, but each analog input has its own resistor.
3. Connect each of A1, A2, A3, A4 and A5 to GND through its own 10 kΩ resistor.

Use only the Uno's own 5 V logic. **Do not connect any external voltage source.** Do not connect GPIO outputs directly together.

## What the test actually proves

- D3–D13: each output is driven LOW then HIGH through its own 1 kΩ resistor; A0 must observe low/high transitions. This checks the pin and its shield branch as a combined path.
- A1–A5: D2 drives LOW then HIGH through each 1 kΩ branch; the selected analog input must observe the corresponding transition. This checks the D2-to-input path, not each component independently.
- D0/D1 are reserved for USB serial. D2 is the shared analog stimulus source. A0 is the shared digital sense input. They are **not independently certified** by this fixture.
- A6/A7 are not available on the standard Arduino Uno R3 DIP pinout.

A PASS means the tested loopback path responded within firmware thresholds at test time. A FAIL means that path did not respond as expected; it does not by itself identify whether the MCU pin, wire, resistor, or breadboard connection is faulty. This does not certify output current, timing, PWM, ADC accuracy, short-circuit tolerance, or long-term reliability.

## Power-up checklist

1. Unplug USB and all external power.
2. Check every resistor value and every connection against this guide.
3. Use a multimeter continuity/ohms mode to check for accidental shorts between 5 V, GND and GPIO lines.
4. Confirm no direct GPIO-to-GPIO connection exists.
5. Only then connect USB.
6. In firmware, change `DIAGNOSTIC_SHIELD_ENABLED` from `0` to `1`, upload the firmware, reconnect the dashboard, and confirm the wiring checkbox/dialog before starting a test. This flag is a manual declaration; the Uno cannot automatically detect this passive shield.

Stop immediately if the board, resistor, or cable heats up, the board resets unexpectedly, or anything smells/burns. Disconnect USB. Never attach or remove shield wiring while powered.
