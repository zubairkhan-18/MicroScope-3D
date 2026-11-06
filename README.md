# MicroScope 3D — v1.3.0

A local-first Arduino Uno R3 dashboard for board identification, interactive 3D exploration, serial telemetry, and optional shield-based GPIO loopback diagnostics.

## Requirements
- Windows 11 (or another desktop OS)
- Node.js 20+ and npm
- Desktop Google Chrome or Microsoft Edge
- Arduino Uno R3 and a USB data cable

## Start the dashboard
Open this folder in VS Code → Terminal → New Terminal:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the localhost URL printed by Vite (usually `http://localhost:5173/`) in desktop Chrome or Edge. Keep the terminal running.

## Upload firmware
1. Open `firmware/arduino_uno/microscope_uno.ino` in Arduino IDE.
2. Select **Tools → Board → Arduino AVR Boards → Arduino Uno**.
3. Select the Uno COM port under **Tools → Port**.
4. Click **Upload** and wait for **Done uploading**.
5. Close Serial Monitor and Serial Plotter before using the browser dashboard.

## USB-only mode
1. Connect the Uno over USB.
2. Click **Connect board** in the dashboard and choose the COM port.
3. Wait for `ARDUINO_UNO_R3` board identification.
4. Explore the 3D board and request ADC telemetry.

USB communication proves that the board and firmware can exchange serial messages. It does **not** prove that GPIO pins are electrically healthy. In USB-only mode, all GPIO diagnostic results must remain **NOT TESTED**; do not interpret missing test data as a pin failure.

## Optional diagnostic shield
Electrical loopback diagnostics require the physical resistor shield described in `hardware/uno_diagnostic_shield.md`. Disconnect USB power before wiring and verify every connection before powering the Uno. The UI checkbox is a manual safety acknowledgement, **not automatic shield detection**. This hardware revision has no dedicated shield-presence circuit. Only check it after physically building and continuity-checking the shield. The firmware also requires an explicit `shield_confirmed` command flag before starting the diagnostic routine.

D0/D1 are reserved for USB serial; D2 is used as the analog-test stimulus; A0 is the digital-test sense input. These pins are not independently tested. Do not use this Uno shield with ESP32.

## What the dashboard reports
- Board identity and firmware version from the live serial handshake
- Interactive procedural 3D Uno board model and selectable pin labels
- Per-pin status: passed/failed only after an explicitly confirmed shield diagnostic; otherwise not tested/reserved
- ADC samples streamed by the firmware (low-speed telemetry, not an oscilloscope)
- JSON report export with timestamp and test limitations

## Limitations
- A passed result means a pin responded through the specified shield loopback path. It is not complete semiconductor, current-drive, timing, ADC-accuracy, or power-rail certification.
- The signal graph is low-speed ADC telemetry, not a calibrated oscilloscope or high-speed PWM instrument.
- The 3D board is a procedural engineering-style approximation, not a manufacturer-certified CAD model.
- Firmware and shield are Uno-specific. ESP32 DevKit V1 requires a separate 3.3 V-safe shield, firmware, pin map, and model.
- Test the hardware safely on a real board before relying on diagnostic results.


## USB-only mode and diagnostic safety (v1.1.1)

- With the default `DIAGNOSTIC_SHIELD_ENABLED 0`, the Uno reports `test_shield: false`.
- The dashboard keeps electrical GPIO results as **NOT TESTED** and disables the diagnostic button.
- USB connection and ADC readings are not electrical pin-health tests.
- Do not change the flag to `1` unless the physical diagnostic shield is built exactly to `hardware/uno_diagnostic_shield.md`, continuity-checked with the board unpowered, and wired correctly. Then re-upload the firmware.
- The shield flag is a build-time operator declaration, not automatic shield sensing.

Start the dashboard with `npm install` and `npm run dev`. On Windows PowerShell, `npm.cmd` can be used instead of `npm`.


## v1.3.0 — final Uno-only release

- Arduino Uno R3 / ATmega328P only; ESP32 profile removed from this release.
- Error responses unlock the diagnostic UI instead of leaving the test button stuck in a busy state.
- Pin failure labels are explicit: **NOT WORKING**; untested paths remain **NOT TESTED**.
- Build artifacts and dependencies are intentionally excluded from the ZIP; run `npm.cmd install` to restore dependencies.

## v1.2.0 — diagnostic shield build

The Arduino Uno diagnostic fixture is documented in `hardware/uno_diagnostic_shield.md`. It uses 16 × 1 kΩ and 6 × 10 kΩ resistors. Build and continuity-check the shield with USB disconnected.

**Safety default:** `DIAGNOSTIC_SHIELD_ENABLED` remains `0` in the firmware. Do not change it until the physical shield is assembled and verified against the wiring guide. The flag is a manual declaration, not automatic shield detection. After verified assembly, change it to `1`, upload the firmware, reconnect the dashboard, and acknowledge the in-app safety prompt.

**Coverage limitation:** D3–D13 and A1–A5 are tested as loopback paths. D0/D1 are reserved for USB serial, D2 is the analog stimulus output, and A0 is the digital sense input; these are not independently certified. A loopback PASS is not a full electrical or semiconductor certification. A FAIL identifies a failed path, not necessarily a damaged MCU pin.

The dashboard status labels are evidence-based: WORKING = loopback path passed; FAULT = loopback path did not meet thresholds; NOT TESTED = no valid test result; RESERVED = pin used by the test fixture or USB serial.
