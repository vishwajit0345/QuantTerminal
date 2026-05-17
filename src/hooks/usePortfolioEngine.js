/*
  usePortfolioEngine.js — orchestrates the full optimization pipeline
  
  Updated in v5:
  - Passes rf through to engine for factor analysis
  - Exposes txBps
  - Uses theme.js constants
*/

import { useState, useCallback } from 'react'
import { vmean, logRet } from '../lib/math.js'
import { oasShrink } from '../lib/shrinkage.js'
import { blackLitterman, buildMomentumViews } from '../lib/blackLitterman.js'
import { maxSharpeQP, minVarW, riskParityW, applyMaxWeight } from '../lib/optimization.js'
import { portMetrics, riskContrib } from '../lib/analytics.js'
import { walkForward } from '../lib/backtest.js'
import { fetchPrices, makeSynthPrices } from '../lib/dataFetch.js'
import { TD, EST_WIN, REBAL, N_MC } from '../constants/theme.js'

export function usePortfolioEngine() {
  const [status, setStatus]         = useState('idle')
  const [loadMsg, setLoadMsg]       = useState('')
  const [progress, setProgress]     = useState(0)
  const [engine, setEngine]         = useState(null)
  const [fetchErrors, setFetchErrors] = useState([])

  const run = useCallback(async (assets, startDate, endDate, rf, txBps) => {
    if (assets.length < 3) return
    setStatus('loading'); setEngine(null); setFetchErrors([]); setProgress(0)

    const tickers = assets.map(a => a.ticker)
    const errors  = []
    const rawPx   = {}

    // 1. Fetch prices
    for (const t of tickers) {
      setLoadMsg(`FETCHING ${t} FROM YAHOO FINANCE`)
      try {
        rawPx[t] = await fetchPrices(t, startDate, endDate)
      } catch (e) {
        errors.push({ ticker: t, error: e.message })
        rawPx[t] = makeSynthPrices(t)
      }
    }
    if (errors.length) setFetchErrors(errors)

    // 2. Align + log returns
    setLoadMsg('ALIGNING SERIES · COMPUTING LOG RETURNS')
    const minLen = Math.min(...tickers.map(t => rawPx[t].length))
    const prices  = tickers.map(t => rawPx[t].slice(-minLen))
    const allRets = prices.map(logRet)
    const Td      = Math.min(...allRets.map(r => r.length))
    const rets    = allRets.map(r => r.slice(-Td))
    const muD     = rets.map(vmean)

    // 3. OAS Shrinkage
    setLoadMsg('OAS LEDOIT-WOLF COVARIANCE SHRINKAGE (CHEN ET AL. 2010)')
    const { cov, rho } = oasShrink(rets)
    const wMkt = Array(tickers.length).fill(1 / tickers.length)

    // 4. Monte Carlo
    setLoadMsg(`MONTE CARLO SIMULATION (${N_MC.toLocaleString()} PORTFOLIOS)`)
    const mc = []
    for (let i = 0; i < N_MC; i++) {
      const r = Array.from({ length: tickers.length }, () => -Math.log(Math.random() + 1e-16))
      const s = r.reduce((a, b) => a + b, 0)
      const w = r.map(v => v / s)
      mc.push({ ...portMetrics(w, muD, cov, rf), w })
    }

    // 5. BL + in-sample weights
    setLoadMsg('BLACK-LITTERMAN POSTERIOR · FRANK-WOLFE QP')
    const views = buildMomentumViews(muD, cov, tickers.length)
    const { muBL, Sigma_BL, PI } = blackLitterman(cov, wMkt, views)
    const rawWeights = {
      maxSharpe:   maxSharpeQP(muD, cov, rf, 2500),
      minVar:      minVarW(cov),
      riskParity:  riskParityW(cov),
      blModel:     maxSharpeQP(muBL.map(m => m / TD), Sigma_BL || cov, rf, 2500),
      equalWeight: Array(tickers.length).fill(1 / tickers.length),
    }

    const inSample = {}
    Object.entries(rawWeights).forEach(([k, w]) => {
      const capped = applyMaxWeight(w)
      inSample[k] = {
        ...portMetrics(capped, muD, cov, rf),
        w: capped, rc: riskContrib(capped, cov),
        label: { maxSharpe:'Max Sharpe', minVar:'Min Variance', riskParity:'Risk Parity', blModel:'Black-Litterman', equalWeight:'Equal Weight' }[k],
      }
    })

    // 6. Walk-forward
    const canWF = Td >= EST_WIN + REBAL * 2
    let wf = {}
    if (canWF) {
      setLoadMsg('WALK-FORWARD BACKTEST (ZERO LOOK-AHEAD)')
      const result = await walkForward(rets, wMkt, rf, txBps, p => {
        setProgress(p)
        setLoadMsg(`WALK-FORWARD BACKTEST: ${p}% COMPLETE`)
      })
      wf = result.wfStats
    }

    const yrs = Td / TD
    setEngine({
      tickers, assets: [...assets], muD, cov, rets, prices,
      mc, inSample, wf, views, muBL, PI, rho, Td, yrs,
      canWF, startDate, endDate, n: tickers.length, rf, txBps,
    })
    setStatus('done')
    setLoadMsg('')
  }, [])

  return { status, loadMsg, progress, engine, fetchErrors, run }
}
