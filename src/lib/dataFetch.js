/*
  dataFetch.js — Yahoo Finance price fetching + GBM simulation fallback

  Yahoo Finance doesn't allow direct browser requests (CORS).
  We route through corsproxy.io — it's free, good enough for a project.
  In production you'd run your own backend proxy.

  If Yahoo fails (rate limit, delisted ticker, bad symbol),
  we generate synthetic prices using Geometric Brownian Motion
  from the known params in GBM. The app labels this clearly.
*/

import { bm } from './math.js'
import { GBM as GBM_PARAMS } from '../constants/theme.js'

const CORS_PROXY = 'https://corsproxy.io/?'

/*
  Fetch closing prices from Yahoo Finance for a date range.
  startDate, endDate: 'YYYY-MM-DD' strings
  Returns: array of closing prices (numbers)
*/
export async function fetchPrices(ticker, startDate, endDate) {
  const p1 = Math.floor(new Date(startDate).getTime() / 1000)
  const p2 = Math.floor(new Date(endDate).getTime() / 1000)

  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${p1}&period2=${p2}&includePrePost=false`
  const url = CORS_PROXY + encodeURIComponent(yUrl)

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error('No data returned from Yahoo Finance')

  const closes = result.indicators.quote[0].close
  const valid = closes.filter((c) => c != null && !isNaN(c))

  if (valid.length < 30) {
    throw new Error(`Only ${valid.length} data points — try a wider date range`)
  }

  return valid
}

/*
  Validate a ticker symbol by trying to fetch recent data.
  Returns { name, exchange, currency, type } on success.
*/
export async function validateTicker(ticker) {
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`
  const url = CORS_PROXY + encodeURIComponent(yUrl)

  const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
  if (!res.ok) throw new Error(`Ticker not found (HTTP ${res.status})`)

  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error('Ticker not found on Yahoo Finance')

  const meta = result.meta
  return {
    name:     meta.longName || meta.shortName || ticker,
    exchange: meta.exchangeName || '',
    currency: meta.currency || 'USD',
    type:     meta.instrumentType || 'EQUITY',
  }
}

/*
  GBM simulation — used when Yahoo Finance is unavailable.
  Generates realistic synthetic prices for fallback.

  dS = μ·S·dt + σ·S·dW   (Ito process)
  ln(S_t) = ln(S_0) + (μ - σ²/2)·t + σ·√t·Z,  Z~N(0,1)
*/
export function makeSynthPrices(ticker, nDays = 1000) {
  const p = GBM_PARAMS[ticker] || { mu: 0.10, sig: 0.20, s0: 100 }
  const dt = 1 / 252
  const drift = (p.mu - 0.5 * p.sig ** 2) * dt
  const diffusion = p.sig * Math.sqrt(dt)

  let cur = p.s0
  const prices = [cur]
  for (let i = 1; i < nDays; i++) {
    cur *= Math.exp(drift + diffusion * bm())
    prices.push(Math.max(0.01, cur))
  }
  return prices
}
