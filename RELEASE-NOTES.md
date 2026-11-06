# MicroScope 3D — v1.3.0 Final Release

## Scope
- Arduino Uno R3 / ATmega328P only.
- Desktop Chrome or Edge using Web Serial API.
- Live serial handshake, ADC sample stream, interactive 3D board, pin matrix, and JSON report export.
- Optional resistor-protected loopback fixture for D3–D13 and A1–A5.

## Evidence-based status rules
- WORKING: a supported shield loopback test returned a passing response.
- NOT WORKING: a supported shield loopback test ran and failed its defined thresholds. This indicates a failed path, not necessarily a damaged MCU pin.
- NOT TESTED: no valid test result exists.
- RESERVED: D0/D1 (USB serial), D2 (analog stimulus), A0 (digital sense).

## Safety
The firmware default is `DIAGNOSTIC_SHIELD_ENABLED 0`. Keep it at 0 for USB-only use. Set it to 1 only after physically building and continuity-checking the exact fixture in `hardware/uno_diagnostic_shield.md`, with USB and external power disconnected. The flag is a manual operator declaration, not automatic shield detection.

The fixture tests loopback paths, not full pin electrical specifications. It does not certify output current, PWM timing, ADC accuracy, short-circuit tolerance, or long-term reliability. Do not attach/remove wiring while powered.

## Build verification
The project source was reviewed and packaged without `node_modules`. A dependency install/build could not be completed in the packaging environment, and no physical Arduino test was performed. Verify locally with:

```powershell
npm.cmd install
npm.cmd run build
```

Then upload `firmware/arduino_uno/microscope_uno.ino` using Arduino IDE with Board = Arduino Uno.
