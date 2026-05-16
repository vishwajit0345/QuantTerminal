/*
  views/tabs.jsx — all remaining tab views
  Frontier · Allocation · Risk · Backtest · BlackLitterman · Compare
*/

import { useMemo } from 'react'
import {
  ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts'
import { MetricCard, CorrHeatmap, DrawdownChart, ReturnHistogram, CustomTooltip } from '../components/index.jsx'
import { B as C, STRAT as STRAT_META, ASSET_COLS as ASSET_COLORS, TD } from '../constants/theme.js'
import { portMetrics } from '../lib/analytics.js'

const fmt  = (v, d = 2) => `${(v * 100).toFixed(d)}%`
const fmtN = (v, d = 3) => (+v).toFixed(d)

/* ── helper: sharable walk-forward table ────────────────────────── */
function WFTable({ engine, strat, setStrat }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Strategy', 'CAGR', 'Vol', 'Sharpe', 'Sortino', 'MaxDD', 'VaR 95%', 'CVaR 95%'].map((h) => (
              <th key={h} style={{ padding: '6px 9px', textAlign: 'left', color: C.muted, fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STRAT_META.map((s) => {
            const w = engine.wf[s.k]
            if (!w) return null
            return (
              <tr
                key={s.k}
                className="hrow"
                onClick={() => setStrat(s.k)}
                style={{ borderBottom: `1px solid ${C.border}`, background: strat === s.k ? s.col + '0d' : 'transparent' }}
              >
                <td style={{ padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.col, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ color: strat === s.k ? s.col : C.text }}>{s.label}</span>
                </td>
                {[
                  { v: fmt(w.cagr),    c: w.cagr    > 0  ? C.green  : C.red },
                  { v: fmt(w.vol),     c: C.amber },
                  { v: fmtN(w.sharpe), c: w.sharpe  > 1  ? C.green  : w.sharpe > 0 ? C.amber : C.red },
                  { v: fmtN(w.sortino),c: w.sortino > 1  ? C.green  : C.amber },
                  { v: fmt(w.mdd),     c: C.red },
                  { v: fmt(w.var95),   c: C.red },
                  { v: fmt(w.cvar95),  c: '#ef2040' },
                ].map((m, i) => (
                  <td key={i} style={{ padding: '7px 9px', color: m.c }}>{m.v}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   EFFICIENT FRONTIER
══════════════════════════════════════════════════════════════════ */
export function EfficientFrontier({ engine, strat, setStrat }) {
  const mcFiltered = useMemo(() => {
    const ev = Math.ceil(engine.mc.length / 1500)
    return engine.mc
      .filter((_, i) => i % ev === 0)
      .filter((p) => isFinite(p.sharpe) && p.vol > 0 && p.ret > -1 && p.ret < 4)
      .map((p) => ({
        vol:  +(p.vol  * 100).toFixed(3),
        ret:  +(p.ret  * 100).toFixed(3),
        sh:   +p.sharpe.toFixed(2),
      }))
  }, [engine])

  return (
    <div>
      <div style={{
        background: C.amber + '0d', border: `1px solid ${C.amber}20`,
        borderRadius: 7, padding: '7px 11px', fontSize: 9,
        color: C.amber, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10,
      }}>
        In-sample frontier — for visual intuition only. All performance evaluation uses walk-forward backtest.
      </div>

      <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
        {engine.mc.length.toLocaleString()} MONTE CARLO PORTFOLIOS + 5 OPTIMAL STRATEGIES (STARS)
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 28 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
          <XAxis
            type="number" dataKey="vol" name="Volatility"
            tick={{ fill: C.muted, fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}
            label={{ value: 'Annualised volatility (%)', position: 'insideBottom', offset: -16, fill: C.muted, fontSize: 10 }}
            tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']}
          />
          <YAxis
            type="number" dataKey="ret" name="Return"
            tick={{ fill: C.muted, fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}
            label={{ value: 'Expected return (%)', angle: -90, position: 'insideLeft', offset: 14, fill: C.muted, fontSize: 10 }}
            tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: C.muted }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div style={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 7, padding: '7px 11px', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace" }}>
                  <div style={{ color: C.muted }}>Vol: {d?.vol?.toFixed(2)}%</div>
                  <div style={{ color: C.green }}>Ret: {d?.ret?.toFixed(2)}%</div>
                  <div style={{ color: C.cyan }}>Sharpe: {(d?.sh ?? d?.sharpe)?.toFixed(3)}</div>
                </div>
              )
            }}
          />

          {/* MC scatter coloured by Sharpe */}
          <Scatter name="MC Portfolios" data={mcFiltered} opacity={0.55}>
            {mcFiltered.map((p, i) => {
              const t = Math.min(Math.max((p.sh + 0.5) / 3.5, 0), 1)
              return <Cell key={i} fill={`hsl(${Math.round(200 + t * 80)},${Math.round(55 + t * 45)}%,${Math.round(28 + t * 38)}%)`} />
            })}
          </Scatter>

          {/* Strategy star markers */}
          {STRAT_META.map((s) => {
            const o = engine.inSample[s.k]
            return o ? (
              <Scatter
                key={s.k}
                name={s.label}
                data={[{ vol: +(o.vol * 100).toFixed(2), ret: +(o.ret * 100).toFixed(2), sh: +o.sharpe.toFixed(3) }]}
                fill={s.col}
                opacity={1}
                r={9}
              />
            ) : null
          })}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {STRAT_META.map((s) => {
          const o = engine.inSample[s.k]
          return o ? (
            <div
              key={s.k}
              onClick={() => setStrat(s.k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: C.card,
                border: `1px solid ${strat === s.k ? s.col : C.border}`,
                borderRadius: 7, padding: '4px 9px', cursor: 'pointer',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.col, display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: s.col, fontFamily: "'JetBrains Mono',monospace" }}>{s.label}</span>
              <span style={{ fontSize: 8.5, color: C.muted, fontFamily: "'JetBrains Mono',monospace" }}>SR={o.sharpe.toFixed(2)}</span>
            </div>
          ) : null
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: C.muted }}>
          <div style={{ width: 12, height: 6, background: 'linear-gradient(90deg,hsl(200,55%,30%),hsl(280,100%,65%))', borderRadius: 2 }} />
          MC (colour = Sharpe)
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   ALLOCATION
══════════════════════════════════════════════════════════════════ */
export function Allocation({ engine, strat }) {
  const opt = engine.inSample[strat]

  const wData = useMemo(() => {
    if (!opt) return []
    return engine.tickers
      .map((t, i) => ({
        ticker: t,
        weight: +(opt.w[i] * 100).toFixed(2),
        rc:     opt.rc ? +opt.rc[i].prc.toFixed(2) : 0,
        col:    ASSET_COLORS[i % ASSET_COLORS.length],
        name:   engine.assets.find((a) => a.ticker === t)?.name || t,
        mu:     engine.muD[i] * TD,
        sig:    Math.sqrt(engine.cov[i][i] * TD),
      }))
      .sort((a, b) => b.weight - a.weight)
  }, [opt, engine])

  if (!opt) return null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Weights bar */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            WEIGHTS — {opt.label?.toUpperCase() ?? strat.toUpperCase()} (Frank-Wolfe QP)
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, wData.length * 28)}>
            <BarChart data={wData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 60 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="ticker" tick={{ fill: C.muted, fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace" }} />
              <Tooltip content={<CustomTooltip formatter={(v) => `${v?.toFixed(2)}%`} />} />
              <Bar dataKey="weight" name="Weight" radius={[0, 4, 4, 0]}>
                {wData.map((d, i) => <Cell key={i} fill={d.col} fillOpacity={0.82} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk contribution bar */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            RISK CONTRIBUTION % — wᵢ·(Σw)ᵢ / w^TΣw
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, wData.length * 28)}>
            <BarChart data={wData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 60 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v?.toFixed(0)}%`} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="ticker" tick={{ fill: C.muted, fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace" }} />
              <Tooltip content={<CustomTooltip formatter={(v) => `${v?.toFixed(2)}%`} />} />
              <Bar dataKey="rc" name="Risk %" radius={[0, 4, 4, 0]}>
                {wData.map((d, i) => (
                  <Cell key={i} fill={C.red} fillOpacity={0.3 + 0.7 * d.rc / Math.max(...wData.map((x) => x.rc), 1)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Ticker', 'Name', 'Weight', 'Risk %', 'μ ann.', 'σ ann.', 'Sharpe'].map((h) => (
                <th key={h} style={{ padding: '5px 9px', textAlign: 'left', color: C.muted, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wData.map((d, i) => (
              <tr key={d.ticker} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : C.card + '80' }}>
                <td style={{ padding: '6px 9px', color: d.col, fontWeight: 600 }}>{d.ticker}</td>
                <td style={{ padding: '6px 9px', color: C.text, fontSize: 9.5 }}>{d.name}</td>
                <td style={{ padding: '6px 9px', color: d.weight > 30 ? C.amber : C.text }}>{d.weight.toFixed(2)}%</td>
                <td style={{ padding: '6px 9px', color: C.red }}>{d.rc?.toFixed(2)}%</td>
                <td style={{ padding: '6px 9px', color: d.mu > 0 ? C.green : C.red }}>{fmt(d.mu)}</td>
                <td style={{ padding: '6px 9px', color: C.amber }}>{fmt(d.sig)}</td>
                <td style={{ padding: '6px 9px', color: (d.mu - 4.5 / 100) / d.sig > 1 ? C.green : (d.mu - 4.5 / 100) / d.sig > 0 ? C.amber : C.red }}>
                  {((d.mu - 4.5 / 100) / Math.max(d.sig, 1e-10)).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   RISK ANALYTICS
══════════════════════════════════════════════════════════════════ */
export function RiskAnalytics({ engine, strat }) {
  const wfOpt = engine.wf?.[strat]
  const opt   = engine.inSample?.[strat]
  const active = engine.canWF ? wfOpt : opt
  if (!active) return null

  return (
    <div>
      <div style={{
        background: engine.canWF ? C.green + '0d' : C.amber + '0d',
        border: `1px solid ${engine.canWF ? C.green : C.amber}20`,
        borderRadius: 7, padding: '7px 11px', fontSize: 9,
        color: engine.canWF ? C.green : C.amber,
        fontFamily: "'JetBrains Mono',monospace", marginBottom: 12,
      }}>
        {engine.canWF
          ? 'All risk metrics from walk-forward out-of-sample returns. Zero look-ahead.'
          : 'In-sample estimates — extend date range beyond 520 days for walk-forward validation.'}
      </div>

      {/* Risk cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { l: 'VaR 95% (1d)',   v: fmt(active.var95  ?? 0), c: C.red,     s: 'Historical simulation' },
          { l: 'CVaR 95% (1d)',  v: fmt(active.cvar95 ?? 0), c: C.red,     s: 'Expected shortfall' },
          { l: 'VaR 99% (1d)',   v: fmt(active.var99  ?? 0), c: '#ef2040', s: 'Historical simulation' },
          { l: 'CVaR 99% (1d)',  v: fmt(active.cvar99 ?? 0), c: '#ef2040', s: 'Expected shortfall' },
          { l: 'Max Drawdown',   v: fmt(active.mdd    ?? 0), c: C.red,     s: 'Peak-to-trough' },
          { l: 'Sortino Ratio',  v: fmtN(active.sortino ?? 0), c: (active.sortino ?? 0) > 1 ? C.green : C.amber, s: 'Downside deviation' },
          { l: 'Calmar Ratio',   v: fmtN((active.mdd ?? 0) > 0 ? (active.cagr ?? active.ret) / (active.mdd) : 0), c: C.muted, s: 'CAGR / MaxDD' },
          { l: 'Sharpe (WF)',    v: fmtN(active.sharpe ?? 0), c: (active.sharpe ?? 0) > 1 ? C.green : C.amber, s: 'Walk-forward only' },
        ].map((m) => <MetricCard key={m.l} label={m.l} value={m.v} color={m.c} sub={m.s} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Return histogram */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            DAILY RETURN DISTRIBUTION
          </div>
          <ReturnHistogram rets={active.portRets ?? []} />
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: C.muted }}>
            <span style={{ color: C.red }}>▌ VaR 95%: {fmt(active.var95 ?? 0)}/day</span>
            <span style={{ color: '#ef2040' }}>▌ VaR 99%: {fmt(active.var99 ?? 0)}/day</span>
          </div>
        </div>

        {/* Drawdown + formulas */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            DRAWDOWN PROFILE
          </div>
          {(active.cum) && <DrawdownChart cumPx={active.cum} />}
          <div style={{ marginTop: 10, fontSize: 9.5, color: C.muted, lineHeight: 2, fontFamily: "'JetBrains Mono',monospace" }}>
            <div>VaR: <span style={{ color: C.cyan }}>-inf{'{'} x : F(x) ≥ 1−α {'}'}</span></div>
            <div>CVaR: <span style={{ color: C.green }}>E[L | L &gt; VaR_α]</span></div>
            <div>Sortino: <span style={{ color: C.amber }}>(μ_p − r_f) / σ_downside</span></div>
            <div>Calmar: <span style={{ color: C.purple }}>CAGR / MaxDrawdown</span></div>
          </div>
        </div>
      </div>

      {/* Correlation heatmap */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
          CORRELATION MATRIX — OAS-SHRUNK (ρ = {engine.rho?.toFixed(4)})
        </div>
        <CorrHeatmap tickers={engine.tickers} retMatrix={engine.rets} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   WALK-FORWARD BACKTEST
══════════════════════════════════════════════════════════════════ */
export function WalkForward({ engine, strat, setStrat }) {
  const btData = useMemo(() => {
    if (!engine.canWF) return []
    const N  = engine.wf.maxSharpe.cum.length
    const sk = Math.max(1, Math.floor(N / 300))
    return Array.from({ length: Math.floor(N / sk) }, (_, i) => {
      const idx = i * sk
      const obj = { t: idx }
      Object.keys(engine.wf).forEach((k) => { obj[k] = +((engine.wf[k].cum[idx] - 1) * 100).toFixed(2) })
      return obj
    })
  }, [engine])

  if (!engine.canWF) {
    return (
      <div style={{
        background: C.amber + '0d', border: `1px solid ${C.amber}30`,
        borderRadius: 10, padding: 24, textAlign: 'center',
        color: C.amber, fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
      }}>
        Walk-forward requires at least 520 trading days of data.<br />
        Your selection has {engine.Td} days. Extend start date further back.
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: C.green + '0d', border: `1px solid ${C.green}20`,
        borderRadius: 7, padding: '7px 11px', fontSize: 9,
        color: C.green, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10,
      }}>
        Zero look-ahead walk-forward · EST_WIN = 252 days · REBAL = 21 days · tx cost = 10 bps
      </div>

      <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
        OUT-OF-SAMPLE EQUITY CURVES — ALL STRATEGIES
      </div>
      <div style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={btData} margin={{ top: 4, right: 12, bottom: 4, left: 28 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
            <XAxis hide />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
            <ReferenceLine y={0} stroke={C.border} />
            {STRAT_META.map((s) => (
              <Line
                key={s.k}
                type="monotone" dataKey={s.k} stroke={s.col} dot={false}
                strokeWidth={strat === s.k ? 2.5 : 1.2} name={s.label}
                strokeOpacity={strat === s.k ? 1 : 0.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <WFTable engine={engine} strat={strat} setStrat={setStrat} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   BLACK-LITTERMAN
══════════════════════════════════════════════════════════════════ */
export function BlackLitterman({ engine }) {
  return (
    <div>
      {/* Math box */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: C.cyan, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, fontWeight: 600 }}>
          FULL BLACK-LITTERMAN POSTERIOR (He & Litterman 1999)
        </div>
        <div style={{ fontSize: 9.5, color: C.muted, fontFamily: "'JetBrains Mono',monospace", lineHeight: 2.1 }}>
          <div><span style={{ color: C.text }}>Equilibrium:  </span> Π = λΣw_mkt  (λ=2.5, CAPM implied excess returns)</div>
          <div><span style={{ color: C.text }}>Views:        </span> P·μ = Q + ε,  ε~N(0,Ω),  Ω = τ·PΣP^T  (He-Litterman uncertainty)</div>
          <div><span style={{ color: C.text }}>Precision:    </span> M = (τΣ)⁻¹ + P^T·Ω⁻¹·P</div>
          <div><span style={{ color: C.purple }}>Posterior μ_BL: M⁻¹·[(τΣ)⁻¹·Π + P^T·Ω⁻¹·Q]</span></div>
          <div><span style={{ color: C.text }}>Posterior Σ_BL: Σ + M⁻¹  (fed back into Frank-Wolfe solver)</span></div>
          <div><span style={{ color: C.text }}>Parameters:   </span> τ=0.05, K={engine.views?.length ?? 0} momentum-derived views</div>
        </div>
      </div>

      {/* Prior vs posterior chart */}
      <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
        CAPM EQUILIBRIUM PRIOR Π vs BL POSTERIOR μ_BL (annual %)
      </div>
      <div style={{ marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart
            data={engine.tickers.map((t, i) => ({
              ticker: t,
              prior:     +((engine.PI?.[i] ?? 0) * 100 * 252).toFixed(2),
              posterior: +((engine.muBL?.[i] ?? 0) * 100).toFixed(2),
            }))}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="ticker" tick={{ fill: C.muted, fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }} />
            <YAxis tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip formatter={(v) => `${v?.toFixed(2)}%`} />} />
            <ReferenceLine y={0} stroke={C.border} />
            <Bar dataKey="prior"     name="Prior Π (CAPM)"    fill={C.muted}   fillOpacity={0.6} radius={[2, 2, 0, 0]} />
            <Bar dataKey="posterior" name="Posterior μ_BL"   fill={C.purple}  fillOpacity={0.85} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Views table */}
      <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
        ACTIVE VIEWS — P, Q, Ω (MOMENTUM-DERIVED)
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['#', 'Description', 'P (loadings)', 'Q annual %', 'Ω uncertainty'].map((h) => (
                <th key={h} style={{ padding: '5px 9px', textAlign: 'left', color: C.muted, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(engine.views ?? []).map((v, i) => {
              const pStr = v.p
                .map((x, j) => (x !== 0 ? `${x > 0 ? '+' : ''}${x}×${engine.tickers[j]}` : ''))
                .filter(Boolean)
                .join(', ')
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : C.card + '80' }}>
                  <td style={{ padding: '6px 9px', color: C.muted }}>{i + 1}</td>
                  <td style={{ padding: '6px 9px', color: C.text, fontSize: 9 }}>{v.label ?? '—'}</td>
                  <td style={{ padding: '6px 9px', color: C.purple, fontSize: 9 }}>{pStr}</td>
                  <td style={{ padding: '6px 9px', color: v.q > 0 ? C.green : C.red }}>{(v.q * TD * 100).toFixed(2)}%</td>
                  <td style={{ padding: '6px 9px', color: C.amber }}>{(v.omega * TD * 100).toFixed(2)}%² ann.</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   COMPARE ALL STRATEGIES
══════════════════════════════════════════════════════════════════ */
export function Compare({ engine, strat, setStrat }) {
  if (!engine.canWF) {
    return (
      <div style={{ color: C.muted, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: 20, textAlign: 'center' }}>
        Extend date range beyond 520 trading days to enable walk-forward comparison.
      </div>
    )
  }

  const radarData = [
    { m: 'Return',   ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].cagr + 0.3) * 120))])) },
    { m: 'Sharpe',   ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].sharpe + 1) * 33))])) },
    { m: 'Low Vol',  ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.max(0, 100 - engine.wf[s.k].vol * 300)])) },
    { m: 'Sortino',  ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].sortino + 0.5) * 28))])) },
    { m: 'Low DD',   ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.max(0, 100 - engine.wf[s.k].mdd * 250)])) },
    { m: 'CAGR',     ...Object.fromEntries(STRAT_META.map((s) => [s.k, Math.min(100, Math.max(0, (engine.wf[s.k].cagr + 0.2) * 130))])) },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Radar */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            STRATEGY RADAR — WALK-FORWARD NORMALISED METRICS
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="m" tick={{ fill: C.muted, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }} />
              {STRAT_META.map((s) => (
                <Radar
                  key={s.k} dataKey={s.k} stroke={s.col} fill={s.col}
                  fillOpacity={0.08} strokeWidth={1.5} name={s.label}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk-return scatter */}
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
            RISK-RETURN SCATTER (walk-forward CAGR vs Ann. Vol)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 12, right: 12, bottom: 24, left: 24 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis type="number" dataKey="vol" name="Volatility"
                tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)}%`}
                label={{ value: 'Ann. Vol (%)', position: 'insideBottom', offset: -14, fill: C.muted, fontSize: 9 }} />
              <YAxis type="number" dataKey="cagr" name="CAGR"
                tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)}%`}
                label={{ value: 'CAGR (%)', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 9 }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 7, padding: '7px 11px', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace" }}>
                    <div style={{ color: d.col }}>{d.label}</div>
                    <div style={{ color: C.muted }}>Vol: {d.vol?.toFixed(2)}%</div>
                    <div style={{ color: C.green }}>CAGR: {d.cagr?.toFixed(2)}%</div>
                    <div style={{ color: C.cyan }}>Sharpe: {d.sh?.toFixed(3)}</div>
                  </div>
                )
              }} />
              {STRAT_META.map((s) => {
                const w = engine.wf[s.k]
                return (
                  <Scatter
                    key={s.k} name={s.label}
                    data={[{ vol: +(w.vol * 100).toFixed(2), cagr: +(w.cagr * 100).toFixed(2), sh: +w.sharpe.toFixed(3), label: s.label, col: s.col }]}
                    fill={s.col} opacity={1} r={9}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <WFTable engine={engine} strat={strat} setStrat={setStrat} />
    </div>
  )
}
