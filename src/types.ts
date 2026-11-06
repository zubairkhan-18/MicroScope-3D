export type BoardId = 'ARDUINO_UNO_R3'
export type PinStatus = 'passed' | 'failed' | 'not-tested' | 'reserved' | 'active'
export interface PinResult {
  pin: string; kind: 'digital' | 'analog'; status: PinStatus;
  raw?: number; voltage?: number; detail?: string
}
export interface BoardInfo {
  board: BoardId; mcu: string; firmware: string; status: string;
  digitalPins: number; analogPins: number; testShield: boolean
}
export interface Telemetry {
  type: string; [key: string]: unknown
}
