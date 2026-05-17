/*
  factors.js — advanced quant analytics

  NEW in v5 (Bloomberg upgrade):
    - Jensen's Alpha & Beta vs benchmark
    - Information Ratio & Tracking Error
    - Treynor Ratio
    - Cornish-Fisher CVaR (fat-tail adjusted)
    - Kelly Criterion (full + fractional)
    - Up/Down Capture Ratios
    - Historical Stress Testing (GFC08, COVID20, DotCom00, India08)
    - Regime Detection (bull/bear via rolling returns)
    - Rolling Beta & Correlation vs benchmark
    - Conditional Drawdown at Risk (CDaR)
    - Omega Ratio
    - Gain-to-Pain Ratio

  All implemented from scratch — no external finance libraries.
*/

import { vmean, dot, logRet } from './math.js'
import { TD } from '../constants/theme.js'

// ── Factor model ─────────────────────────────────────────────────

/**
 * Beta: systematic risk relative to benchmark
 * β = Cov(Rp, Rb) / Var(Rb)
 */
export function beta(portRets, benchRets) {
  const n = Math.min(portRets.length, benchRets.length)
  const rp = portRets.slice(-n)
  const rb = benchRets.slice(-n)
  const mp = vmean(rp), mb = vmean(rb)
  let cov = 0, varB = 0
  for (let i = 0; i < n; i++) {
    cov  += (rp[i] - mp) * (rb[i] - mb)
    varB += (rb[i] - mb) ** 2
  }
  return varB > 1e-14 ? cov / varB : 1.0
}

/**
 * Jensen's Alpha: excess return beyond CAPM prediction
 * α = Rp - [Rf + β(Rb - Rf)]
 */
export function jensensAlpha(portRets, benchRets, rf) {
  const rfD = rf / 100 / TD
  const b   = beta(portRets, benchRets)
  const annPortRet  = vmean(portRets) * TD
  const annBenchRet = vmean(benchRets) * TD
  return annPortRet - (rf / 100 + b * (annBenchRet - rf / 100))
}

/**
 * Treynor Ratio: return per unit of systematic risk
 * T = (Rp - Rf) / β
 */
export function treynorRatio(portRets, benchRets, rf) {
  const b = beta(portRets, benchRets)
  const annRet = vmean(portRets) * TD
  return Math.abs(b) > 1e-10 ? (annRet - rf / 100) / b : 0
}

/**
 * Information Ratio: active return per unit of tracking error
 * IR = (Rp - Rb) / TE
 */
export function informationRatio(portRets, benchRets) {
  const n = Math.min(portRets.length, benchRets.length)
  const rp = portRets.slice(-n), rb = benchRets.slice(-n)
  const active = rp.map((r, i) => r - rb[i])
  const te = Math.sqrt(vmean(active.map(r => (r - vmean(active)) ** 2)) * TD)
  return te > 1e-10 ? vmean(active) * TD / te : 0
}

/**
 * Tracking Error: std dev of active returns (annualised)
 */
export function trackingError(portRets, benchRets) {
  const n = Math.min(portRets.length, benchRets.length)
  const active = portRets.slice(-n).map((r, i) => r - benchRets[i])
  return Math.sqrt(vmean(active.map(r => (r - vmean(active)) ** 2)) * TD)
}

/**
 * Up Capture Ratio: how much of benchmark UP moves captured
 * Down Capture Ratio: how much of benchmark DOWN moves suffered
 */
export function captureRatios(portRets, benchRets) {
  const n = Math.min(portRets.length, benchRets.length)
  const rp = portRets.slice(-n), rb = benchRets.slice(-n)
  const upIdx   = rb.map((r, i) => ({ r, i })).filter(x => x.r > 0).map(x => x.i)
  const downIdx = rb.map((r, i) => ({ r, i })).filter(x => x.r < 0).map(x => x.i)

  const upBench   = upIdx.length   ? vmean(upIdx.map(i => rb[i])) : 0
  const downBench = downIdx.length ? vmean(downIdx.map(i => rb[i])) : 0
  const upPort    = upIdx.length   ? vmean(upIdx.map(i => rp[i])) : 0
  const downPort  = downIdx.length ? vmean(downIdx.map(i => rp[i])) : 0

  return {
    up:   Math.abs(upBench)   > 1e-14 ? upPort   / upBench   : 1,
    down: Math.abs(downBench) > 1e-14 ? downPort / downBench : 1,
  }
}

/**
 * Rolling Beta over a sliding window
 */
export function rollingBeta(portRets, benchRets, w = 63) {
  const n = Math.min(portRets.length, benchRets.length)
  const rp = portRets.slice(-n), rb = benchRets.slice(-n)
  return rp.map((_, i) => {
    if (i < w - 1) return null
    const sl_p = rp.slice(i - w + 1, i + 1)
    const sl_b = rb.slice(i - w + 1, i + 1)
    return beta(sl_p, sl_b)
  }).filter(v => v !== null)
}

/**
 * Rolling Correlation with benchmark
 */
export function rollingCorr(portRets, benchRets, w = 63) {
  const n = Math.min(portRets.length, benchRets.length)
  const rp = portRets.slice(-n), rb = benchRets.slice(-n)
  return rp.map((_, i) => {
    if (i < w - 1) return null
    const sp = rp.slice(i - w + 1, i + 1)
    const sb = rb.slice(i - w + 1, i + 1)
    const mp = vmean(sp), mb = vmean(sb)
    let cov = 0, vp = 0, vb = 0
    for (let j = 0; j < w; j++) {
      cov += (sp[j] - mp) * (sb[j] - mb)
      vp  += (sp[j] - mp) ** 2
      vb  += (sb[j] - mb) ** 2
    }
    const denom = Math.sqrt(vp * vb)
    return denom > 1e-14 ? cov / denom : 0
  }).filter(v => v !== null)
}

// ── Advanced risk metrics ─────────────────────────────────────────

/**
 * Cornish-Fisher VaR — adjusts for skewness and excess kurtosis
 * More accurate than parametric VaR for non-normal return distributions
 *
 * z_CF = z + (z²-1)/6·S + (z³-3z)/24·K - (2z³-5z)/36·S²
 * where S = skewness, K = excess kurtosis, z = normal quantile
 */
export function cornishFisherVaR(rets, alpha = 0.05) {
  const mu  = vmean(rets)
  const std = Math.sqrt(vmean(rets.map(r => (r - mu) ** 2)))
  const S   = vmean(rets.map(r => ((r - mu) / std) ** 3))   // skewness
  const K   = vmean(rets.map(r => ((r - mu) / std) ** 4)) - 3 // excess kurtosis

  // normal quantile for alpha (approx)
  const zN = normalQuantile(alpha)

  const zCF = zN
    + (zN ** 2 - 1) / 6 * S
    + (zN ** 3 - 3 * zN) / 24 * K
    - (2 * zN ** 3 - 5 * zN) / 36 * S ** 2

  return -(mu + std * zCF)
}

/** Box-Cox normal quantile approximation */
function normalQuantile(p) {
  const a = [2.515517, 0.802853, 0.010328]
  const b = [1.432788, 0.189269, 0.001308]
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p))
  const num = a[0] + a[1] * t + a[2] * t ** 2
  const den = 1 + b[0] * t + b[1] * t ** 2 + b[2] * t ** 3
  const z = t - num / den
  return p < 0.5 ? -z : z
}

/**
 * Conditional Drawdown at Risk (CDaR) at level α
 * Average of worst α% drawdowns
 */
export function CDaR(cumPrices, alpha = 0.05) {
  let pk = cumPrices[0]
  const dds = cumPrices.map(p => {
    if (p > pk) pk = p
    return (pk - p) / pk
  })
  const sorted = [...dds].sort((a, b) => b - a)
  const k = Math.max(1, Math.floor(alpha * sorted.length))
  return sorted.slice(0, k).reduce((s, v) => s + v, 0) / k
}

/**
 * Omega Ratio: probability-weighted ratio of gains to losses
 * above/below a threshold (usually 0)
 */
export function omegaRatio(rets, threshold = 0) {
  const gains  = rets.filter(r => r > threshold).reduce((s, r) => s + (r - threshold), 0)
  const losses = rets.filter(r => r < threshold).reduce((s, r) => s + (threshold - r), 0)
  return losses > 1e-14 ? gains / losses : Infinity
}

/**
 * Gain-to-Pain Ratio: sum of returns / sum of absolute losses
 */
export function gainToPain(rets) {
  const totalGain = rets.reduce((s, r) => s + r, 0)
  const totalPain = rets.filter(r => r < 0).reduce((s, r) => s + Math.abs(r), 0)
  return totalPain > 1e-14 ? totalGain / totalPain : 0
}

// ── Kelly Criterion ───────────────────────────────────────────────

/**
 * Kelly Criterion for position sizing
 * Full Kelly: f* = μ_ex / σ²   (in discrete approx)
 * Fractional Kelly (half): f = 0.5 * f*   (standard risk management practice)
 *
 * Gives the theoretically optimal fraction of capital to allocate.
 */
export function kellyCriterion(muAnn, volAnn, rf) {
  const mu_ex = muAnn - rf / 100
  const variance = volAnn ** 2
  const fullKelly = variance > 1e-10 ? mu_ex / variance : 0
  return {
    full:       Math.min(2.0,  Math.max(-0.5, fullKelly)),
    half:       Math.min(1.0,  Math.max(-0.25, fullKelly / 2)),
    quarter:    Math.min(0.5,  Math.max(-0.125, fullKelly / 4)),
  }
}

// ── Historical Stress Tests ──────────────────────────────────────
//
// Applies known historical factor shocks to the current portfolio.
// Calculates estimated P&L based on asset-class sensitivities.

export const STRESS_SCENARIOS = [
  {
    id: 'gfc2008',
    name: 'GFC 2008',
    date: 'Sep 2008 – Mar 2009',
    description: 'Global Financial Crisis — Lehman Brothers collapse, credit market freeze',
    color: '#ff1744',
    shocks: {
      equity:    -0.55,   // S&P 500 fell ~55%
      tech:      -0.50,
      finance:   -0.75,   // banks worst hit
      energy:    -0.55,
      gold:      +0.25,   // safe haven
      bonds:     +0.15,   // flight to quality
      reit:      -0.70,
      emerging:  -0.60,
      default:   -0.45,
    }
  },
  {
    id: 'covid2020',
    name: 'COVID Crash 2020',
    date: 'Feb 2020 – Mar 2020',
    description: '33-day fastest bear market in history — pandemic lockdowns',
    color: '#ff6600',
    shocks: {
      equity:    -0.34,
      tech:      -0.28,   // tech held up relatively
      finance:   -0.40,
      energy:    -0.55,   // oil demand collapse
      gold:      +0.03,
      bonds:     +0.10,
      reit:      -0.40,
      emerging:  -0.32,
      default:   -0.30,
    }
  },
  {
    id: 'dotcom2000',
    name: 'Dot-com Bust 2000',
    date: 'Mar 2000 – Oct 2002',
    description: 'Nasdaq fell 78%. Technology valuations collapsed.',
    color: '#ffab00',
    shocks: {
      equity:    -0.49,
      tech:      -0.78,   // Nasdaq devastated
      finance:   -0.30,
      energy:    -0.20,
      gold:      +0.18,
      bonds:     +0.20,
      reit:      +0.05,
      emerging:  -0.25,
      default:   -0.40,
    }
  },
  {
    id: 'russia2022',
    name: 'Rate Hike Cycle 2022',
    date: 'Jan 2022 – Dec 2022',
    description: 'Fed raised rates 425bps. Bonds worst year in 40 years.',
    color: '#7c4dff',
    shocks: {
      equity:    -0.19,
      tech:      -0.33,   // high-duration growth stocks hit hard
      finance:   -0.10,
      energy:    +0.40,   // energy outperformed
      gold:      -0.01,
      bonds:     -0.30,   // long bonds devastated
      reit:      -0.26,
      emerging:  -0.22,
      default:   -0.18,
    }
  },
  {
    id: 'india2008',
    name: 'India Market Crash 2008',
    date: 'Jan 2008 – Mar 2009',
    description: 'Sensex fell 52%. FII outflows, global contagion.',
    color: '#f06292',
    shocks: {
      equity:    -0.52,
      tech:      -0.55,
      finance:   -0.60,
      energy:    -0.45,
      gold:      +0.20,
      bonds:     +0.08,
      reit:      -0.55,
      emerging:  -0.52,
      default:   -0.48,
    }
  },
  {
    id: 'custom_mild',
    name: 'Mild Correction',
    date: 'Hypothetical',
    description: 'A typical 10–15% equity market correction',
    color: '#00e5ff',
    shocks: {
      equity:    -0.12,
      tech:      -0.15,
      finance:   -0.10,
      energy:    -0.08,
      gold:      +0.04,
      bonds:     +0.03,
      reit:      -0.10,
      emerging:  -0.12,
      default:   -0.10,
    }
  },
]

// Asset class mapping — classify a ticker into a stress-test category
export function classifyAsset(ticker) {
  const t = ticker.toUpperCase().replace('.NS','').replace('.BO','').replace('.L','').replace('.DE','')
  if (['GLD','IAU','SGOL','GLDM','SLV'].includes(t)) return 'gold'
  if (['TLT','IEF','BND','AGG','GOVT','VGIT'].includes(t)) return 'bonds'
  if (['VNQ','XLRE','REM','REIT'].includes(t)) return 'reit'
  if (['SPY','IVV','VOO','QQQ','IWM','VTI','SCHB'].includes(t)) return 'equity'
  if (['AAPL','MSFT','NVDA','GOOGL','META','TSLA','AMD','INTC','ORCL',
       'TCS','INFY','WIPRO','HCL','TECHM'].includes(t)) return 'tech'
  if (['JPM','GS','BAC','C','MS','WFC','V','MA','AXP','BRK',
       'HDFCBANK','ICICIBANK','KOTAKBANK','AXISBANK','SBIN'].includes(t)) return 'finance'
  if (['XOM','CVX','COP','SLB','BP','SHEL','RELIANCE','ONGC','BPCL'].includes(t)) return 'energy'
  if (['EEM','EFA','VWO','IEMG'].includes(t)) return 'emerging'
  return 'default'
}

/**
 * Run a stress test scenario on a portfolio
 * Returns estimated portfolio P&L under each scenario
 */
export function runStressTest(weights, tickers, scenario) {
  let portfolioShock = 0
  const breakdown = {}

  tickers.forEach((t, i) => {
    const assetClass = classifyAsset(t)
    const shock = scenario.shocks[assetClass] ?? scenario.shocks.default
    const contribution = weights[i] * shock
    portfolioShock += contribution
    breakdown[t] = {
      assetClass,
      weight: weights[i],
      shock,
      contribution,
    }
  })

  return {
    scenario: scenario.name,
    totalShock: portfolioShock,
    breakdown,
  }
}

// ── Regime Detection ──────────────────────────────────────────────

/**
 * Simple bull/bear regime detection via 200-day moving average
 * Returns array of regime labels: 'bull' | 'bear' | 'neutral'
 */
export function detectRegimes(prices, maPeriod = 200) {
  return prices.map((p, i) => {
    if (i < maPeriod - 1) return 'neutral'
    const ma = prices.slice(i - maPeriod + 1, i + 1).reduce((s, v) => s + v, 0) / maPeriod
    const gap = (p - ma) / ma
    if (gap > 0.05)  return 'bull'
    if (gap < -0.05) return 'bear'
    return 'neutral'
  })
}

/**
 * Regime-conditional Sharpe ratio
 * Returns Sharpe in bull periods vs bear periods
 */
export function regimeSharpe(portRets, regimes, rf) {
  const rfD = rf / 100 / TD
  const bullRets = portRets.filter((_, i) => regimes[i] === 'bull')
  const bearRets = portRets.filter((_, i) => regimes[i] === 'bear')

  const calc = (rets) => {
    if (!rets.length) return 0
    const mu  = vmean(rets)
    const std = Math.sqrt(vmean(rets.map(r => (r - mu) ** 2)))
    return std > 1e-10 ? (mu - rfD) / std * Math.sqrt(TD) : 0
  }

  return { bull: calc(bullRets), bear: calc(bearRets) }
}
