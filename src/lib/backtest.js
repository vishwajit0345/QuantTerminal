/*
  backtest.js — walk-forward backtesting engine

  This is the most important correctness feature of the project.
  A backtest that uses future data to estimate weights is called "in-sample"
  or has "look-ahead bias" — the results are completely fake.

  Walk-forward = no look-ahead, guaranteed:
    At rebalance date t:
      - ESTIMATE: use rets[max(0, t-EST_WIN) : t]   ← only past data
      - EVALUATE: apply weights to rets[t : t+REBAL] ← only future data
      - Never overlap. Never touch.

  This gives honest out-of-sample performance numbers.
*/

import { vmean, logRet, dot } from './math.js'
import { oasShrink } from './shrinkage.js'
import { blackLitterman, buildMomentumViews } from './blackLitterman.js'
import { maxSharpeQP, minVarW, riskParityW, applyMaxWeight } from './optimization.js'
import { varMetrics, maxDD, sortino, cagr } from './analytics.js'
import { EST_WIN, REBAL, TD } from '../constants/theme.js'

/*
  Main walk-forward loop.

  rets:        n×T matrix of daily log returns
  wMkt:        market-cap weights for BL prior
  rf:          risk-free rate (annual %)
  txBps:       transaction cost in basis points (1 bps = 0.01%)
  onProgress:  callback(0-100) for progress bar
*/
export async function walkForward(rets, wMkt, rf, txBps, onProgress) {
  const n = rets.length
  const T = rets[0].length
  const txDec = txBps / 10000

  const portRets = {
    maxSharpe:   [],
    minVar:      [],
    riskParity:  [],
    blModel:     [],
    equalWeight: [],
  }

  // track previous weights for turnover calculation
  const prevW = {}
  Object.keys(portRets).forEach((k) => {
    prevW[k] = Array(n).fill(1 / n)
  })

  let rebalCount = 0

  for (let t = EST_WIN; t < T - REBAL; t += REBAL) {
    // estimation window — strictly past data only
    const estRets = rets.map((r) => r.slice(Math.max(0, t - EST_WIN), t))

    // OAS shrinkage on estimation window
    const { cov: covW } = oasShrink(estRets)
    const muW = estRets.map(vmean)

    // BL views from momentum signal (uses only estimation window data)
    const views = buildMomentumViews(muW, covW, n)
    const { muBL, Sigma_BL } = blackLitterman(covW, wMkt, views)

    // solve all strategies
    const wts = {
      maxSharpe:   maxSharpeQP(muW, covW, rf, 1500),
      minVar:      minVarW(covW),
      riskParity:  riskParityW(covW, 500),
      blModel:     maxSharpeQP(muBL.map((m) => m / TD), Sigma_BL || covW, rf, 1500),
      equalWeight: Array(n).fill(1 / n),
    }

    // apply max weight constraint (35% cap)
    Object.keys(wts).forEach((k) => {
      wts[k] = applyMaxWeight(wts[k], 0.35)
    })

    // evaluate on strictly out-of-sample period rets[t : t+REBAL]
    Object.entries(wts).forEach(([k, w]) => {
      const turnover = w.reduce((s, wi, i) => s + Math.abs(wi - prevW[k][i]), 0) / 2
      prevW[k] = [...w]

      const evalEnd = Math.min(t + REBAL, T)
      for (let day = t; day < evalEnd; day++) {
        const dailyRet = dot(w, rets.map((r) => r[day]))
        // deduct round-trip tx cost on first day of new period
        portRets[k].push(day === t ? dailyRet - turnover * txDec : dailyRet)
      }
    })

    rebalCount++
    if (onProgress) {
      onProgress(Math.round(((t - EST_WIN) / (T - EST_WIN - REBAL)) * 100))
    }

    // yield to event loop every few rebalances so UI doesn't freeze
    if (rebalCount % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // build equity curves and compute full stats
  const equity = {}
  const wfStats = {}

  Object.entries(portRets).forEach(([k, r]) => {
    const cum = [1]
    for (const ret of r) cum.push(cum[cum.length - 1] * Math.exp(ret))
    equity[k] = cum

    const yrs = r.length / TD
    const mu = vmean(r)
    const vol = Math.sqrt(vmean(r.map((x) => (x - mu) ** 2)) * TD)
    const vm = varMetrics(r)

    wfStats[k] = {
      cum,
      portRets: r,
      yrs,
      cagr:    cagr(cum[cum.length - 1], yrs),
      vol,
      mdd:     maxDD(cum),
      sortino: sortino(r, rf),
      sharpe:  (mu * TD - rf / 100) / Math.max(vol, 1e-10),
      ...vm,
    }
  })

  return { portRets, equity, wfStats, rebalCount }
}
