/*
  DateRangePicker.jsx — start/end date selection with quick presets

  Quick presets: 1Y, 2Y, 3Y, 5Y, 10Y, Max
  Custom: any calendar date range
  Shows a warning if range is too short for walk-forward backtest
*/

import { B as C } from '../constants/theme.js'

const TODAY = new Date().toISOString().split('T')[0]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const PRESETS = [
  { l: '1Y',  s: daysAgo(365)  },
  { l: '2Y',  s: daysAgo(730)  },
  { l: '3Y',  s: daysAgo(1095) },
  { l: '5Y',  s: daysAgo(1825) },
  { l: '10Y', s: daysAgo(3650) },
  { l: 'Max', s: '2000-01-01'  },
]

export function DateRangePicker({ startDate, endDate, setStart, setEnd }) {
  const daysBetween = Math.round(
    (new Date(endDate) - new Date(startDate)) / 86_400_000
  )

  return (
    <div>
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => {
          const active = startDate === p.s && endDate === TODAY
          return (
            <button
              key={p.l}
              onClick={() => { setStart(p.s); setEnd(TODAY) }}
              style={{
                fontSize: 9.5, padding: '4px 10px',
                background: active ? C.cyan + '20' : 'transparent',
                border: `1px solid ${active ? C.cyan : C.border}`,
                borderRadius: 5,
                color: active ? C.cyan : C.muted,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono',monospace",
                transition: 'all .12s',
              }}
            >
              {p.l}
            </button>
          )
        })}
        <span style={{
          fontSize: 9.5, color: C.muted,
          fontFamily: "'JetBrains Mono',monospace",
          marginLeft: 'auto',
        }}>
          {daysBetween.toLocaleString()} days
        </span>
      </div>

      {/* Date inputs */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 8.5, color: C.muted, marginBottom: 3,
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            Start date
          </div>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStart(e.target.value)}
            style={{
              width: '100%',
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: 7,
              color: C.text,
              padding: '7px 10px',
              fontSize: 11,
              fontFamily: "'JetBrains Mono',monospace",
            }}
          />
        </div>

        <div style={{ color: C.muted, fontSize: 16, marginTop: 14 }}>→</div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 8.5, color: C.muted, marginBottom: 3,
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            End date
          </div>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={TODAY}
            onChange={(e) => setEnd(e.target.value)}
            style={{
              width: '100%',
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: 7,
              color: C.text,
              padding: '7px 10px',
              fontSize: 11,
              fontFamily: "'JetBrains Mono',monospace",
            }}
          />
        </div>
      </div>

      {/* Warning if too short for walk-forward */}
      {daysBetween < 520 && (
        <div style={{
          fontSize: 9.5, color: C.amber, marginTop: 6,
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          ⚠ Select at least 2 years for a meaningful walk-forward backtest
        </div>
      )}
    </div>
  )
}
