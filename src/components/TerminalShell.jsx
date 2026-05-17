/*
  TerminalShell.jsx — Quant Terminal frame (replaces BloombergShell)

  Provides:
  - QuantHeader   — orange top bar, logo, DST-safe city clocks, market status
  - TickerTape    — selected portfolio stocks scrolling with annual returns
  - FunctionKeyBar — bottom F2–F12 navigation
  - Panel, Metric, SectionHead, BBTooltip, DataGrid — shared UI components

  Zero Bloomberg branding. Zero version numbers.
*/

import { useState, useEffect } from 'react'
import { B } from '../constants/theme.js'

// ── DST-safe timezone formatter ───────────────────────────────────
const tzTime = (date, tz) =>
  date.toLocaleTimeString('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })

// ── Market status dots (NYSE + NSE) ──────────────────────────────
function MarketStatus() {
  const now    = new Date()
  const day    = now.getUTCDay()
  const utcH   = now.getUTCHours()
  const utcM   = now.getUTCMinutes()

  const nyH    = utcH - 4  // EDT (UTC-4)
  const nyseOpen = day >= 1 && day <= 5 && (nyH > 9 || (nyH === 9 && utcM >= 30)) && nyH < 16

  const nseH  = utcH + 5; const nseM = utcM + 30
  const nseOpen = day >= 1 && day <= 5 &&
    (nseH > 9 || (nseH === 9 && nseM >= 15)) &&
    (nseH < 15 || (nseH === 15 && utcM === 0))

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {[{ label: 'NYSE', open: nyseOpen }, { label: 'NSE', open: nseOpen }].map(m => (
        <div key={m.label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: m.open ? '#00e676' : '#ff1744',
          }} />
          <span style={{ fontSize: 9, color: '#000', fontWeight: 700 }}>{m.label}</span>
          <span style={{ fontSize: 9, color: 'rgba(0,0,0,.7)', fontWeight: 600 }}>
            {m.open ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── QuantHeader ───────────────────────────────────────────────────
export function QuantHeader({ assetsCount = 0, status = '', dataSrc = '' }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const zones = [
    { city: 'MUM', tz: 'Asia/Kolkata'     },
    { city: 'NY',  tz: 'America/New_York' },
    { city: 'LON', tz: 'Europe/London'    },
    { city: 'TKY', tz: 'Asia/Tokyo'       },
  ]

  return (
    <div style={{
      background: B.orange, padding: '0 14px',
      height: 36, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700, fontSize: 16, color: '#000', letterSpacing: '.04em',
          }}>QUANT</span>
          <span style={{
            background: '#000', color: B.orange,
            fontFamily: '"Oswald", sans-serif',
            fontWeight: 700, fontSize: 11,
            padding: '1px 6px', letterSpacing: '.1em',
          }}>TERMINAL</span>
        </div>
        <div style={{
          background: 'rgba(0,0,0,.15)', padding: '1px 8px',
          fontSize: 9, fontWeight: 700, color: '#000', letterSpacing: '.06em',
        }}>
          PORTFOLIO OPTIMIZATION
        </div>
        <MarketStatus />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {dataSrc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: dataSrc.includes('Yahoo') ? '#00e676' : '#ffab00',
            }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#000' }}>
              {dataSrc.includes('Yahoo') ? 'LIVE DATA' : 'SIMULATION'}
            </span>
          </div>
        )}
        {assetsCount > 0 && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#000' }}>
            {assetsCount} ASSETS
          </div>
        )}
        {/* City clocks */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {zones.map(z => (
            <div key={z.city} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontSize: 8, color: '#000', opacity: .6 }}>{z.city}</span>
              <span style={{ fontSize: 10, color: '#000', fontWeight: 700, letterSpacing: '.02em' }}>
                {tzTime(time, z.tz)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TickerTape — portfolio stocks with annual returns ─────────────
export function TickerTape({ assets = [], engine = null }) {
  if (assets.length === 0) {
    const ph = ['AAPL','MSFT','NVDA','JPM','GLD','SPY','TLT','AMZN']
    const names = ['Apple','Microsoft','NVIDIA','JPMorgan','Gold ETF','S&P 500','20yr Bond','Amazon']
    const tape = [...ph,...ph,...ph,...ph].map((t,i) => (
      <span key={i} style={{ marginRight: 40, whiteSpace: 'nowrap' }}>
        <span style={{ color: '#333', marginRight: 14 }}>◆</span>
        <span style={{ color: '#ff6600', fontWeight: 800, marginRight: 7, fontSize: 10 }}>{t}</span>
        <span style={{ color: '#666', fontWeight: 400, marginRight: 7, fontSize: 9 }}>{names[i % 8]}</span>
        <span style={{ color: '#444', fontSize: 9 }}>ADD TICKER →</span>
      </span>
    ))
    return (
      <div className="ticker-tape">
        <div className="ticker-tape-inner" style={{ animationDuration: '40s' }}>{tape}</div>
      </div>
    )
  }

  // Build items with annual return from engine
  const items = assets.map((a) => {
    let annRet = null
    if (engine?.muD && engine.tickers) {
      const idx = engine.tickers.indexOf(a.ticker)
      if (idx !== -1) annRet = engine.muD[idx] * 252
    }
    return {
      ticker:  a.ticker,
      name:    a.name || a.ticker,
      retStr:  annRet !== null
        ? `${annRet >= 0 ? '▲' : '▼'}${Math.abs(annRet * 100).toFixed(2)}% p.a.`
        : 'NO DATA',
      retCol:  annRet !== null ? (annRet >= 0 ? '#00e676' : '#ff1744') : '#666666',
    }
  })

  // Repeat 4× for seamless loop
  const tape = [...items,...items,...items,...items].map((item, i) => (
    <span key={i} style={{ marginRight: 40, whiteSpace: 'nowrap' }}>
      {/* Separator */}
      <span style={{ color: '#333', marginRight: 14 }}>◆</span>
      {/* Ticker — orange, bold */}
      <span style={{ color: '#ff6600', fontWeight: 800, marginRight: 7, fontSize: 10 }}>
        {item.ticker}
      </span>
      {/* Stock name — white, normal weight */}
      <span style={{ color: '#b0b0b0', fontWeight: 400, marginRight: 7, fontSize: 9 }}>
        {item.name.length > 14 ? item.name.slice(0, 14) + '…' : item.name}
      </span>
      {/* Return — green or red, clearly visible */}
      <span style={{
        color: item.retCol,
        fontWeight: 700,
        fontSize: 10,
        background: `${item.retCol}18`,
        padding: '0px 5px',
        borderRadius: 2,
      }}>
        {item.retStr}
      </span>
    </span>
  ))

  const duration = Math.max(20, assets.length * 6)

  return (
    <div className="ticker-tape">
      <div className="ticker-tape-inner" style={{ animationDuration: `${duration}s` }}>
        {tape}
      </div>
    </div>
  )
}

// ── FunctionKeyBar ────────────────────────────────────────────────
export function FunctionKeyBar({ onKey, activeTab }) {
  const keys = [
    { k: 'F2',  label: 'OVERVIEW',  tab: 'overview'   },
    { k: 'F3',  label: 'FRONTIER',  tab: 'frontier'   },
    { k: 'F4',  label: 'ALLOC',     tab: 'allocation' },
    { k: 'F5',  label: 'RISK',      tab: 'risk'       },
    { k: 'F6',  label: 'BACKTEST',  tab: 'backtest'   },
    { k: 'F7',  label: 'B-L MODEL', tab: 'bl'         },
    { k: 'F8',  label: 'FACTORS',   tab: 'factors'    },
    { k: 'F9',  label: 'STRESS',    tab: 'stress'     },
    { k: 'F10', label: 'COMPARE',   tab: 'compare'    },
    { k: 'F11', label: 'SIP CALC',  tab: 'sip'        },
    { k: 'F12', label: 'SAVED DB',  tab: 'saved'      },
  ]
  return (
    <div className="fkey-bar">
      {keys.map(f => (
        <div key={f.k} className="fkey"
          onClick={() => f.tab && onKey(f.tab)}
          style={{ background: activeTab === f.tab ? '#1a0a00' : undefined }}>
          <span className="fkey-key" style={{ color: activeTab === f.tab ? B.orange : undefined }}>{f.k}</span>
          <span style={{ color: activeTab === f.tab ? B.orange : undefined }}>{f.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Shared UI components ──────────────────────────────────────────

export function Panel({ title, children, style, badge, action }) {
  return (
    <div className="bb-panel" style={style}>
      <div className="bb-panel-header">
        <span className="bb-panel-title">{title}</span>
        {badge && <span className="bb-tag outline-orange" style={{ marginLeft: 4 }}>{badge}</span>}
        <div style={{ marginLeft: 'auto' }}>{action}</div>
      </div>
      <div style={{ padding: '8px 10px', overflow: 'auto', height: 'calc(100% - 28px)' }}>
        {children}
      </div>
    </div>
  )
}

export function Metric({ label, value, color, sub, accent }) {
  const c = color || B.text
  return (
    <div className="bb-metric" style={{ borderTop: accent ? `2px solid ${c}` : undefined }}>
      <div className="bb-metric-label">{label}</div>
      <div className="bb-metric-value" style={{ color: c }}>{value}</div>
      {sub && <div className="bb-metric-sub">{sub}</div>}
    </div>
  )
}

export function SectionHead({ label, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${B.border2}`,
      paddingBottom: 4, marginBottom: 8, marginTop: 12,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        fontWeight: 700, color: B.orange,
        letterSpacing: '.1em', textTransform: 'uppercase',
      }}>{label}</span>
      {right && <span style={{ fontSize: 9, color: B.text3 }}>{right}</span>}
    </div>
  )
}

export function BBTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0a0a0a', border: `1px solid ${B.border2}`,
      padding: '6px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
    }}>
      {label && <div style={{ color: B.text3, marginBottom: 3 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || B.text }}>
          {p.name}: {fmt ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export function DataGrid({ cols, rows, onRowClick }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="bb-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: c.align || 'left' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={onRowClick ? 'hrow' : ''} onClick={() => onRowClick?.(row)}>
              {cols.map((c, ci) => (
                <td key={ci} style={{
                  textAlign: c.align || 'left',
                  color: c.color?.(row) || B.text,
                  fontWeight: c.bold ? 600 : 400,
                }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Backward-compat alias — in case any view still imports BloombergHeader
export { QuantHeader as BloombergHeader }
