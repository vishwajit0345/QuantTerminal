/*
  SavedResultsView.jsx — Persistent Results Database (IndexedDB)

  Shows all previously saved optimization runs stored in IndexedDB.
  Results survive page refresh and browser restart.
  User can:
    - View all saved runs in a table
    - Rename any saved run
    - Delete individual runs
    - Clear all runs
    - Expand any run to see full strategy metrics + equity curve
    - Compare two saved runs side by side
*/

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { B, STRAT, ASSET_COLS } from '../constants/theme.js'
import { getAllResults, deleteResult, clearAllResults, updateLabel } from '../lib/db.js'

const fmt  = (v, d=2) => `${(v * 100).toFixed(d)}%`
const fmtN = (v, d=3) => (+v).toFixed(d)

function SectionHead({ label, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5,
      paddingBottom:3, borderBottom:`1px solid ${B.border}` }}>
      <span style={{ fontSize:8.5, color:B.orange, fontWeight:700, letterSpacing:'.1em' }}>{label}</span>
      {right && <span style={{ fontSize:8, color:B.text3, marginLeft:'auto' }}>{right}</span>}
    </div>
  )
}

function Metric({ label, value, color=B.text, sub }) {
  return (
    <div style={{ background:B.surface, border:`1px solid ${B.border}`, padding:'5px 8px' }}>
      <div style={{ fontSize:7.5, color:B.text3, letterSpacing:'.08em', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color, fontFamily:'IBM Plex Mono,monospace' }}>{value}</div>
      {sub && <div style={{ fontSize:7.5, color:B.text3, marginTop:1 }}>{sub}</div>}
    </div>
  )
}

function BBTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#111', border:`1px solid ${B.border2}`,
      padding:'5px 8px', fontSize:9, fontFamily:'IBM Plex Mono,monospace' }}>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||B.text }}>
          {p.name}: {Number(p.value).toFixed(2)}%
        </div>
      ))}
    </div>
  )
}

// ── Inline label editor ───────────────────────────────────────────
function LabelEditor({ id, label, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(label)

  const save = async () => {
    if (val.trim()) {
      await updateLabel(id, val.trim())
      onSaved(id, val.trim())
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          background:B.panel, border:`1px solid ${B.orange}`, color:B.orange,
          fontSize:10, fontFamily:'IBM Plex Mono,monospace', padding:'2px 5px',
          outline:'none', width:'100%',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to rename"
      style={{ cursor:'text', color:B.text, fontSize:10,
        fontFamily:'IBM Plex Mono,monospace', borderBottom:`1px dashed ${B.border2}` }}>
      {label}
    </span>
  )
}

// ── Expanded result detail panel ──────────────────────────────────
function ResultDetail({ result }) {
  const { strategies, equityCurves, tickers, params } = result
  const hasWF = params.canWF && Object.keys(equityCurves).length > 0

  // Build equity curve chart data
  const chartData = (() => {
    if (!hasWF) return []
    const lens  = Object.values(equityCurves).map(c => c.length)
    const minLen = Math.min(...lens)
    return Array.from({ length: minLen }, (_, i) => {
      const obj = { t: i }
      STRAT.forEach(s => {
        if (equityCurves[s.k]) obj[s.k] = +((equityCurves[s.k][i] - 1) * 100).toFixed(2)
      })
      return obj
    })
  })()

  return (
    <div style={{ padding:'10px', background:B.panel, border:`1px solid ${B.border}`,
      borderTop:'none', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Asset list */}
      <div>
        <SectionHead label="Portfolio Assets" right={`OAS ρ=${params.rho} · ${params.yrs.toFixed(1)}Y · RF=${params.rf}% · TX=${params.txBps}bps`} />
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {tickers.map((t, i) => (
            <span key={t} style={{
              padding:'2px 8px', fontSize:9, fontFamily:'IBM Plex Mono,monospace',
              background:`${ASSET_COLS[i % ASSET_COLS.length]}15`,
              border:`1px solid ${ASSET_COLS[i % ASSET_COLS.length]}50`,
              color: ASSET_COLS[i % ASSET_COLS.length],
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Strategy metrics table */}
      <div>
        <SectionHead label={hasWF ? 'Walk-Forward Performance (Out-of-Sample)' : 'In-Sample Performance'} />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse',
            fontSize:9, fontFamily:'IBM Plex Mono,monospace' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${B.border}` }}>
                {['STRATEGY','WEIGHTS (TOP 3)','CAGR','VOL','SHARPE','SORTINO','MAX DD','VaR 95%','CVaR 95%'].map(h => (
                  <th key={h} style={{ padding:'3px 8px', color:B.text3, textAlign:'right', fontWeight:400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRAT.map(s => {
                const st  = strategies[s.k]
                const wfm = st?.wf
                const data = hasWF && wfm ? wfm : st
                if (!st) return null

                // Top 3 weights
                const top3 = [...(st.weights || [])].map((w, i) => ({ w, t: tickers[i] }))
                  .sort((a, b) => b.w - a.w).slice(0, 3)

                return (
                  <tr key={s.k} style={{ borderBottom:`1px solid ${B.border}20`,
                    background:`${s.col}05` }}>
                    <td style={{ padding:'4px 8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:3, height:14, background:s.col, display:'block' }} />
                        <span style={{ color:s.col, fontWeight:700 }}>{s.short}</span>
                        <span style={{ color:B.text3, fontSize:8 }}>{s.label}</span>
                      </div>
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right' }}>
                      <span style={{ fontSize:8, color:B.text3 }}>
                        {top3.map(x => `${x.t} ${(x.w*100).toFixed(0)}%`).join(' · ')}
                      </span>
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right',
                      color:(data?.cagr ?? data?.ret ?? 0)>0 ? B.green : B.red }}>
                      {fmt(data?.cagr ?? data?.ret ?? 0)}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right', color:B.amber }}>
                      {fmt(data?.vol ?? 0)}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right',
                      color:(data?.sharpe??0)>1?B.green:(data?.sharpe??0)>0?B.amber:B.red }}>
                      {fmtN(data?.sharpe ?? 0)}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right',
                      color:(data?.sortino??0)>1?B.green:B.amber }}>
                      {wfm ? fmtN(wfm.sortino) : '—'}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right', color:B.red }}>
                      {fmt(data?.mdd ?? 0)}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right', color:B.red }}>
                      {wfm ? fmt(wfm.var95) : '—'}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'right', color:'#ff0022' }}>
                      {wfm ? fmt(wfm.cvar95) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equity curves */}
      {hasWF && chartData.length > 0 && (
        <div>
          <SectionHead label="Walk-Forward Equity Curves" right="Out-of-sample · downsampled for storage" />
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top:4, right:12, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
              <XAxis hide />
              <YAxis tick={{ fill:B.text3, fontSize:8 }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<BBTooltip />} />
              {STRAT.map(s => (
                <Line key={s.k} type="monotone" dataKey={s.k} stroke={s.col}
                  dot={false} strokeWidth={1.5} name={s.label} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:4 }}>
            {STRAT.map(s => (
              <span key={s.k} style={{ fontSize:8, color:s.col, fontFamily:'IBM Plex Mono,monospace' }}>
                <span style={{ display:'inline-block', width:12, height:2,
                  background:s.col, marginRight:4, verticalAlign:'middle' }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────
export function SavedResultsView() {
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [toast,    setToast]    = useState('')

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getAllResults()
      setResults(all)
    } catch (e) {
      showToast('⚠ Failed to load from IndexedDB')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await deleteResult(id)
      setResults(prev => prev.filter(r => r.id !== id))
      if (expanded === id) setExpanded(null)
      showToast('✓ Result deleted')
    } catch {
      showToast('⚠ Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL saved results? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearAllResults()
      setResults([])
      setExpanded(null)
      showToast('✓ All results cleared')
    } catch {
      showToast('⚠ Clear failed')
    } finally {
      setClearing(false)
    }
  }

  const handleLabelSaved = (id, newLabel) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, label: newLabel } : r))
    showToast('✓ Label updated')
  }

  // ── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100%', gap:8, color:B.orange, fontFamily:'IBM Plex Mono,monospace', fontSize:10 }}>
        <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>
        LOADING FROM INDEXEDDB...
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, height:'100%' }}>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div>
          <span style={{ fontFamily:'Oswald,sans-serif', fontSize:14, color:B.orange, letterSpacing:'.06em' }}>
            SAVED RESULTS
          </span>
          <span style={{ fontSize:9, color:B.text3, marginLeft:10, fontFamily:'IBM Plex Mono,monospace' }}>
            IndexedDB · {results.length} run{results.length !== 1 ? 's' : ''} stored · persists across refresh
          </span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={load} style={{
            padding:'4px 10px', fontSize:9, cursor:'pointer',
            background:B.surface, border:`1px solid ${B.border}`,
            color:B.text3, fontFamily:'IBM Plex Mono,monospace',
          }}>⟳ REFRESH</button>
          {results.length > 0 && (
            <button onClick={handleClearAll} disabled={clearing} style={{
              padding:'4px 10px', fontSize:9, cursor:'pointer',
              background:B.redBg, border:`1px solid ${B.red}40`,
              color:B.red, fontFamily:'IBM Plex Mono,monospace',
            }}>
              {clearing ? '...' : '✕ CLEAR ALL'}
            </button>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{ padding:'5px 10px', background:B.greenBg,
          border:`1px solid ${B.green}30`, fontSize:9, color:B.green,
          fontFamily:'IBM Plex Mono,monospace' }}>
          {toast}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && (
        <div style={{ flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:12 }}>
          <div style={{ fontSize:32, color:B.border2 }}>💾</div>
          <div style={{ fontSize:14, color:B.border2, fontFamily:'Oswald,sans-serif', letterSpacing:'.1em' }}>
            NO SAVED RESULTS
          </div>
          <div style={{ fontSize:10, color:B.text3, textAlign:'center', lineHeight:1.8 }}>
            Run the optimizer then click<br />
            <span style={{ color:B.green, fontWeight:700 }}>💾 SAVE RESULT</span> in the sidebar
          </div>
          <div style={{ padding:'6px 14px', border:`1px solid ${B.border}`,
            fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace' }}>
            Results persist in browser IndexedDB until you delete them
          </div>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ flex:1, overflowY:'auto' }}>
          {results.map((r, idx) => (
            <div key={r.id} style={{ marginBottom:4 }}>

              {/* Result row header */}
              <div style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                background: expanded === r.id ? B.orangeBg : B.surface,
                border:`1px solid ${expanded === r.id ? B.orange : B.border}`,
                cursor:'pointer',
              }}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                {/* Index */}
                <span style={{ fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace',
                  minWidth:20 }}>#{results.length - idx}</span>

                {/* Expand arrow */}
                <span style={{ fontSize:10, color:B.orange, minWidth:12 }}>
                  {expanded === r.id ? '▼' : '▶'}
                </span>

                {/* Label (editable) */}
                <div style={{ flex:1 }} onClick={e => e.stopPropagation()}>
                  <LabelEditor id={r.id} label={r.label} onSaved={handleLabelSaved} />
                </div>

                {/* Asset chips */}
                <div style={{ display:'flex', gap:3 }}>
                  {r.tickers.slice(0, 5).map((t, i) => (
                    <span key={t} style={{
                      fontSize:8, padding:'1px 5px', fontFamily:'IBM Plex Mono,monospace',
                      color: ASSET_COLS[i % ASSET_COLS.length],
                      border:`1px solid ${ASSET_COLS[i % ASSET_COLS.length]}40`,
                    }}>{t}</span>
                  ))}
                  {r.tickers.length > 5 && (
                    <span style={{ fontSize:8, color:B.text3, padding:'1px 5px' }}>
                      +{r.tickers.length - 5}
                    </span>
                  )}
                </div>

                {/* Best strategy Sharpe */}
                {(() => {
                  const best = Object.entries(r.strategies)
                    .filter(([, s]) => s.wf)
                    .sort(([, a], [, b]) => (b.wf?.sharpe ?? 0) - (a.wf?.sharpe ?? 0))[0]
                  const info = best && STRAT.find(s => s.k === best[0])
                  return best && info ? (
                    <div style={{ textAlign:'right', minWidth:80 }}>
                      <div style={{ fontSize:8, color:B.text3 }}>BEST SHARPE</div>
                      <div style={{ fontSize:11, fontWeight:700, color:info.col,
                        fontFamily:'IBM Plex Mono,monospace' }}>
                        {fmtN(best[1].wf.sharpe)} · {info.short}
                      </div>
                    </div>
                  ) : null
                })()}

                {/* Date + params */}
                <div style={{ textAlign:'right', minWidth:110 }}>
                  <div style={{ fontSize:8, color:B.text3 }}>
                    {new Date(r.savedAt).toLocaleDateString('en-IN')} {new Date(r.savedAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ fontSize:8, color:B.text3, fontFamily:'IBM Plex Mono,monospace' }}>
                    {r.params.yrs.toFixed(1)}Y · {r.tickers.length} assets
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                  disabled={deleting === r.id}
                  style={{
                    background:'none', border:`1px solid ${B.border}`,
                    color:B.red, cursor:'pointer', fontSize:12,
                    padding:'2px 7px', lineHeight:1,
                    fontFamily:'IBM Plex Mono,monospace',
                  }}
                  title="Delete this result"
                >
                  {deleting === r.id ? '...' : '✕'}
                </button>
              </div>

              {/* Expanded detail */}
              {expanded === r.id && <ResultDetail result={r} />}
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div style={{ flexShrink:0, padding:'4px 8px', fontSize:8, color:B.text3,
        fontFamily:'IBM Plex Mono,monospace', borderTop:`1px solid ${B.border}`,
        display:'flex', gap:16 }}>
        <span>STORAGE: IndexedDB (browser) · no server needed</span>
        <span>CLICK LABEL TO RENAME · ▶ TO EXPAND · ✕ TO DELETE</span>
        <span style={{ marginLeft:'auto' }}>QUANT TERMINAL · results persist until deleted</span>
      </div>
    </div>
  )
}
