/*
  App.jsx — Quant Terminal Portfolio Optimizer

  Features:
  - Orange top bar + live market clocks (MUM · NY · LON · TKY)
  - Ticker tape: your selected stocks + annual returns
  - Function key navigation (F2–F12), 11 tabs
  - OAS Ledoit-Wolf, Black-Litterman, Frank-Wolfe QP
  - Walk-Forward Backtest (zero lookahead bias)
  - Factor Analysis (β, α, IR, Treynor, Kelly, regime)
  - Stress Testing (GFC08, COVID20, DotCom00, India08)
  - Cornish-Fisher CVaR, Omega Ratio, Gain-to-Pain
  - SIP Calculator with Newton-Raphson XIRR + Step-Up
  - IndexedDB persistence for all optimization runs
*/

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  LineChart, Line, ScatterChart, Scatter, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, ReferenceLine, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

import { usePortfolioEngine } from './hooks/usePortfolioEngine.js'
import { B, STRAT, ASSET_COLS, SECTORS, TD, N_MC } from './constants/theme.js'
import {
  QuantHeader, TickerTape, FunctionKeyBar,
  Panel, Metric, SectionHead, BBTooltip, DataGrid,
} from './components/TerminalShell.jsx'
import { validateTicker, fetchPrices } from './lib/dataFetch.js'
import { corrMat } from './lib/math.js'
import { vmean } from './lib/math.js'
import { varMetrics, maxDD, sortino } from './lib/analytics.js'
import { cornishFisherVaR } from './lib/factors.js'
import { FactorView }       from './views/FactorView.jsx'
import { StressView }       from './views/StressView.jsx'
import { SIPView }          from './views/SIPView.jsx'
import { SavedResultsView } from './views/SavedResultsView.jsx'
import { saveResult }       from './lib/db.js'

// ── Helpers ──────────────────────────────────────────────────────
const fmt  = (v, d = 2) => `${(v * 100).toFixed(d)}%`
const fmtN = (v, d = 3) => (+v).toFixed(d)
const pct  = v => (v >= 0 ? '+' : '') + fmt(v)
const today = () => new Date().toISOString().split('T')[0]
const yearsAgo = n => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().split('T')[0] }

const DEFAULT_ASSETS = [
  { ticker: 'AAPL', name: 'Apple', exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'JPM',  name: 'JPMorgan', exchange: 'NYSE', currency: 'USD' },
  { ticker: 'GLD',  name: 'Gold ETF', exchange: 'NYSE', currency: 'USD' },
  { ticker: 'SPY',  name: 'S&P 500 ETF', exchange: 'NYSE', currency: 'USD' },
  { ticker: 'TLT',  name: '20yr Bond', exchange: 'NASDAQ', currency: 'USD' },
  { ticker: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', currency: 'USD' },
]

const TABS = [
  { k: 'overview',   l: 'OVERVIEW',        f: 'F2' },
  { k: 'frontier',   l: 'FRONTIER',        f: 'F3' },
  { k: 'allocation', l: 'ALLOCATION',      f: 'F4' },
  { k: 'risk',       l: 'RISK',            f: 'F5' },
  { k: 'backtest',   l: 'BACKTEST',        f: 'F6' },
  { k: 'bl',         l: 'BLACK-LITTERMAN', f: 'F7' },
  { k: 'factors',    l: 'FACTOR ANALYSIS', f: 'F8' },
  { k: 'stress',     l: 'STRESS TEST',     f: 'F9' },
  { k: 'compare',    l: 'COMPARE',         f: 'F10' },
  { k: 'sip',        l: 'SIP CALC',        f: 'F11' },
  { k: 'saved',      l: 'SAVED RESULTS',   f: 'F12' },
]

// ── TickerInput ────────────────────────────────────────────────────
function TickerInput({ onAdd, existing }) {
  const [val, setVal]   = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)
  const [err,  setErr]  = useState('')

  const check = async () => {
    const t = val.trim().toUpperCase()
    if (!t) return
    if (existing.has(t)) { setErr(`${t} ALREADY IN PORTFOLIO`); return }
    if (existing.size >= 12) { setErr('MAX 12 ASSETS'); return }
    setBusy(true); setErr(''); setInfo(null)
    try {
      const meta = await validateTicker(t)
      setInfo({ ticker: t, ...meta })
    } catch { setErr(`${t} NOT FOUND — CHECK SYMBOL (NSE needs .NS suffix)`) }
    setBusy(false)
  }

  const confirm = () => {
    if (!info) return
    onAdd(info); setVal(''); setInfo(null); setErr('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={val}
          onChange={e => { setVal(e.target.value.toUpperCase()); setInfo(null); setErr('') }}
          onKeyDown={e => e.key === 'Enter' && (info ? confirm() : check())}
          placeholder="ENTER TICKER  e.g. AAPL  RELIANCE.NS  ASML"
          className="bb-input"
          style={{ flex: 1, fontSize: 11 }}
        />
        <button onClick={check} disabled={busy || !val.trim()} className="bb-btn">
          {busy ? '...' : 'SEARCH'}
        </button>
        {info && (
          <button onClick={confirm} className="bb-btn green">+ ADD</button>
        )}
      </div>
      {err  && <div style={{ fontSize: 9, color: B.red, marginTop: 3, fontFamily: 'var(--font-mono)' }}>{err}</div>}
      {info && (
        <div style={{ marginTop: 4, padding: '4px 8px', background: '#0a1a0a', border: `1px solid ${B.green}30`, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: B.green, fontWeight: 700, fontSize: 11 }}>{info.ticker}</span>
          <span style={{ fontSize: 10 }}>{info.name}</span>
          <span style={{ fontSize: 9, color: B.text3 }}>{info.exchange} · {info.currency} · {info.type}</span>
        </div>
      )}
    </div>
  )
}

// ── Correlation heatmap ────────────────────────────────────────────
function CorrHeatmap({ tickers, retMatrix }) {
  const corr = useMemo(() => corrMat(retMatrix), [retMatrix])
  const n = tickers.length
  const sz = Math.min(46, Math.max(26, Math.floor(420 / n)))

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block' }}>
        <div style={{ display: 'flex', marginLeft: sz + 4, gap: 2, marginBottom: 2 }}>
          {tickers.map((t, j) => (
            <div key={j} style={{ width: sz, flexShrink: 0, fontSize: 7.5, color: B.text3, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t}</div>
          ))}
        </div>
        {corr.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 2, marginBottom: 2, alignItems: 'center' }}>
            <div style={{ width: sz, flexShrink: 0, fontSize: 7.5, color: B.text3, textAlign: 'right', paddingRight: 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>{tickers[i]}</div>
            {row.map((v, j) => {
              const abs = Math.abs(v), pos = v >= 0
              const r = pos ? Math.round(30 + v * (239 - 30)) : Math.round(30 + abs * (10 - 30))
              const g = pos ? Math.round(20 + v * (68 - 20))  : Math.round(20 + abs * (230 - 20))
              const b = pos ? Math.round(20 + v * (68 - 20))  : Math.round(20 + abs * (68 - 20))
              return (
                <div key={j} style={{ width: sz, height: sz, flexShrink: 0, background: `rgb(${r},${g},${b})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, color: abs > 0.5 ? 'rgba(255,255,255,.8)' : 'rgba(200,200,200,.6)' }}>
                  {v.toFixed(2)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Drawdown chart ─────────────────────────────────────────────────
function DrawdownChart({ cumPx }) {
  const data = useMemo(() => {
    let pk = cumPx[0]
    const sk = Math.max(1, Math.floor(cumPx.length / 250))
    return cumPx.filter((_, i) => i % sk === 0).map((p, i) => {
      if (p > pk) pk = p
      return { t: i * sk, dd: +(-((pk - p) / pk) * 100).toFixed(3) }
    })
  }, [cumPx])
  return (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={B.red} stopOpacity=".5" />
            <stop offset="100%" stopColor={B.red} stopOpacity=".02" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
        <XAxis hide /><YAxis tick={{ fill: B.text3, fontSize: 8 }} tickFormatter={v => `${v}%`} />
        <Tooltip content={<BBTooltip fmt={v => `${v}%`} />} />
        <ReferenceLine y={0} stroke={B.border} />
        <Area type="monotone" dataKey="dd" stroke={B.red} strokeWidth={1.5} fill="url(#ddg)" name="Drawdown" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Return histogram ───────────────────────────────────────────────
function RetHist({ rets }) {
  const bins = useMemo(() => {
    if (!rets?.length) return []
    const s = [...rets].sort((a, b) => a - b), mn = s[0], mx = s[s.length - 1], nb = 32, bw = (mx - mn) / nb
    return Array.from({ length: nb }, (_, i) => {
      const lo = mn + i * bw, hi = lo + bw
      return { x: +((lo + hi) / 2 * 100).toFixed(2), n: rets.filter(r => r >= lo && r < hi).length }
    })
  }, [rets])
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 16, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
        <XAxis dataKey="x" tick={{ fill: B.text3, fontSize: 8 }} interval={6} label={{ value: 'Daily Return (%)', position: 'insideBottom', offset: -8, fill: B.text3, fontSize: 9 }} />
        <YAxis hide />
        <Tooltip content={<BBTooltip fmt={v => `${v} days`} />} />
        <Bar dataKey="n" radius={[1, 1, 0, 0]}>
          {bins.map((b, i) => <Cell key={i} fill={parseFloat(b.x) >= 0 ? B.green : B.red} fillOpacity={.75} />)}
        </Bar>
        <ReferenceLine x="0.00" stroke={B.amber} strokeWidth={1.5} strokeDasharray="4 2" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [assets, setAssets]       = useState(DEFAULT_ASSETS)
  const [startDate, setStart]     = useState(yearsAgo(5))
  const [endDate, setEnd]         = useState(today())
  const [rf, setRf]               = useState(4.5)
  const [txBps, setTxBps]         = useState(10)
  const [tab, setTab]             = useState('overview')
  const [strat, setStrat]         = useState('maxSharpe')
  const [openSector, setOpenSector] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [saveStatus, setSaveStatus]   = useState('idle') // idle | saving | saved | error

  const { status, loadMsg, progress, engine, fetchErrors, run } = usePortfolioEngine()
  const tickerSet = useMemo(() => new Set(assets.map(a => a.ticker)), [assets])

  const addAsset = info => {
    if (tickerSet.has(info.ticker) || assets.length >= 12) return
    setAssets(prev => [...prev, info])
  }
  const removeAsset = t => setAssets(prev => prev.filter(a => a.ticker !== t))
  const handleRun   = () => run(assets, startDate, endDate, rf, txBps)

  const handleSave = async () => {
    if (!engine) return
    setSaveStatus('saving')
    try {
      await saveResult(engine)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.key >= 'F2' && e.key <= 'F12') {
        e.preventDefault()
        const map = { F2:'overview', F3:'frontier', F4:'allocation', F5:'risk', F6:'backtest', F7:'bl', F8:'factors', F9:'stress', F10:'compare', F11:'sip', F12:'saved' }
        if (map[e.key]) setTab(map[e.key])
      }
      if (e.key === 'F12') { e.preventDefault(); handleRun() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [assets, startDate, endDate, rf, txBps])

  // ── Derived data ─────────────────────────────────────────────────
  const opt    = engine?.inSample?.[strat]
  const wfOpt  = engine?.wf?.[strat]
  const active = engine?.canWF ? wfOpt : opt

  const wfBtData = useMemo(() => {
    if (!engine?.canWF) return []
    const N = engine.wf.maxSharpe.cum.length
    const sk = Math.max(1, Math.floor(N / 300))
    return Array.from({ length: Math.floor(N / sk) }, (_, i) => {
      const idx = i * sk, obj = { t: idx }
      Object.keys(engine.wf).forEach(k => { obj[k] = +((engine.wf[k].cum[idx] - 1) * 100).toFixed(2) })
      return obj
    })
  }, [engine])

  const mcFiltered = useMemo(() => {
    if (!engine?.mc) return []
    const ev = Math.ceil(engine.mc.length / 1500)
    return engine.mc.filter((_, i) => i % ev === 0)
      .filter(p => isFinite(p.sharpe) && p.vol > 0 && p.ret > -1 && p.ret < 4)
      .map(p => ({ vol: +(p.vol * 100).toFixed(3), ret: +(p.ret * 100).toFixed(3), sh: +p.sharpe.toFixed(2) }))
  }, [engine])

  const wData = useMemo(() => {
    if (!opt || !engine) return []
    return engine.tickers.map((t, i) => ({
      ticker: t, weight: +(opt.w[i] * 100).toFixed(2),
      rc: opt.rc ? +opt.rc[i].prc.toFixed(2) : 0,
      col: ASSET_COLS[i % ASSET_COLS.length],
      name: engine.assets.find(a => a.ticker === t)?.name || t,
      mu: engine.muD[i] * TD, sig: Math.sqrt(engine.cov[i][i] * TD),
    })).sort((a, b) => b.weight - a.weight)
  }, [opt, engine])

  // ── Sidebar ───────────────────────────────────────────────────────
  const Sidebar = () => (
    <div style={{
      width: sidebarOpen ? 280 : 0,
      flexShrink: 0,
      background: B.surface,
      borderRight: `1px solid ${B.border}`,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'width .2s',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${B.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: B.orange, letterSpacing: '.1em' }}>PORTFOLIO SETUP</span>
        <button onClick={() => setSidebarOpen(false)} className="bb-btn" style={{ padding: '2px 6px', fontSize: 9 }}>◀</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Ticker search */}
        <div>
          <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>ADD SECURITY</div>
          <TickerInput onAdd={addAsset} existing={tickerSet} />
        </div>

        {/* Sector presets */}
        <div>
          <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>QUICK-ADD SECTOR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {Object.keys(SECTORS).map(s => (
              <button key={s} onClick={() => setOpenSector(openSector === s ? null : s)} className="bb-btn"
                style={{ fontSize: 8, padding: '2px 6px', color: openSector === s ? B.orange : B.text3, borderColor: openSector === s ? B.orange : B.border }}>
                {s}
              </button>
            ))}
          </div>
          {openSector && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
              {SECTORS[openSector].map(t => {
                const added = tickerSet.has(t)
                return (
                  <button key={t} className="bb-btn" onClick={() => !added && assets.length < 12 && addAsset({ ticker: t, name: t, exchange: '?', currency: 'USD' })}
                    style={{ fontSize: 8.5, padding: '2px 7px', color: added ? B.green : B.text2, borderColor: added ? B.green : B.border }}>
                    {t}{added ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Asset chips */}
        <div>
          <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>
            PORTFOLIO [{assets.length}/12]
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {assets.map((a, i) => (
              <div key={a.ticker} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: B.panel, border: `1px solid ${B.border}`,
                padding: '3px 7px',
              }}>
                <div style={{ width: 3, height: 14, background: ASSET_COLS[i % ASSET_COLS.length], flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ASSET_COLS[i % ASSET_COLS.length], fontFamily: 'var(--font-mono)' }}>{a.ticker}</span>
                <span style={{ fontSize: 9, color: B.text3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name.slice(0, 14)}</span>
                <button onClick={() => removeAsset(a.ticker)} style={{ background: 'none', border: 'none', color: B.text3, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>DATE RANGE</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {['1Y','2Y','3Y','5Y'].map(p => {
              const s = yearsAgo(parseInt(p)); const active2 = startDate === s && endDate === today()
              return <button key={p} className={`bb-btn ${active2 ? 'active' : ''}`} style={{ flex: 1, fontSize: 9, padding: '3px 0' }} onClick={() => { setStart(s); setEnd(today()) }}>{p}</button>
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input type="date" value={startDate} max={endDate} onChange={e => setStart(e.target.value)} className="bb-input" style={{ fontSize: 10 }} />
            <input type="date" value={endDate} min={startDate} max={today()} onChange={e => setEnd(e.target.value)} className="bb-input" style={{ fontSize: 10 }} />
          </div>
        </div>

        {/* Parameters */}
        <div>
          <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>PARAMETERS</div>
          {[
            { l: `RISK-FREE RATE: ${rf}%`, v: rf, set: setRf, min: 0, max: 10, step: .1 },
            { l: `TX COST: ${txBps} BPS`,  v: txBps, set: setTxBps, min: 0, max: 100, step: 1 },
          ].map(({ l, v, set, min, max, step }) => (
            <div key={l} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: B.text3, marginBottom: 2 }}>{l}</div>
              <input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} style={{ accentColor: B.orange }} />
            </div>
          ))}
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={status === 'loading' || assets.length < 3}
          className="bb-btn"
          style={{
            background: status === 'loading' ? B.border : B.orange,
            color: status === 'loading' ? B.text3 : '#000',
            borderColor: B.orange, fontWeight: 700, fontSize: 11,
            padding: '8px', letterSpacing: '.1em',
          }}
        >
          {status === 'loading' ? '⟳ COMPUTING...' : '⚡ F12 RUN OPTIMIZER'}
        </button>

        {status === 'loading' && (
          <div>
            <div style={{ fontSize: 9, color: B.orange, marginBottom: 3, lineHeight: 1.6 }}>{loadMsg}</div>
            <div className="bb-progress-track">
              <div className="bb-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Strategy selector */}
        {engine && (
          <div>
            <div style={{ fontSize: 9, color: B.text3, marginBottom: 4, letterSpacing: '.08em' }}>ACTIVE STRATEGY</div>
            {STRAT.map(s => (
              <button key={s.k} onClick={() => setStrat(s.k)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 8px', marginBottom: 3,
                  background: strat === s.k ? `${s.col}18` : B.panel,
                  border: `1px solid ${strat === s.k ? s.col : B.border}`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ width: 3, height: 14, background: s.col, flexShrink: 0, display: 'block' }} />
                <span style={{ fontSize: 9.5, color: strat === s.k ? s.col : B.text3, fontFamily: 'var(--font-mono)', fontWeight: strat === s.k ? 700 : 400 }}>{s.short} {s.label}</span>
                {engine.canWF && engine.wf[s.k] && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: strat === s.k ? s.col : B.text3 }}>
                    {engine.wf[s.k].sharpe.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Save result button */}
        {engine && (
          <div style={{ paddingTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="bb-btn"
              style={{
                width: '100%', padding: '7px', fontSize: 10,
                fontWeight: 700, letterSpacing: '.08em',
                background: saveStatus === 'saved' ? B.greenBg : saveStatus === 'error' ? B.redBg : B.surface,
                border: `1px solid ${saveStatus === 'saved' ? B.green : saveStatus === 'error' ? B.red : B.green}`,
                color: saveStatus === 'saved' ? B.green : saveStatus === 'error' ? B.red : B.green,
              }}
            >
              {saveStatus === 'saving' ? '⟳ SAVING...' : saveStatus === 'saved' ? '✓ SAVED TO DB' : saveStatus === 'error' ? '⚠ SAVE FAILED' : '💾 SAVE RESULT'}
            </button>
            <div style={{ fontSize: 7.5, color: B.text3, textAlign: 'center', marginTop: 3 }}>
              persists across refresh · IndexedDB
            </div>
          </div>
        )}
      </div>

      {/* Error alerts */}
      {fetchErrors.length > 0 && (
        <div style={{ padding: '6px 10px', background: B.redBg, borderTop: `1px solid ${B.red}30`, fontSize: 9, color: B.red }}>
          ⚠ FETCH FAILED: {fetchErrors.map(e => e.ticker).join(', ')} → GBM SIM USED
        </div>
      )}
    </div>
  )

  // ── Tab content ───────────────────────────────────────────────────
  const renderTab = () => {
    // These tabs work without engine
    if (tab === 'sip')   return <SIPView />
    if (tab === 'saved') return <SavedResultsView />

    if (!engine) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div style={{ fontFamily: '"Oswald", sans-serif', fontSize: 32, color: B.orange, letterSpacing: '.12em' }}>QUANT</div>
        <div style={{ fontFamily: '"Oswald", sans-serif', fontSize: 18, color: B.text2, letterSpacing: '.06em' }}>TERMINAL</div>
        <div style={{ fontSize: 10, color: B.text3, textAlign: 'center', maxWidth: 500, lineHeight: 1.8 }}>
          SELECT SECURITIES · SET DATE RANGE · PRESS F12 OR CLICK RUN<br />
          OAS LEDOIT-WOLF · BLACK-LITTERMAN · FRANK-WOLFE QP · WALK-FORWARD<br />
          CORNISH-FISHER VaR · FACTOR ANALYSIS · STRESS TESTING · KELLY CRITERION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: '100%', maxWidth: 600 }}>
          {['ANY TICKER WORLDWIDE','NSE/BSE/NYSE/NASDAQ','REAL YAHOO FINANCE DATA','GBM SIMULATION FALLBACK',
            'OAS SHRINKAGE (CHEN 2010)','FRANK-WOLFE MAX SHARPE','HE-LITTERMAN BL MODEL','ERC RISK PARITY',
            'ZERO LOOK-AHEAD BACKTEST','JENSEN α & β FACTOR','6 STRESS SCENARIOS','KELLY CRITERION SIZING'].map(f => (
            <div key={f} style={{ border: `1px solid ${B.border}`, background: B.surface, padding: '5px 8px', fontSize: 8.5, color: B.text3, textAlign: 'center' }}>{f}</div>
          ))}
        </div>
      </div>
    )

    switch (tab) {
      case 'overview': return <OverviewTab engine={engine} strat={strat} wfBtData={wfBtData} active={active} wfOpt={wfOpt} />
      case 'frontier': return <FrontierTab engine={engine} strat={strat} setStrat={setStrat} mcFiltered={mcFiltered} />
      case 'allocation': return <AllocationTab engine={engine} strat={strat} wData={wData} opt={opt} />
      case 'risk': return <RiskTab engine={engine} strat={strat} active={active} wfOpt={wfOpt} />
      case 'backtest': return <BacktestTab engine={engine} strat={strat} setStrat={setStrat} wfBtData={wfBtData} />
      case 'bl': return <BLTab engine={engine} />
      case 'factors': return <FactorView engine={{ ...engine, rf }} strat={strat} />
      case 'stress': return <StressView engine={engine} strat={strat} />
      case 'compare': return <CompareTab engine={engine} strat={strat} setStrat={setStrat} />
      default: return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {/* Quant Terminal header */}
      <QuantHeader assetsCount={assets.length} status={status} dataSrc={engine ? (fetchErrors.length === assets.length ? 'GBM Simulation' : 'Yahoo Finance (live)') : ''} />

      {/* Ticker tape */}
      <TickerTape assets={assets} engine={engine} />

      {/* Tab bar */}
      <div style={{ display: 'flex', background: B.surface, borderBottom: `1px solid ${B.border}`, flexShrink: 0, overflowX: 'auto' }}>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="bb-btn" style={{ padding: '6px 10px', fontSize: 9, borderRadius: 0, borderTop: 'none', borderLeft: 'none' }}>▶ SETUP</button>
        )}
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{
              padding: '7px 14px', background: tab === t.k ? '#1a0a00' : 'transparent',
              border: 'none', borderRight: `1px solid ${B.border}`,
              borderBottom: tab === t.k ? `2px solid ${B.orange}` : '2px solid transparent',
              color: tab === t.k ? B.orange : B.text3,
              cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
              fontWeight: tab === t.k ? 700 : 400, whiteSpace: 'nowrap',
              letterSpacing: '.05em', transition: 'all .1s',
            }}
          >
            <span style={{ color: B.text3, fontSize: 8, marginRight: 4 }}>{t.f}</span>
            {t.l}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'auto', padding: 10 }} className="screen-enter">
          {renderTab()}
        </div>
      </div>

      {/* Function key bar */}
      <FunctionKeyBar onKey={setTab} activeTab={tab} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ══════════════════════════════════════════════════════════════════

function OverviewTab({ engine, strat, wfBtData, active, wfOpt }) {
  const stratInfo = STRAT.find(s => s.k === strat)
  const metrics = active ? [
    { l: 'CAGR', v: fmt(active.cagr ?? active.ret), c: (active.cagr ?? active.ret) > 0 ? B.green : B.red, a: true },
    { l: 'ANN VOL', v: fmt(active.vol), c: B.amber },
    { l: 'SHARPE', v: fmtN(active.sharpe), c: active.sharpe > 1 ? B.green : active.sharpe > 0 ? B.amber : B.red, a: active.sharpe > 1 },
    { l: 'SORTINO', v: fmtN(active.sortino ?? 0), c: (active.sortino ?? 0) > 1 ? B.green : B.amber },
    { l: 'MAX DD', v: fmt(active.mdd ?? 0), c: B.red },
    { l: 'VaR 95%', v: fmt(active.var95 ?? 0), c: B.red },
    { l: 'CVaR 95%', v: fmt(active.cvar95 ?? 0), c: B.red },
    { l: 'VaR 99%', v: fmt(active.var99 ?? 0), c: '#ff0022' },
    { l: 'CVaR 99%', v: fmt(active.cvar99 ?? 0), c: '#ff0022' },
    { l: 'CALMAR', v: fmtN((active.mdd ?? 0) > 0 ? (active.cagr ?? active.ret) / (active.mdd) : 0), c: B.text2 },
  ] : []

  // Cornish-Fisher VaR for active strategy
  const cfVar = useMemo(() => {
    const rets = wfOpt?.portRets
    if (!rets?.length) return null
    return { var95: cornishFisherVaR(rets, 0.05), var99: cornishFisherVaR(rets, 0.01) }
  }, [wfOpt])

  // Price index
  const priceData = useMemo(() => {
    if (!engine?.prices) return []
    const N = engine.prices[0].length
    const sk = Math.max(1, Math.floor(N / 200))
    return engine.prices[0].filter((_, i) => i % sk === 0).map((_, i) => {
      const obj = { t: i * sk }
      engine.tickers.forEach((t, j) => {
        const base = engine.prices[j][0]
        obj[t] = +((engine.prices[j][i * sk] / base) * 100).toFixed(2)
      })
      return obj
    })
  }, [engine])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

      {/* Left: metrics + equity curves */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: '"Oswald", sans-serif', fontSize: 14, color: B.orange, letterSpacing: '.06em' }}>
            {stratInfo?.label ?? strat}
          </span>
          <span className="bb-tag orange">{engine.canWF ? 'WALK-FORWARD ✓' : 'IN-SAMPLE'}</span>
          <span className="bb-tag outline-orange">{engine.n} ASSETS · {engine.yrs?.toFixed(1)}Y</span>
          <span style={{ fontSize: 9, color: B.text3, marginLeft: 'auto' }}>OAS ρ={engine.rho?.toFixed(4)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {metrics.map(m => <Metric key={m.l} label={m.l} value={m.v} color={m.c} accent={m.a} />)}
        </div>

        {/* Cornish-Fisher CVaR */}
        {cfVar && (
          <div style={{ background: B.surface, border: `1px solid ${B.border}`, padding: '6px 10px' }}>
            <SectionHead label="Cornish-Fisher Adjusted VaR (fat-tail corrected)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Metric label="CF-VaR 95%" value={fmt(cfVar.var95)} color={B.red} sub="Skew/kurtosis adjusted" />
              <Metric label="CF-VaR 99%" value={fmt(cfVar.var99)} color="#ff0022" sub="Cornish-Fisher expansion" />
            </div>
            <div style={{ fontSize: 9, color: B.text3, marginTop: 4, lineHeight: 1.6 }}>
              z_CF = z_N + (z²−1)/6·S + (z³−3z)/24·K − (2z³−5z)/36·S² where S=skewness, K=excess kurtosis
            </div>
          </div>
        )}

        {/* WF equity curves */}
        {engine.canWF && (
          <>
            <SectionHead label="Walk-Forward Equity Curves (out-of-sample)" />
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={wfBtData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
                <XAxis hide />
                <YAxis tick={{ fill: B.text3, fontSize: 8 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<BBTooltip fmt={v => `${Number(v).toFixed(1)}%`} />} />
                <ReferenceLine y={0} stroke={B.border} />
                {STRAT.map(s => (
                  <Line key={s.k} type="monotone" dataKey={s.k} stroke={s.col} dot={false}
                    strokeWidth={strat === s.k ? 2.5 : 1} name={s.label} strokeOpacity={strat === s.k ? 1 : 0.4} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Right: price index + drawdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionHead label="Normalised Price Index (base = 100)" />
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={priceData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
            <XAxis hide /><YAxis tick={{ fill: B.text3, fontSize: 8 }} />
            <Tooltip content={<BBTooltip />} />
            {engine.tickers.map((t, i) => (
              <Line key={t} type="monotone" dataKey={t} stroke={ASSET_COLS[i % ASSET_COLS.length]} dot={false} strokeWidth={1.5} name={t} opacity={.9} />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {engine.canWF && wfOpt && (
          <>
            <SectionHead label="Underwater Chart (Max Sharpe)" />
            <DrawdownChart cumPx={wfOpt.cum} />
          </>
        )}

        {wfOpt?.portRets && (
          <>
            <SectionHead label="Daily Return Distribution" />
            <RetHist rets={wfOpt.portRets} />
          </>
        )}
      </div>
    </div>
  )
}

function FrontierTab({ engine, strat, setStrat, mcFiltered }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: B.amber, padding: '4px 8px', background: '#1a1200', border: `1px solid ${B.amber}20`, marginBottom: 8 }}>
        ⚠ IN-SAMPLE FRONTIER — VISUAL REFERENCE ONLY. ALL PERFORMANCE METRICS USE WALK-FORWARD BACKTEST.
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 28 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={B.border} />
          <XAxis type="number" dataKey="vol" tick={{ fill: B.text3, fontSize: 9 }}
            label={{ value: 'Annualised Volatility (%)', position: 'insideBottom', offset: -16, fill: B.text3, fontSize: 9 }}
            tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
          <YAxis type="number" dataKey="ret" tick={{ fill: B.text3, fontSize: 9 }}
            label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', offset: 14, fill: B.text3, fontSize: 9 }}
            tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
          <Tooltip cursor={{ strokeDasharray: '3 3', stroke: B.border2 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div style={{ background: B.surface, border: `1px solid ${B.border2}`, padding: '6px 10px', fontSize: 10, fontFamily: 'IBM Plex Mono' }}>
                  <div style={{ color: B.text3 }}>VOL: {d?.vol?.toFixed(2)}%</div>
                  <div style={{ color: B.green }}>RET: {d?.ret?.toFixed(2)}%</div>
                  <div style={{ color: B.orange }}>SR: {(d?.sh ?? d?.sharpe)?.toFixed(3)}</div>
                </div>
              )
            }} />
          <Scatter name="MC" data={mcFiltered} opacity={.5}>
            {mcFiltered.map((p, i) => {
              const t = Math.min(Math.max((p.sh + .5) / 3.5, 0), 1)
              return <Cell key={i} fill={`hsl(${Math.round(15 + t * 30)},${Math.round(60 + t * 40)}%,${Math.round(25 + t * 35)}%)`} />
            })}
          </Scatter>
          {STRAT.map(s => {
            const o = engine.inSample[s.k]
            return o && <Scatter key={s.k} name={s.label} data={[{ vol: +(o.vol * 100).toFixed(2), ret: +(o.ret * 100).toFixed(2), sh: +o.sharpe.toFixed(3) }]} fill={s.col} opacity={1} r={9} />
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {STRAT.map(s => {
          const o = engine.inSample[s.k]
          return o && (
            <button key={s.k} onClick={() => setStrat(s.k)} className="bb-btn"
              style={{ borderColor: strat === s.k ? s.col : B.border, color: strat === s.k ? s.col : B.text3 }}>
              <span style={{ width: 8, height: 8, background: s.col, display: 'inline-block', marginRight: 5 }} />
              {s.label} SR={o.sharpe.toFixed(2)}
            </button>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: B.text3 }}>
          <div style={{ width: 12, height: 6, background: 'linear-gradient(90deg,hsl(15,60%,25%),hsl(45,100%,60%))', }} />
          MC (colour = Sharpe)
        </div>
      </div>
    </div>
  )
}

function AllocationTab({ engine, strat, wData, opt }) {
  if (!opt) return null
  const stratInfo = STRAT.find(s => s.k === strat)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <SectionHead label={`Weights — ${stratInfo?.label}`} />
        <ResponsiveContainer width="100%" height={Math.max(160, wData.length * 28)}>
          <BarChart data={wData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 60 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false} />
            <XAxis type="number" tick={{ fill: B.text3, fontSize: 9 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: B.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} />
            <Tooltip content={<BBTooltip fmt={v => `${v?.toFixed(2)}%`} />} />
            <Bar dataKey="weight" name="Weight" radius={[0, 2, 2, 0]}>
              {wData.map((d, i) => <Cell key={i} fill={d.col} fillOpacity={.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <SectionHead label="Risk Contribution %" />
        <ResponsiveContainer width="100%" height={Math.max(160, wData.length * 28)}>
          <BarChart data={wData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 60 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false} />
            <XAxis type="number" tick={{ fill: B.text3, fontSize: 9 }} tickFormatter={v => `${v?.toFixed(0)}%`} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: B.text3, fontSize: 9.5, fontFamily: 'IBM Plex Mono' }} />
            <Tooltip content={<BBTooltip fmt={v => `${v?.toFixed(2)}%`} />} />
            <Bar dataKey="rc" name="Risk %" radius={[0, 2, 2, 0]}>
              {wData.map((d, i) => <Cell key={i} fill={B.red} fillOpacity={.3 + .7 * d.rc / Math.max(...wData.map(x => x.rc), 1)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <SectionHead label="Per-Asset Decomposition" />
        <div style={{ overflowX: 'auto' }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['TICKER', 'NAME', 'WEIGHT', 'RISK%', 'μ ANN', 'σ ANN', 'SHARPE'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {wData.map((d, i) => (
                <tr key={d.ticker} style={{ background: i % 2 === 0 ? 'transparent' : B.surface }}>
                  <td style={{ color: d.col, fontWeight: 700 }}>{d.ticker}</td>
                  <td style={{ fontSize: 9.5, color: B.text2 }}>{d.name.slice(0, 14)}</td>
                  <td style={{ color: d.weight > 30 ? B.amber : B.text }}>{d.weight.toFixed(2)}%</td>
                  <td style={{ color: B.red }}>{d.rc?.toFixed(2)}%</td>
                  <td style={{ color: d.mu > 0 ? B.green : B.red }}>{fmt(d.mu)}</td>
                  <td style={{ color: B.amber }}>{fmt(d.sig)}</td>
                  <td style={{ color: (d.mu - 4.5 / 100) / d.sig > 1 ? B.green : (d.mu - 4.5 / 100) / d.sig > 0 ? B.amber : B.red }}>
                    {((d.mu - 4.5 / 100) / Math.max(d.sig, 1e-10)).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Correlation heatmap */}
        <SectionHead label="Correlation Matrix (OAS-Shrunk)" />
        <CorrHeatmap tickers={engine.tickers} retMatrix={engine.rets} />
      </div>
    </div>
  )
}

function RiskTab({ engine, strat, active, wfOpt }) {
  if (!active) return null
  const cfVar = useMemo(() => {
    const rets = wfOpt?.portRets
    if (!rets?.length) return null
    return { var95: cornishFisherVaR(rets, 0.05), var99: cornishFisherVaR(rets, 0.01) }
  }, [wfOpt])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
      {[
        { l: 'VaR 95% (1D)',    v: fmt(active.var95  ?? 0), c: B.red,    s: 'Historical sim' },
        { l: 'CVaR 95% (1D)',   v: fmt(active.cvar95 ?? 0), c: B.red,    s: 'Expected shortfall' },
        { l: 'VaR 99% (1D)',    v: fmt(active.var99  ?? 0), c: '#ff0022',s: 'Historical sim' },
        { l: 'CVaR 99% (1D)',   v: fmt(active.cvar99 ?? 0), c: '#ff0022',s: 'Expected shortfall' },
        ...(cfVar ? [
          { l: 'CF-VaR 95%',   v: fmt(cfVar.var95), c: B.red,    s: 'Cornish-Fisher' },
          { l: 'CF-VaR 99%',   v: fmt(cfVar.var99), c: '#ff0022',s: 'Fat-tail adjusted' },
        ] : []),
        { l: 'MAX DRAWDOWN',   v: fmt(active.mdd  ?? 0), c: B.red,    s: 'Peak-to-trough' },
        { l: 'SORTINO',        v: fmtN(active.sortino ?? 0), c: (active.sortino ?? 0) > 1 ? B.green : B.amber, s: 'Downside dev.' },
        { l: 'CALMAR',         v: fmtN((active.mdd ?? 0) > 0 ? (active.cagr ?? active.ret) / active.mdd : 0), c: B.text2, s: 'CAGR/MaxDD' },
        { l: 'SHARPE (WF)',    v: fmtN(active.sharpe ?? 0), c: (active.sharpe ?? 0) > 1 ? B.green : B.amber, s: 'Walk-forward' },
      ].map(m => <Metric key={m.l} label={m.l} value={m.v} color={m.c} sub={m.s} />)}
    </div>
  )
}

function BacktestTab({ engine, strat, setStrat, wfBtData }) {
  if (!engine.canWF) return (
    <div style={{ padding: 24, color: B.amber, textAlign: 'center', fontSize: 11 }}>
      EXTEND DATE RANGE BEYOND 520 TRADING DAYS TO ENABLE WALK-FORWARD BACKTEST
    </div>
  )
  return (
    <div>
      <div style={{ fontSize: 9, color: B.green, padding: '5px 8px', background: '#001a0a', border: `1px solid ${B.green}20`, marginBottom: 8 }}>
        ZERO LOOK-AHEAD WALK-FORWARD · EST_WIN=252D · REBAL=21D · TX={engine.txBps ?? 10}BPS
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={wfBtData} margin={{ top: 4, right: 12, bottom: 4, left: 28 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
          <XAxis hide />
          <YAxis tick={{ fill: B.text3, fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <Tooltip content={<BBTooltip fmt={v => `${Number(v).toFixed(1)}%`} />} />
          <ReferenceLine y={0} stroke={B.border} />
          {STRAT.map(s => (
            <Line key={s.k} type="monotone" dataKey={s.k} stroke={s.col} dot={false}
              strokeWidth={strat === s.k ? 2.5 : 1} name={s.label} strokeOpacity={strat === s.k ? 1 : 0.45} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table className="bb-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              {['STRATEGY', 'CAGR', 'VOL', 'SHARPE', 'SORTINO', 'CALMAR', 'MAX DD', 'VaR 95%', 'CVaR 95%'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {STRAT.map(s => {
              const w = engine.wf[s.k]; if (!w) return null
              return (
                <tr key={s.k} className="hrow" onClick={() => setStrat(s.k)} style={{ background: strat === s.k ? `${s.col}08` : 'transparent' }}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 3, height: 14, background: s.col, display: 'block' }} />
                    <span style={{ color: strat === s.k ? s.col : B.text }}>{s.label}</span>
                  </td>
                  {[
                    { v: fmt(w.cagr),    c: w.cagr    > 0 ? B.green : B.red },
                    { v: fmt(w.vol),     c: B.amber },
                    { v: fmtN(w.sharpe), c: w.sharpe  > 1 ? B.green : w.sharpe > 0 ? B.amber : B.red },
                    { v: fmtN(w.sortino),c: w.sortino > 1 ? B.green : B.amber },
                    { v: fmtN(w.mdd > 0 ? w.cagr / w.mdd : 0), c: B.text2 },
                    { v: fmt(w.mdd),     c: B.red },
                    { v: fmt(w.var95),   c: B.red },
                    { v: fmt(w.cvar95),  c: '#ff0022' },
                  ].map((m, i) => <td key={i} style={{ color: m.c }}>{m.v}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BLTab({ engine }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <div style={{ background: B.surface, border: `1px solid ${B.border}`, padding: '10px 14px', marginBottom: 8 }}>
          <SectionHead label="He-Litterman BL Posterior (1999)" />
          <div style={{ fontSize: 9.5, color: B.text3, lineHeight: 2.1, fontFamily: 'IBM Plex Mono' }}>
            <div><span style={{ color: B.text }}>EQUILIBRIUM:  </span> Π = λΣw_mkt  (λ=2.5)</div>
            <div><span style={{ color: B.text }}>VIEWS:        </span> P·μ = Q + ε,  ε~N(0,Ω),  Ω=τPΣP^T</div>
            <div><span style={{ color: B.text }}>PRECISION:    </span> M = (τΣ)⁻¹ + P^T·Ω⁻¹·P</div>
            <div><span style={{ color: B.orange }}>POSTERIOR μ_BL: M⁻¹·[(τΣ)⁻¹·Π + P^T·Ω⁻¹·Q]</span></div>
            <div><span style={{ color: B.text }}>POSTERIOR Σ_BL: Σ + M⁻¹</span></div>
            <div><span style={{ color: B.text }}>PARAMS:       </span> τ=0.05 · K={engine.views?.length ?? 0} views</div>
          </div>
        </div>
        <SectionHead label="Views Table" />
        <div style={{ overflowX: 'auto' }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>{['#', 'DESCRIPTION', 'P LOADINGS', 'Q ANN%', 'Ω (UNC)'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(engine.views ?? []).map((v, i) => {
                const pStr = v.p.map((x, j) => x !== 0 ? `${x > 0 ? '+' : ''}${x}×${engine.tickers[j]}` : '').filter(Boolean).join(', ')
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : B.surface }}>
                    <td style={{ color: B.text3 }}>{i + 1}</td>
                    <td style={{ fontSize: 9, color: B.text2 }}>{v.label ?? '—'}</td>
                    <td style={{ fontSize: 9, color: B.cyan }}>{pStr}</td>
                    <td style={{ color: v.q > 0 ? B.green : B.red }}>{(v.q * TD * 100).toFixed(2)}%</td>
                    <td style={{ color: B.amber }}>{(v.omega * TD * 100).toFixed(2)}%²</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <SectionHead label="CAPM Prior Π vs BL Posterior μ_BL (Annual %)" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={engine.tickers.map((t, i) => ({ ticker: t, prior: +((engine.PI?.[i] ?? 0) * 100 * TD).toFixed(2), posterior: +((engine.muBL?.[i] ?? 0) * 100).toFixed(2) }))} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
            <XAxis dataKey="ticker" tick={{ fill: B.text3, fontSize: 9 }} />
            <YAxis tick={{ fill: B.text3, fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <Tooltip content={<BBTooltip fmt={v => `${v?.toFixed(2)}%`} />} />
            <ReferenceLine y={0} stroke={B.border} />
            <Bar dataKey="prior"     name="Prior Π"       fill={B.border2} fillOpacity={.9} radius={[2, 2, 0, 0]} />
            <Bar dataKey="posterior" name="Posterior μ_BL" fill={B.orange}  fillOpacity={.85} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CompareTab({ engine, strat, setStrat }) {
  if (!engine.canWF) return (
    <div style={{ padding: 24, color: B.amber, textAlign: 'center', fontSize: 11 }}>
      WALK-FORWARD DATA REQUIRED FOR COMPARISON
    </div>
  )
  const radarData = [
    { m: 'RETURN',   ...Object.fromEntries(STRAT.map(s => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].cagr + .3) * 120))])) },
    { m: 'SHARPE',   ...Object.fromEntries(STRAT.map(s => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].sharpe + 1) * 33))])) },
    { m: 'LOW VOL',  ...Object.fromEntries(STRAT.map(s => [s.k, Math.max(0, 100 - engine.wf[s.k].vol * 300)])) },
    { m: 'SORTINO',  ...Object.fromEntries(STRAT.map(s => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].sortino + .5) * 28))])) },
    { m: 'LOW DD',   ...Object.fromEntries(STRAT.map(s => [s.k, Math.max(0, 100 - engine.wf[s.k].mdd * 250)])) },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <SectionHead label="Strategy Radar — Walk-Forward Metrics" />
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={B.border} />
            <PolarAngleAxis dataKey="m" tick={{ fill: B.text3, fontSize: 9, fontFamily: 'IBM Plex Mono' }} />
            {STRAT.map(s => <Radar key={s.k} dataKey={s.k} stroke={s.col} fill={s.col} fillOpacity={.06} strokeWidth={1.5} name={s.label} />)}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <SectionHead label="Full Performance Table (Walk-Forward)" />
        <div style={{ overflowX: 'auto' }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>{['STRATEGY', 'CAGR', 'VOL', 'SHARPE', 'SORTINO', 'MAX DD', 'VaR95', 'CVaR95', 'CALMAR'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {STRAT.map(s => {
                const w = engine.wf[s.k]; if (!w) return null
                return (
                  <tr key={s.k} className="hrow" onClick={() => setStrat(s.k)} style={{ background: strat === s.k ? `${s.col}08` : 'transparent' }}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 3, height: 14, background: s.col, display: 'block' }} />
                      <span style={{ color: s.col, fontSize: 9.5 }}>{s.short}</span>
                      <span style={{ color: strat === s.k ? s.col : B.text, fontSize: 9 }}>{s.label}</span>
                    </td>
                    {[
                      { v: fmt(w.cagr), c: w.cagr > 0 ? B.green : B.red },
                      { v: fmt(w.vol), c: B.amber },
                      { v: fmtN(w.sharpe), c: w.sharpe > 1 ? B.green : w.sharpe > 0 ? B.amber : B.red },
                      { v: fmtN(w.sortino), c: w.sortino > 1 ? B.green : B.amber },
                      { v: fmt(w.mdd), c: B.red },
                      { v: fmt(w.var95), c: B.red },
                      { v: fmt(w.cvar95), c: '#ff0022' },
                      { v: fmtN(w.mdd > 0 ? w.cagr / w.mdd : 0), c: B.text2 },
                    ].map((m, i) => <td key={i} style={{ color: m.c }}>{m.v}</td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
