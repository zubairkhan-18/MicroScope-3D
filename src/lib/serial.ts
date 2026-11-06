import type { BoardInfo, PinResult, Telemetry } from '../types'

type Listener = (message: Telemetry) => void

export class MicroscopeSerial {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private keepReading = false
  private listeners = new Set<Listener>()
  private buffer = ''

  get connected() {
    return Boolean(this.port?.readable && this.port?.writable)
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(message: Telemetry) {
    this.listeners.forEach((listener) => listener(message))
  }

  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial is unavailable. Use desktop Chrome or Edge on localhost or HTTPS.')
    }
    if (this.port) {
      throw new Error('A serial connection is already open. Disconnect before reconnecting.')
    }

    const port = await navigator.serial.requestPort()
    try {
      await port.open({ baudRate: 115200 })
      if (!port.readable || !port.writable) {
        throw new Error('The selected serial port did not expose readable and writable streams.')
      }
      this.port = port
      const textStream = port.readable.pipeThrough(new TextDecoderStream())
      this.reader = textStream.getReader()
      this.writer = port.writable.getWriter()
      this.keepReading = true
      this.buffer = ''
      void this.readLoop()

      // Opening an Uno USB serial port resets the MCU. Wait for its bootloader/firmware.
      await new Promise((resolve) => setTimeout(resolve, 1400))
      await this.send({ command: 'HELLO' })
    } catch (error) {
      this.keepReading = false
      try { this.reader?.releaseLock() } catch { /* stream may not have started */ }
      try { this.writer?.releaseLock() } catch { /* stream may not have started */ }
      this.reader = null
      this.writer = null
      this.port = null
      try { await port.close() } catch { /* open may have failed before port became open */ }
      throw error
    }
  }

  private async readLoop() {
    while (this.keepReading && this.reader) {
      try {
        const { value, done } = await this.reader.read()
        if (done) break
        if (!value) continue

        this.buffer += value
        const lines = this.buffer.split(/\r?\n/)
        this.buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            this.emit(JSON.parse(line) as Telemetry)
          } catch {
            this.emit({ type: 'log', message: line })
          }
        }
      } catch (error) {
        if (this.keepReading) {
          this.emit({ type: 'error', message: String(error) })
          this.emit({ type: 'disconnected' })
          void this.disconnect()
        }
        break
      }
    }
    if (this.keepReading) {
      this.emit({ type: 'disconnected' })
      void this.disconnect()
    }
  }

  async send(payload: object) {
    if (!this.writer) {
      throw new Error('Serial port is not connected.')
    }
    const encoded = new TextEncoder().encode(`${JSON.stringify(payload)}\n`)
    await this.writer.write(encoded)
  }

  async disconnect() {
    this.keepReading = false

    try {
      await this.reader?.cancel()
    } catch {
      // The device may already have disconnected.
    }
    try {
      this.reader?.releaseLock()
    } catch {
      // Ignore an already released reader.
    }
    try {
      this.writer?.releaseLock()
    } catch {
      // Ignore an already released writer.
    }
    try {
      await this.port?.close()
    } catch {
      // The USB cable may already have been removed.
    }

    this.reader = null
    this.writer = null
    this.port = null
    this.buffer = ''
  }
}

export function parseBoard(message: Telemetry): BoardInfo | null {
  if (message.type !== 'board_info') return null

  return {
    board: String(message.board) as BoardInfo['board'],
    mcu: String(message.mcu),
    firmware: String(message.firmware),
    status: String(message.status),
    digitalPins: Number(message.digital_pins),
    analogPins: Number(message.analog_pins),
    testShield: Boolean(message.test_shield),
  }
}

export function parsePin(message: Telemetry): PinResult | null {
  if (message.type !== 'pin_result') return null

  const raw = Number(message.raw)
  const voltage = Number(message.voltage)

  return {
    pin: String(message.pin),
    kind: message.kind === 'analog' ? 'analog' : 'digital',
    status: String(message.status) as PinResult['status'],
    ...(Number.isFinite(raw) ? { raw } : {}),
    ...(Number.isFinite(voltage) ? { voltage } : {}),
    detail: String(message.detail ?? ''),
  }
}
