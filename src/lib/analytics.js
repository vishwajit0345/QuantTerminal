/*
  analytics.js — portfolio performance and risk metrics

  All the standard quant metrics in one place.
  These are straightforward once you know the formulas —
  the tricky part is making sure you use the right return series
  (out-of-sample only for backtest metrics).
*/

import { dot, vmean } from './math.js'
import { TD } from '../constants/theme.js'

// annualised return + vol + sharpe from weights, daily mean returns, cov
export function portMetrics(w, muD, cov, rf) {
  const ret = dot(w, muD) * TD
  let vp = 0
  for (let i = 0; i < w.length; i++)
    for (let j = 0; j < w.length; j++) vp += w[i] * w[j] * cov[i][j]
  const vol = Math.sqrt(vp * TD)
  return {
    ret,
    vol,
    sharpe: (ret - rf / 100) / Math.max(vol, 1e-10),
  }
}

// marginal and percentage risk contributions per asset
// RC_i = w_i * (Σw)_i / σ_p
export function riskContrib(w, cov) {
  let vp = 0
  for (let i = 0; i < w.length; i++)
    for (let j = 0; j < w.length; j++) vp += w[i] * w[j] * cov[i][j]
  const sv = Math.sqrt(Math.max(vp, 1e-14))

  return w.map((_, i) => ({
    mrc: w.reduce((s, wj, j) => s + wj * cov[i][j], 0) / sv,
    rc:  w[i] * w.reduce((s, wj, j) => s + wj * cov[i][j], 0) / sv,
    prc: vp > 1e-14 ? (w[i] * w.reduce((s, wj, j) => s + wj * cov[i][j], 0)) / vp * 100 : 0,
  }))
}

/*
  Historical simulation VaR and CVaR.
  rets: array of daily log returns

  VaR_α: the loss not exceeded on (1-α)% of days
  CVaR_α (Expected Shortfall): average loss on the worst α% of days
*/
export function varMetrics(rets) {
  const sorted = [...rets].sort((a, b) => a - b)
  const n = sorted.length
  const i95 = Math.max(1, Math.floor(0.05 * n))
  const i99 = Math.max(1, Math.floor(0.01 * n))
  return {
    var95:  -sorted[i95],
    var99:  -sorted[i99],
    cvar95: -(sorted.slice(0, i95).reduce((a, b) => a + b, 0) / i95),
    cvar99: -(sorted.slice(0, i99).reduce((a, b) => a + b, 0) / i99),
  }
}

// peak-to-trough maximum drawdown
export function maxDD(prices) {
  let md = 0
  let pk = prices[0]
  for (const p of prices) {
    if (p > pk) pk = p
    const dd = (pk - p) / pk
    if (dd > md) md = dd
  }
  return md
}

/*
  Sortino ratio: (annualised excess return) / downside deviation
  Only penalises downside vol — unlike Sharpe which penalises all vol.
*/
export function sortino(rets, rf) {
  const rfD = rf / 100 / TD
  const ex = rets.map((r) => r - rfD)
  const down = rets.filter((r) => r < rfD)
  if (!down.length) return 0
  const ds = Math.sqrt(down.reduce((s, r) => s + (r - rfD) ** 2, 0) / down.length * TD)
  return (vmean(ex) * TD) / Math.max(ds, 1e-10)
}

// compound annual growth rate from cumulative equity value
export function cagr(cumEnd, yrs) {
  return Math.pow(Math.max(cumEnd, 1e-6), 1 / Math.max(yrs, 0.01)) - 1
}

// rolling 21-day annualised volatility
export function rollVol(rets, w = 21) {
  return rets
    .map((_, i) => {
      if (i < w - 1) return null
      const sl = rets.slice(i - w + 1, i + 1)
      const m = vmean(sl)
      return Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / (w - 1) * TD) * 100
    })
    .filter((v) => v !== null)
}

// rolling 60-day sharpe
export function rollSharpe(rets, rf, w = 60) {
  return rets
    .map((_, i) => {
      if (i < w - 1) return null
      const sl = rets.slice(i - w + 1, i + 1)
      const m = vmean(sl)
      const rfD = rf / 100 / TD
      const std = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / (w - 1))
      return std < 1e-10 ? 0 : ((m - rfD) / std) * Math.sqrt(TD)
    })
    .filter((v) => v !== null)
}
