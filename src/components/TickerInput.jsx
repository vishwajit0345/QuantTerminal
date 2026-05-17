/*
  TickerInput.jsx — search box with live ticker validation

  Validates against Yahoo Finance before adding to portfolio.
  Shows company name, exchange, currency so user knows what they're adding.
  Supports any Yahoo Finance symbol globally.
*/

import { useState } from 'react'
import { validateTicker } from '../lib/dataFetch.js'
import { B as C } from '../constants/theme.js'

export function TickerInput({ onAdd, existing }) {
  const [val, setVal]         = useState('')
  const [checking, setChecking] = useState(false)
  const [err, setErr]         = useState('')
  const [info, setInfo]       = useState(null)

  const check = async () => {
    const t = val.trim().toUpperCase()
    if (!t)               { setErr('Enter a ticker symbol'); return }
    if (existing.has(t))  { setErr(`${t} is already in your portfolio`); return }
    if (existing.size >= 15) { setErr('Maximum 15 assets reached'); return }

    setErr('')
    setChecking(true)
    setInfo(null)

    try {
      const meta = await validateTicker(t)
      setInfo({ ticker: t, ...meta })
    } catch (e) {
      setErr(`Could not find "${t}" — check the symbol format (e.g. RELIANCE.NS for NSE India)`)
    }
    setChecking(false)
  }

  const confirm = () => {
    if (!info) return
    onAdd(info)
    setVal('')
    setInfo(null)
    setErr('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') info ? confirm() : check()
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={val}
          onChange={(e) => {
            setVal(e.target.value.toUpperCase())
            setInfo(null)
            setErr('')
          }}
          onKeyDown={handleKey}
          placeholder="Type any ticker: AAPL, RELIANCE.NS, ASML, BTC-USD…"
          style={{
            flex: 1,
            background: C.card,
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            color: C.text,
            padding: '9px 12px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono',monospace",
            outline: 'none',
          }}
        />
        <button
          onClick={check}
          disabled={checking || !val.trim()}
          style={{
            padding: '9px 16px',
            background: C.cyan + '20',
            border: `1px solid ${C.cyan}40`,
            borderRadius: 8,
            color: C.cyan,
            fontSize: 11,
            fontFamily: "'JetBrains Mono',monospace",
            cursor: checking ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {checking ? '…' : 'Validate'}
        </button>

        {info && (
          <button
            onClick={confirm}
            style={{
              padding: '9px 16px',
              background: `linear-gradient(135deg,${C.cyan},${C.green})`,
              border: 'none',
              borderRadius: 8,
              color: '#020810',
              fontSize: 11,
              fontFamily: "'JetBrains Mono',monospace",
              cursor: 'pointer',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            + Add
          </button>
        )}
      </div>

      {/* error message */}
      {err && (
        <div style={{
          fontSize: 10, color: C.red, marginTop: 5,
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          {err}
        </div>
      )}

      {/* confirmed ticker info */}
      {info && (
        <div style={{
          marginTop: 6, padding: '8px 12px',
          background: C.green + '0d',
          border: `1px solid ${C.green}30`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.green,
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            {info.ticker}
          </span>
          <span style={{ fontSize: 11, color: C.text }}>{info.name}</span>
          <span style={{ fontSize: 10, color: C.muted }}>
            {info.exchange} · {info.currency} · {info.type}
          </span>
        </div>
      )}
    </div>
  )
}
