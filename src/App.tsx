import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  Cable,
  CircleAlert,
  Cpu,
  Download,
  Plug,
  RefreshCw,
  ShieldCheck,
  Waves,
  Zap,
} from 'lucide-react'

import Board3D from './components/Board3D'
import { MicroscopeSerial, parseBoard, parsePin } from './lib/serial'
import type { BoardInfo, PinResult, Telemetry } from './types'

const serial = new MicroscopeSerial()

const initialPins: PinResult[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    pin: `D${i}`,
    kind: 'digital' as const,
    status: ([0, 1, 2].includes(i) ? 'reserved' : 'not-tested') as PinResult['status'],
    detail:
      [0, 1].includes(i)
        ? 'USB serial'
        : i === 2
          ? 'Analog-test source'
          : 'Awaiting diagnostic',
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    pin: `A${i}`,
    kind: 'analog' as const,
    status: (i === 0 ? 'reserved' : 'not-tested') as PinResult['status'],
    detail: i === 0 ? 'Digital test sense line' : 'Awaiting diagnostic',
  })),
]

function App() {
  const [connected, setConnected] = useState(false)
  const [board, setBoard] = useState<BoardInfo | null>(null)
  const [pins, setPins] = useState<PinResult[]>(initialPins)
  const [selected, setSelected] = useState('D3')
  const [logs, setLogs] = useState<string[]>([
    'Ready. Connect an Arduino Uno R3 running MicroScope firmware.',
  ])
  const [samples, setSamples] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'overview' | 'pins' | 'signals'>('overview')

  const addLog = (message: string) => {
    setLogs((previous) =>
      [`${new Date().toLocaleTimeString()}  ${message}`, ...previous].slice(0, 40),
    )
  }

  useEffect(() => {
    const unsubscribe = serial.subscribe((message: Telemetry) => {
      if (message.type === 'board_info') {
        const detectedBoard = parseBoard(message)

        if (detectedBoard) {
          setBoard(detectedBoard)
          setConnected(true)
          setBusy(false)
          setPins(initialPins)
          setSamples([])
          addLog(`Identified ${detectedBoard.board} · ${detectedBoard.mcu}`)
          if (!detectedBoard.testShield) addLog('Diagnostic shield not declared. Electrical pins remain NOT TESTED.')
        }
      }

      if (message.type === 'pin_result') {
        const result = parsePin(message)

        if (result) {
          setPins((previous) =>
            [...previous.filter((pin) => pin.pin !== result.pin), result].sort(
              (a, b) => a.pin.localeCompare(b.pin, undefined, { numeric: true }),
            ),
          )
          addLog(`${result.pin}: ${result.status}`)
        }
      }

      if (message.type === 'sample') {
        setSamples((previous) => [...previous.slice(-119), Number(message.value)])
      }

      if (message.type === 'diagnostic_done') {
        setBusy(false)
        addLog('Diagnostic sequence completed. Review individual pin results.')
      }

      if (message.type === 'error') {
        setBusy(false)
        addLog(String(message.message ?? 'Device error'))
      }

      if (message.type === 'disconnected') {
        setConnected(false)
        setBoard(null)
        setBusy(false)
        addLog('USB serial connection lost. Check the cable and reconnect the board.')
      }

      if (message.type === 'log') {
        addLog(String(message.message))
      }
    })

    return unsubscribe
  }, [])

  const diagnosticPins = pins.filter((pin) => !['D0', 'D1', 'D2', 'A0'].includes(pin.pin))
  const passed = diagnosticPins.filter((pin) => pin.status === 'passed').length
  const failed = diagnosticPins.filter((pin) => pin.status === 'failed').length
  const tested = passed + failed
  const shieldReady = Boolean(board?.testShield)
  const selectedPin = pins.find((pin) => pin.pin === selected)

  const connect = async () => {
    try {
      await serial.connect()
      addLog('Serial port opened. Waiting for board handshake...')
    } catch (error) {
      const err = error as DOMException
      const message = err?.name === 'NotFoundError'
        ? 'No port selected. Choose the Arduino COM port in the browser picker.'
        : err?.name === 'NetworkError'
          ? 'Could not open serial port. Close Arduino Serial Monitor/Plotter and other apps using this COM port, then reconnect.'
          : err?.name === 'SecurityError'
            ? 'Serial permission blocked. Use desktop Chrome/Edge on localhost or HTTPS.'
            : (err?.message || String(error))
      addLog(message)
    }
  }

  const disconnect = async () => {
    try {
      await serial.disconnect()
      setConnected(false)
      setBoard(null)
      setBusy(false)
      addLog('Disconnected.')
    } catch (error) {
      addLog(`Disconnect error: ${String(error)}`)
    }
  }

  const runDiagnostic = async () => {
    if (!connected || !shieldReady || busy) {
      addLog('Electrical diagnostics locked: firmware does not report an enabled diagnostic shield. Pins remain NOT TESTED.')
      return
    }

    const confirmed = window.confirm(
      'SAFETY CHECK\n\nConfirm that the resistor shield is wired exactly as hardware/uno_diagnostic_shield.md, checked with USB disconnected, and has no shorts. Never run this test with loose or unverified wiring.\n\nStart the low-speed loopback test?'
    )
    if (!confirmed) return

    try {
      setBusy(true)
      setPins(initialPins)
      addLog('Starting safe sequential GPIO diagnostic...')
      await serial.send({ command: 'DIAG', shield_confirmed: true })
    } catch (error) {
      setBusy(false)
      addLog(`Diagnostic command failed: ${String(error)}`)
    }
  }

  const readPins = async () => {
    try {
      await serial.send({ command: 'READ_ALL' })
      addLog('Requested pin telemetry.')
    } catch (error) {
      addLog(`Telemetry request failed: ${String(error)}`)
    }
  }

  const sendWave = async () => {
    try {
      await serial.send({
        command: 'WAVE',
        pin: 'D3',
        frequency: 2,
        duration_ms: 5000,
      })
      addLog('Requested D3 sample demonstration.')
    } catch (error) {
      addLog(`Signal request failed: ${String(error)}`)
    }
  }

  const exportReport = () => {
    const report = {
      created: new Date().toISOString(),
      board,
      pinResults: pins,
      summary: {
        passed,
        failed,
        tested,
        notTested: diagnosticPins.length - tested,
        reserved: pins.length - diagnosticPins.length,
        testablePins: diagnosticPins.length,
      },
      notice:
        'Electrical pin results are meaningful only after the physical diagnostic shield is wired and manually confirmed. USB connection alone does not test GPIO health. A pass is a loopback check, not complete semiconductor characterization.',
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = 'microscope-diagnostic-report.json'
    anchor.click()

    URL.revokeObjectURL(url)
  }

  const pinGroups = useMemo(
    () => ({
      digital: pins.filter((pin) => pin.kind === 'digital'),
      analog: pins.filter((pin) => pin.kind === 'analog'),
    }),
    [pins],
  )

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={21} />
          </div>
          <div>
            <b>
              MicroScope <span>3D</span>
            </b>
            <small>HARDWARE INTELLIGENCE PLATFORM</small>
          </div>
        </div>

        <div className="top-actions">
          <span className={`status-pill ${connected ? 'online' : ''}`}>
            <i />
            {connected ? 'USB CONNECTED · BOARD VERIFIED' : 'NO DEVICE'}
          </span>
          <button className="connect-btn" onClick={connected ? disconnect : connect}>
            <Plug size={16} />
            {connected ? 'Disconnect' : 'Connect board'}
          </button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <div className="eyebrow">ENGINEERING / DEVICE LAB</div>
          <h1>
            Your hardware, <em>decoded.</em>
          </h1>
          <p>Real serial telemetry. Interactive board inspection. Evidence-based pin diagnostics.</p>
        </div>

        <div className="board-chip">
          <Cpu size={18} />
          <span>{board ? board.board.replaceAll('_', ' ') : 'ARDUINO UNO R3'}</span>
          <small>{board?.mcu ?? 'WAITING FOR HANDSHAKE'}</small>
        </div>
      </section>

      <section className="metrics">
        <Metric
          icon={<Cpu />}
          label="DEVICE"
          value={board ? 'UNO R3' : '—'}
          sub={board ? board.mcu : 'Not detected'}
        />
        <Metric
          icon={<ShieldCheck />}
          label="PINS PASSED"
          value={String(passed).padStart(2, '0')}
          sub={tested ? 'Verified by shield loopback' : 'No electrical test data'}
        />
        <Metric
          icon={<CircleAlert />}
          label="FAILED"
          value={String(failed).padStart(2, '0')}
          sub={failed ? 'Failed shield loopback only' : 'No confirmed failures'}
        />
        <Metric
          icon={<Activity />}
          label="TEST COVERAGE"
          value={`${tested}/${diagnosticPins.length}`}
          sub="Electrical pins tested"
        />
      </section>

      <nav className="tabs">
        {(['overview', 'pins', 'signals'] as const).map((tabName) => (
          <button
            className={tab === tabName ? 'active' : ''}
            onClick={() => setTab(tabName)}
            key={tabName}
          >
            {tabName === 'overview'
              ? '3D Explorer'
              : tabName === 'pins'
                ? 'Pin diagnostics'
                : 'Signal monitor'}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className="main-grid">
          <article className="panel model-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">LIVE BOARD MODEL</div>
                <h2>Arduino Uno R3</h2>
              </div>
              <span className="tag">INTERACTIVE CAD VIEW</span>
            </div>

            <Board3D pins={pins} selected={selected} onSelect={setSelected} />

            <div className="legend">
              <span><i className="green" />Passed</span>
              <span><i className="red" />Failed</span>
              <span><i className="yellow" />Not tested</span>
              <span><i className="blue" />Selected</span>
            </div>
          </article>

          <article className="panel inspector">
            <div className="panel-head">
              <div>
                <div className="eyebrow">COMPONENT INSPECTOR</div>
                <h2>
                  {selected} <span className="muted">/ GPIO</span>
                </h2>
              </div>
              <Cpu size={20} />
            </div>

            <div className="pin-status">
              <span className={`pin-dot ${selectedPin?.status ?? 'not-tested'}`} />
              <div>
                <b>{statusLabel(selectedPin?.status ?? 'not-tested')}</b>
                <small>{selectedPin?.detail ?? 'No test result available'}</small>
              </div>
            </div>

            <div className="detail-list">
              <Detail label="Pin type" value={selectedPin?.kind ?? 'Digital'} />
              <Detail
                label="Raw reading"
                value={selectedPin?.raw === undefined ? '—' : String(selectedPin.raw)}
              />
              <Detail
                label="Measured voltage"
                value={
                  selectedPin?.voltage === undefined
                    ? '—'
                    : `${selectedPin.voltage.toFixed(2)} V`
                }
              />
              <Detail label="Board firmware" value={board?.firmware ?? 'Not connected'} />
            </div>

            <div className="shield-state">
              <b>{shieldReady ? 'DIAGNOSTIC SHIELD ENABLED IN FIRMWARE' : 'USB-ONLY MODE · ELECTRICAL TESTS LOCKED'}</b>
              <span>
                {shieldReady
                  ? 'Firmware was compiled with the shield option enabled. This is NOT automatic shield detection. Confirm the physical wiring and power-off continuity checks before running the test.'
                  : 'No diagnostic shield is enabled in the firmware. Electrical pin health cannot be tested over USB alone. All GPIO pins remain NOT TESTED.'}
              </span>
            </div>

            <div className="button-stack">
              <button
                className="primary"
                disabled={!connected || !shieldReady || busy}
                onClick={runDiagnostic}
              >
                <ShieldCheck size={16} />
                {busy ? 'Testing pins…' : 'Run safe pin test'}
              </button>

              <button className="secondary" disabled={!connected} onClick={readPins}>
                <RefreshCw size={16} />
                Refresh telemetry
              </button>

              <button className="secondary" disabled={!connected} onClick={exportReport}>
                <Download size={16} />
                Export report
              </button>
            </div>

            <p className="note">
              <ShieldCheck size={14} />
              USB communication and ADC sampling do not prove GPIO electrical health. The firmware flag is an operator declaration, not a sensor. Enable it only after the shield is assembled and continuity-checked with USB unplugged.
            </p>
          </article>
        </section>
      )}

      {tab === 'pins' && (
        <section className="panel pin-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">GPIO TEST MATRIX</div>
              <h2>Pin-by-pin results</h2>
            </div>

            <button
              className="primary"
              disabled={!connected || !shieldReady || busy}
              onClick={runDiagnostic}
            >
              <Zap size={15} />
              Run diagnostics
            </button>
          </div>

          <h3>Digital pins</h3>
          <div className="pin-grid">
            {pinGroups.digital.map((pin) => (
              <PinCard key={pin.pin} pin={pin} selected={selected} choose={setSelected} />
            ))}
          </div>

          <h3>Analog pins</h3>
          <div className="pin-grid">
            {pinGroups.analog.map((pin) => (
              <PinCard key={pin.pin} pin={pin} selected={selected} choose={setSelected} />
            ))}
          </div>

          <p className="note">
            D0/D1 are reserved for USB serial; D2 is used as the analog-test stimulus; A0 is
            the digital-test sense input. These are intentionally not reported as
            independently tested.
          </p>
        </section>
      )}

      {tab === 'signals' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">SIGNAL MONITOR</div>
              <h2>Live ADC telemetry</h2>
            </div>

            <button className="secondary" disabled={!connected} onClick={sendWave}>
              <Waves size={16} />
              Stream A1 samples
            </button>
          </div>

          <div className="wave-box">
            <div className="wave-meta">
              <span>Serial sample stream</span>
              <b>{samples.length} samples</b>
            </div>

            <svg viewBox="0 0 720 180" preserveAspectRatio="none">
              <path
                d="M0 90 H720"
                stroke="#26364a"
                strokeDasharray="5 6"
                fill="none"
              />
              <polyline
                points={samples
                  .map(
                    (value, index) =>
                      `${(index * 720) / Math.max(119, samples.length - 1)},${
                        160 - (Math.max(0, Math.min(1023, value)) * 140) / 1023
                      }`,
                  )
                  .join(' ')}
                fill="none"
                stroke="#4ba7ff"
                strokeWidth="2.5"
              />
            </svg>

            <p className="note">
              These are firmware-reported ADC samples from the Uno. This is low-speed telemetry, not a calibrated oscilloscope trace or high-speed PWM measurement.
            </p>
          </div>
        </section>
      )}

      <section className="bottom-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">DEVICE PROFILE</div>
              <h2>Board specifications</h2>
            </div>
            <Cpu />
          </div>

          <Detail label="Microcontroller" value={board?.mcu ?? 'ATmega328P'} />
          <Detail label="Logic voltage" value="5 V nominal (Uno R3)" />
          <Detail label="Clock" value="16 MHz nominal" />
          <Detail label="Digital I/O" value="14 (D0–D13)" />
          <Detail label="Analog inputs" value="6 (A0–A5)" />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">SESSION CONSOLE</div>
              <h2>Serial activity</h2>
            </div>
            <Cable />
          </div>

          <div className="console">
            {logs.map((log, index) => (
              <div key={`${index}-${log}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {log}
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer>
        <span>MICROSCOPE 3D · BUILD 1.3.0</span>
        <span>ARDUINO UNO R3 · ATmega328P · 5V LOGIC</span>
      </footer>
    </main>
  )
}

function statusLabel(status: PinResult['status']) {
  if (status === 'passed') return 'WORKING';
  if (status === 'failed') return 'NOT WORKING';
  if (status === 'reserved') return 'RESERVED';
  if (status === 'active') return 'ACTIVE';
  return 'NOT TESTED';
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <small>{label}</small>
      <b>{value}</b>
      <span>{sub}</span>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function PinCard({
  pin,
  selected,
  choose,
}: {
  pin: PinResult
  selected: string
  choose: (pinName: string) => void
}) {
  return (
    <button
      className={`pin-card ${selected === pin.pin ? 'chosen' : ''}`}
      onClick={() => choose(pin.pin)}
    >
      <span className={`pin-dot ${pin.status}`} />
      <b>{pin.pin}</b>
      <small>{statusLabel(pin.status)}</small>
    </button>
  )
}

export default App
