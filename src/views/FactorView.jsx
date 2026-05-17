/*
  FactorView.jsx — Factor Analysis tab (NEW in v5)

  Displays:
    - Beta, Alpha, Treynor, Information Ratio, Tracking Error
    - Up/Down Capture Ratios
    - Rolling Beta chart (63-day window)
    - Rolling Correlation with benchmark
    - Kelly Criterion position sizing
    - Regime-conditional Sharpe (bull vs bear)
    - Omega Ratio, Gain-to-Pain
*/

import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from 'recharts'
import { B, TD } from '../constants/theme.js'
import { Panel, Metric, SectionHead, BBTooltip } from '../components/TerminalShell.jsx'
import {
  beta, jensensAlpha, treynorRatio, informationRatio, trackingError,
  captureRatios, rollingBeta, rollingCorr, kellyCriterion,
  regimeSharpe, detectRegimes, omegaRatio, gainToPain,
} from '../lib/factors.js'
import { vmean } from '../lib/math.js'

const fmt  = (v, d = 2) => `${(v * 100).toFixed(d)}%`
const fmtN = (v, d = 3) => (+v).toFixed(d)

const METRICS_COLS = [
  { label: 'METRIC',   key: 'label', bold: true },
  { label: 'VALUE',    key: 'val',   align: 'right', color: r => r.c },
  { label: 'BENCHMARK',key: 'bench', align: 'right', color: () => B.text3 },
  { label: 'INTERP',   key: 'interp',color: r => r.ic },
]

export function FactorView({ engine, strat }) {
  const wfOpt  = engine.wf?.[strat]
  const portRets = useMemo(() => wfOpt?.portRets ?? [], [wfOpt])

  // We use SPY returns as benchmark proxy from the portfolio's own returns
  // (in a real system you'd fetch SPY separately; here we construct from prices if available)
  const benchRets = useMemo(() => {
    // try to use SPY if in portfolio, otherwise use equal-weight returns as proxy
    const spyIdx = engine.tickers.indexOf('SPY')
    if (spyIdx >= 0 && engine.rets[spyIdx]) return engine.rets[spyIdx]
    // fallback: average of all assets as market proxy
    const T = engine.rets[0].length
    return Array.from({ length: T }, (_, t) =>
      vmean(engine.rets.map(r => r[t]))
    )
  }, [engine])

  const hasWF = engine.canWF && portRets.length > 60

  const computedFactors = useMemo(() => {
    if (!hasWF) return null
    const mu  = vmean(portRets) * TD
    const vol = Math.sqrt(vmean(portRets.map(r => (r - vmean(portRets)) ** 2)) * TD)
    const b   = beta(portRets, benchRets)
    const alpha = jensensAlpha(portRets, benchRets, engine.rf ?? 4.5)
    const treynor = treynorRatio(portRets, benchRets, engine.rf ?? 4.5)
    const ir  = informationRatio(portRets, benchRets)
    const te  = trackingError(portRets, benchRets)
    const cap = captureRatios(portRets, benchRets)
    const kelly = kellyCriterion(mu, vol, engine.rf ?? 4.5)
    const omega = omegaRatio(portRets)
    const gtp   = gainToPain(portRets)
    return { b, alpha, treynor, ir, te, cap, kelly, omega, gtp, mu, vol }
  }, [portRets, benchRets, hasWF])

  const rollBetaData = useMemo(() => {
    if (!hasWF) return []
    const rb = rollingBeta(portRets, benchRets, 63)
    const sk = Math.max(1, Math.floor(rb.length / 200))
    return rb.filter((_, i) => i % sk === 0).map((v, i) => ({ t: i * sk, beta: +v.toFixed(3) }))
  }, [portRets, benchRets, hasWF])

  const rollCorrData = useMemo(() => {
    if (!hasWF) return []
    const rc = rollingCorr(portRets, benchRets, 63)
    const sk = Math.max(1, Math.floor(rc.length / 200))
    return rc.filter((_, i) => i % sk === 0).map((v, i) => ({ t: i * sk, corr: +v.toFixed(3) }))
  }, [portRets, benchRets, hasWF])

  const regimes = useMemo(() => {
    if (!engine.prices[0]) return { bull: 0, bear: 0 }
    const r = detectRegimes(engine.prices[0], 200)
    return {
      bull: r.filter(x => x === 'bull').length,
      bear: r.filter(x => x === 'bear').length,
      neutral: r.filter(x => x === 'neutral').length,
    }
  }, [engine])

  const regiSharpe = useMemo(() => {
    if (!hasWF || !engine.prices[0]) return null
    const r = detectRegimes(engine.prices[0].slice(-portRets.length), 200)
    return regimeSharpe(portRets, r, engine.rf ?? 4.5)
  }, [portRets, engine, hasWF])

  if (!hasWF) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: B.text3, fontSize: 11 }}>
        WALK-FORWARD BACKTEST REQUIRED — SELECT DATE RANGE ≥ 2 YEARS AND RUN
      </div>
    )
  }

  const cf = computedFactors

  const factorRows = cf ? [
    { label: 'Beta (β)', val: fmtN(cf.b, 3), bench: '1.000', c: Math.abs(cf.b - 1) < 0.2 ? B.amber : cf.b > 1.2 ? B.red : B.green, ic: B.text3, interp: cf.b > 1.2 ? 'HIGH SYSTEMATIC RISK' : cf.b < 0.8 ? 'LOW SYSTEMATIC RISK' : 'NEAR MARKET BETA' },
    { label: "Jensen's Alpha (α)", val: fmt(cf.alpha), bench: '0.00%', c: cf.alpha > 0 ? B.green : B.red, ic: cf.alpha > 0 ? B.green : B.red, interp: cf.alpha > 0 ? 'POSITIVE ALPHA' : 'NEGATIVE ALPHA' },
    { label: 'Treynor Ratio', val: fmtN(cf.treynor), bench: 'β-adj SR', c: cf.treynor > 0.05 ? B.green : B.amber, ic: B.text3, interp: cf.treynor > 0.1 ? 'STRONG' : cf.treynor > 0 ? 'POSITIVE' : 'WEAK' },
    { label: 'Information Ratio', val: fmtN(cf.ir), bench: '> 0.50 = GOOD', c: cf.ir > 0.5 ? B.green : cf.ir > 0 ? B.amber : B.red, ic: B.text3, interp: cf.ir > 0.5 ? 'STRONG ACTIVE MGR' : cf.ir > 0 ? 'MODERATE' : 'UNDERPERFORMS INDEX' },
    { label: 'Tracking Error', val: fmt(cf.te), bench: 'vs BENCHMARK', c: B.amber, ic: B.text3, interp: cf.te < 0.05 ? 'INDEX-LIKE' : cf.te < 0.10 ? 'MODERATE ACTIVE' : 'HIGH ACTIVE' },
    { label: 'Up Capture', val: `${(cf.cap.up * 100).toFixed(1)}%`, bench: '100% = MATCHES', c: cf.cap.up > 1 ? B.green : B.amber, ic: B.text3, interp: cf.cap.up > 1.1 ? 'AMPLIFIES RALLIES' : 'CAPTURES UPSIDE' },
    { label: 'Down Capture', val: `${(cf.cap.down * 100).toFixed(1)}%`, bench: '< 100% = GOOD', c: cf.cap.down < 1 ? B.green : B.red, ic: B.text3, interp: cf.cap.down < 0.9 ? 'PROTECTS DOWNSIDE' : 'TRACKS LOSSES' },
    { label: 'Omega Ratio', val: fmtN(cf.omega, 2), bench: '> 1.0 = GOOD', c: cf.omega > 1.5 ? B.green : cf.omega > 1 ? B.amber : B.red, ic: B.text3, interp: cf.omega > 2 ? 'EXCELLENT' : cf.omega > 1 ? 'POSITIVE' : 'POOR' },
    { label: 'Gain-to-Pain', val: fmtN(cf.gtp, 2), bench: '> 1.0 = GOOD', c: cf.gtp > 1 ? B.green : B.red, ic: B.text3, interp: cf.gtp > 1.5 ? 'STRONG' : cf.gtp > 1 ? 'POSITIVE' : 'WEAK' },
  ] : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto auto', gap: 8, height: '100%' }}>

      {/* Factor metrics table */}
      <div style={{ gridColumn: '1', gridRow: '1 / 3' }}>
        <SectionHead label="Factor Metrics" right="63-DAY ROLLING BENCHMARK" />
        <div style={{ overflowX: 'auto' }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                {METRICS_COLS.map((c, i) => <th key={i}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {factorRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: B.orange, fontWeight: 600 }}>{r.label}</td>
                  <td style={{ textAlign: 'right', color: r.c, fontWeight: 700 }}>{r.val}</td>
                  <td style={{ textAlign: 'right', color: B.text3 }}>{r.bench}</td>
                  <td style={{ color: r.ic, fontSize: 9 }}>{r.interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kelly Criterion */}
        {cf && (
          <>
            <SectionHead label="Kelly Criterion — Optimal Position Sizing" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { l: 'Full Kelly', v: `${(cf.kelly.full * 100).toFixed(1)}%`, sub: 'Theoretical max', c: B.red },
                { l: 'Half Kelly', v: `${(cf.kelly.half * 100).toFixed(1)}%`, sub: 'Recommended', c: B.orange },
                { l: 'Quarter Kelly', v: `${(cf.kelly.quarter * 100).toFixed(1)}%`, sub: 'Conservative', c: B.green },
              ].map(m => (
                <Metric key={m.l} label={m.l} value={m.v} color={m.c} sub={m.sub} accent />
              ))}
            </div>
            <div style={{ fontSize: 9, color: B.text3, marginTop: 6, lineHeight: 1.7 }}>
              Kelly f* = (μ − r_f) / σ²  ·  Full Kelly = {(cf.kelly.full * 100).toFixed(1)}% of capital. Half-Kelly standard practice — reduces risk of ruin.
            </div>
          </>
        )}
      </div>

      {/* Rolling Beta */}
      <div style={{ gridColumn: '2', gridRow: '1' }}>
        <SectionHead label="Rolling 63-Day Beta vs Benchmark" />
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={rollBetaData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
            <XAxis hide />
            <YAxis tick={{ fill: B.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }} />
            <Tooltip content={<BBTooltip fmt={v => v?.toFixed(3)} />} />
            <ReferenceLine y={1} stroke={B.border2} strokeDasharray="4 2" />
            <ReferenceLine y={0} stroke={B.border} />
            <Line type="monotone" dataKey="beta" stroke={B.orange} dot={false} strokeWidth={1.5} name="β" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rolling Correlation */}
      <div style={{ gridColumn: '2', gridRow: '2' }}>
        <SectionHead label="Rolling 63-Day Correlation vs Benchmark" />
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={rollCorrData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
            <XAxis hide />
            <YAxis domain={[-1, 1]} tick={{ fill: B.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }} />
            <Tooltip content={<BBTooltip fmt={v => v?.toFixed(3)} />} />
            <ReferenceLine y={0} stroke={B.border2} />
            <Line type="monotone" dataKey="corr" stroke={B.cyan} dot={false} strokeWidth={1.5} name="ρ" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Regime analysis */}
      <div style={{ gridColumn: '1 / 3', gridRow: '3' }}>
        <SectionHead label="Market Regime Analysis" right="200-DAY MA REGIME DETECTION" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
          {[
            { l: 'Bull Regime Days', v: regimes.bull, c: B.green },
            { l: 'Bear Regime Days', v: regimes.bear, c: B.red },
            { l: 'Neutral Days',     v: regimes.neutral, c: B.text3 },
            ...(regiSharpe ? [
              { l: 'Sharpe (Bull)',  v: fmtN(regiSharpe.bull), c: B.green },
              { l: 'Sharpe (Bear)',  v: fmtN(regiSharpe.bear), c: B.red },
            ] : []),
          ].map(m => (
            <Metric key={m.l} label={m.l} value={m.v} color={m.c} />
          ))}
        </div>
      </div>
    </div>
  )
}
