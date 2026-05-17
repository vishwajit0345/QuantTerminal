/*
  views/Overview.jsx — the main dashboard tab

  Shows walk-forward performance metrics and equity curves.
  If walk-forward isn't available (date range too short),
  falls back to in-sample numbers with a clear warning.
*/

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip,
         ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { MetricCard, DrawdownChart, CustomTooltip } from '../components/index.jsx'
import { B as C, STRAT as STRAT_META, ASSET_COLS as ASSET_COLORS } from '../constants/theme.js'

const fmt  = (v, d = 2) => `${(v * 100).toFixed(d)}%`
const fmtN = (v, d = 3) => (+v).toFixed(d)

export function Overview({ engine, strat, setStrat }) {
  const opt   = engine.inSample?.[strat]
  const wfOpt = engine.wf?.[strat]
  const active = engine.canWF ? wfOpt : opt

  // build equity curve chart data
  const btData = useMemo(() => {
    if (!engine.canWF) return []
    const N  = engine.wf.maxSharpe.cum.length
    const sk = Math.max(1, Math.floor(N / 300))
    return Array.from({ length: Math.floor(N / sk) }, (_, i) => {
      const idx = i * sk
      const obj = { t: idx }
      Object.keys(engine.wf).forEach((k) => {
        obj[k] = +((engine.wf[k].cum[idx] - 1) * 100).toFixed(2)
      })
      return obj
    })
  }, [engine])

  // price index (normalised to 100)
  const priceData = useMemo(() => {
    const N  = engine.prices[0].length
    const sk = Math.max(1, Math.floor(N / 200))
    return engine.prices[0]
      .filter((_, i) => i % sk === 0)
      .map((_, i) => {
        const obj = { t: i * sk }
        engine.tickers.forEach((t, j) => {
          const base = engine.prices[j][0]
          obj[t] = +((engine.prices[j][i * sk] / base) * 100).toFixed(2)
        })
        return obj
      })
  }, [engine])

  const metrics = active ? [
    { l: 'CAGR',         v: fmt(active.cagr  ?? active.ret), c: (active.cagr ?? active.ret) > 0 ? C.green : C.red, a: true },
    { l: 'Ann. Vol',     v: fmt(active.vol),  c: C.amber },
    { l: 'Sharpe',       v: fmtN(active.sharpe), c: active.sharpe > 1 ? C.green : active.sharpe > 0 ? C.amber : C.red, a: active.sharpe > 1.2 },
    { l: 'Sortino',      v: fmtN(active.sortino ?? 0), c: (active.sortino ?? 0) > 1 ? C.green : C.amber },
    { l: 'Max Drawdown', v: fmt(active.mdd ?? 0),  c: C.red },
    { l: 'VaR 95% 1d',  v: fmt(active.var95 ?? 0), c: C.red },
    { l: 'CVaR 95% 1d', v: fmt(active.cvar95 ?? 0),c: C.red },
    { l: 'VaR 99% 1d',  v: fmt(active.var99 ?? 0), c: '#ef2040' },
  ] : []

  return (
    <div>
      {/* Strategy + data source label row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: C.text }}>
          {opt?.label ?? strat} Portfolio
        </span>
        {engine.canWF
          ? <span style={{ fontSize: 8, padding: '2px 7px', background: C.green + '18', border: `1px solid ${C.green}30`, borderRadius: 4, color: C.green, fontFamily: "'JetBrains Mono',monospace" }}>✓ Walk-Forward</span>
          : <span style={{ fontSize: 8, padding: '2px 7px', background: C.amber + '18', border: `1px solid ${C.amber}30`, borderRadius: 4, color: C.amber, fontFamily: "'JetBrains Mono',monospace" }}>In-sample only — extend date range for backtest</span>
        }
        <span style={{ fontSize: 8.5, color: C.muted, marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace" }}>
          {engine.n} assets · {engine.startDate} → {engine.endDate} · OAS ρ={engine.rho?.toFixed(4)}
        </span>
      </div>

      {/* Metric cards grid */}
      {metrics.length > 0 && (
        <>
          <div style={{ fontSize: 8.5, color: engine.canWF ? C.green : C.amber, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            {engine.canWF ? 'WALK-FORWARD PERFORMANCE (out-of-sample)' : 'IN-SAMPLE ESTIMATES (not backtested)'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
            {metrics.map((m) => (
              <MetricCard key={m.l} label={m.l} value={m.v} color={m.c} accent={m.a} />
            ))}
          </div>
        </>
      )}

      {/* Equity curves */}
      {engine.canWF && (
        <>
          <div style={{ fontSize: 8.5, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            WALK-FORWARD EQUITY CURVES — {engine.startDate} → {engine.endDate} (tx cost: 10 bps)
          </div>
          <div style={{ marginBottom: 14 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={btData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                <XAxis hide />
                <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
                <ReferenceLine y={0} stroke={C.border} />
                {STRAT_META.map((s) => (
                  <Line
                    key={s.k}
                    type="monotone"
                    dataKey={s.k}
                    stroke={s.col}
                    dot={false}
                    strokeWidth={strat === s.k ? 2.5 : 1.2}
                    name={s.label}
                    strokeOpacity={strat === s.k ? 1 : 0.45}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Normalised price index */}
      <div style={{ fontSize: 8.5, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
        NORMALISED PRICE INDEX (base = 100)
      </div>
      <div style={{ marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={priceData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
            <XAxis hide />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} />
            <Tooltip content={<CustomTooltip />} />
            {engine.tickers.map((t, i) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={ASSET_COLORS[i % ASSET_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
                name={t}
                opacity={0.85}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown of active strategy */}
      {engine.canWF && wfOpt && (
        <>
          <div style={{ fontSize: 8.5, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            UNDERWATER CHART — {opt?.label}
          </div>
          <DrawdownChart cumPx={wfOpt.cum} />
        </>
      )}

      {/* In-sample label warning */}
      <div style={{
        marginTop: 14,
        background: C.amber + '0d',
        border: `1px solid ${C.amber}25`,
        borderRadius: 8,
        padding: '9px 13px',
        fontSize: 8.5,
        color: C.amber,
        fontFamily: "'JetBrains Mono',monospace",
      }}>
        In-sample Σ̂ and μ̂ (full history) are used only for the Frontier tab and Allocation tab.
        All performance numbers above come from walk-forward out-of-sample returns.
      </div>
    </div>
  )
}
