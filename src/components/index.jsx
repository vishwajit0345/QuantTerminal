/*
  components/index.jsx — reusable UI building blocks

  Keeping small components in one file here since they're all tiny.
  If they grow, split into individual files.
*/

import { useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { B as C } from '../constants/theme.js'
import { corrMat } from '../lib/math.js'

// ── Metric card (the coloured stat boxes) ─────────────────────────
export function MetricCard({ label, value, color = C.cyan, sub, accent }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${accent ? color + '50' : C.border}`,
      borderRadius: 10, padding: '12px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg,transparent,${color},transparent)`,
        }} />
      )}
      <div style={{
        fontSize: 8.5, color: C.muted,
        fontFamily: "'JetBrains Mono',monospace",
        textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 700, color,
        fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 8.5, color: C.dim, marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Correlation heatmap ────────────────────────────────────────────
function HeatCell({ v }) {
  const abs = Math.abs(v), pos = v >= 0
  const r = pos ? Math.round(59 + v * (239 - 59))  : Math.round(59  + abs * (22 - 59))
  const g = pos ? Math.round(130 + v * (68 - 130)) : Math.round(130 + abs * (197 - 130))
  const b = pos ? Math.round(246 + v * (68 - 246)) : Math.round(246 + abs * (94 - 246))
  return (
    <div
      title={v.toFixed(3)}
      style={{
        background: `rgb(${r},${g},${b})`, borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7.5,
        color: abs > 0.55 ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.6)',
        fontFamily: "'JetBrains Mono',monospace", cursor: 'default',
      }}
    >
      {v.toFixed(2)}
    </div>
  )
}

export function CorrHeatmap({ tickers, retMatrix }) {
  const corr = useMemo(() => corrMat(retMatrix), [retMatrix])
  const n = tickers.length
  const sz = Math.min(48, Math.max(28, Math.floor(460 / n)))

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', marginLeft: sz + 4, gap: 2, marginBottom: 2 }}>
          {tickers.map((t, j) => (
            <div key={j} style={{
              width: sz, flexShrink: 0, fontSize: 7.5, color: C.muted,
              textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
              textOverflow: 'ellipsis', fontFamily: "'JetBrains Mono',monospace",
            }}>{t}</div>
          ))}
        </div>
        {/* Rows */}
        {corr.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 2, marginBottom: 2, alignItems: 'center' }}>
            <div style={{
              width: sz, flexShrink: 0, fontSize: 7.5, color: C.muted,
              textAlign: 'right', paddingRight: 4,
              fontFamily: "'JetBrains Mono',monospace",
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>{tickers[i]}</div>
            {row.map((v, j) => (
              <div key={j} style={{ width: sz, height: sz, flexShrink: 0 }}>
                <HeatCell v={v} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 9, color: C.muted }}>
        <div style={{
          width: 90, height: 6,
          background: 'linear-gradient(90deg,#22c55e,#3b82f6,#ef4444)',
          borderRadius: 3,
        }} />
        <span>−1 (inverse) → 0 (uncorrelated) → +1 (perfect co-movement)</span>
      </div>
    </div>
  )
}

// ── Drawdown area chart ────────────────────────────────────────────
export function DrawdownChart({ cumPx }) {
  const data = useMemo(() => {
    let pk = cumPx[0]
    const skip = Math.max(1, Math.floor(cumPx.length / 250))
    return cumPx.filter((_, i) => i % skip === 0).map((p, i) => {
      if (p > pk) pk = p
      return { t: i * skip, dd: +((-((pk - p) / pk)) * 100).toFixed(3) }
    })
  }, [cumPx])

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.red} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.red} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
        <XAxis hide />
        <YAxis tick={{ fill: C.muted, fontSize: 8 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v) => [`${v}%`, 'Drawdown']} />
        <ReferenceLine y={0} stroke={C.border} />
        <Area
          type="monotone" dataKey="dd"
          stroke={C.red} strokeWidth={1.5}
          fill="url(#ddGrad)" name="Drawdown"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Return histogram ───────────────────────────────────────────────
export function ReturnHistogram({ rets }) {
  const bins = useMemo(() => {
    if (!rets?.length) return []
    const sorted = [...rets].sort((a, b) => a - b)
    const mn = sorted[0], mx = sorted[sorted.length - 1]
    const nb = 30, bw = (mx - mn) / nb
    return Array.from({ length: nb }, (_, i) => {
      const lo = mn + i * bw, hi = lo + bw
      return {
        x: +((lo + hi) / 2 * 100).toFixed(2),
        n: rets.filter((r) => r >= lo && r < hi).length,
      }
    })
  }, [rets])

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 18, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
        <XAxis
          dataKey="x"
          tick={{ fill: C.muted, fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}
          interval={5}
          label={{ value: 'Daily return (%)', position: 'insideBottom', offset: -10, fill: C.muted, fontSize: 9 }}
        />
        <YAxis hide />
        <Tooltip formatter={(v) => [`${v} days`, 'Count']} />
        <Bar dataKey="n" radius={[2, 2, 0, 0]}>
          {bins.map((b, i) => (
            <Cell key={i} fill={parseFloat(b.x) >= 0 ? C.green : C.red} fillOpacity={0.75} />
          ))}
        </Bar>
        <ReferenceLine x="0.00" stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 2" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Custom recharts tooltip ────────────────────────────────────────
export function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#050c18',
      border: `1px solid ${C.border2}`,
      borderRadius: 7, padding: '7px 11px',
      fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
    }}>
      {label && <div style={{ color: C.muted, marginBottom: 3 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Simple tab button ──────────────────────────────────────────────
export function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? C.panel : 'transparent',
        border: `1px solid ${active ? C.border2 : 'transparent'}`,
        borderBottom: active ? 'none' : undefined,
        borderRadius: '8px 8px 0 0',
        color: active ? C.text : C.muted,
        cursor: 'pointer', fontSize: 11,
        fontFamily: "'JetBrains Mono',monospace",
        fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap', transition: 'all .12s',
      }}
    >
      {label}
    </button>
  )
}
