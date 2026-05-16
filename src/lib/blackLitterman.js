/*
  blackLitterman.js — full He-Litterman BL posterior

  Reference: Black & Litterman (1992), He & Litterman (1999)
  "The Intuition Behind Black-Litterman Model Portfolios"

  The idea: plain Markowitz uses historical μ directly as expected returns.
  Historical means are noisy — they cause extreme, unstable weights.

  BL instead starts from CAPM equilibrium returns (Π) as a Bayesian prior,
  then updates toward analyst views. The blend is controlled by τ (how much
  to trust the prior) and Ω (view uncertainty).

  Full 9-step posterior:
    1. Π = λ·Σ·w_mkt                 (CAPM equilibrium)
    2. Ω = τ·P·Σ·P^T                 (He-Litterman proportional uncertainty)
    3. M = (τΣ)^{-1} + P^T·Ω^{-1}·P  (posterior precision matrix)
    4. μ_BL = M^{-1}·[(τΣ)^{-1}·Π + P^T·Ω^{-1}·Q]
    5. Σ_BL = Σ + M^{-1}             (posterior full covariance)
*/

import { matInv, mvMul } from './math.js'
import { TD } from '../constants/theme.js'

export function blackLitterman(cov, wMkt, views, tau = 0.05, lam = 2.5) {
  const n = cov.length

  // step 1: equilibrium excess returns
  const PI = mvMul(cov, wMkt).map((v) => v * lam)

  if (!views || views.length === 0) {
    return { muBL: PI, PI, Sigma_BL: cov, tau, lam }
  }

  const K = views.length
  const P = views.map((v) => v.p)  // K×N pick matrix
  const Q = views.map((v) => v.q)  // K view returns

  // step 2: τΣ and its inverse
  const tauSig = cov.map((r) => r.map((v) => v * tau))
  const tauSigInv = matInv(tauSig)

  // P·Σ — needed for Ω
  const PSig = P.map((pRow) =>
    Array.from({ length: n }, (_, j) =>
      pRow.reduce((s, v, k) => s + v * cov[k][j], 0)
    )
  )

  // P·Σ·P^T (K×K)
  const PSigPT = PSig.map((row) => P.map((pRow) => pRow.reduce((s, v, i) => s + v * row[i], 0)))

  // step 2: Ω = τ·diag(P·Σ·P^T)
  const Omega = Array.from({ length: K }, (_, i) =>
    Array.from({ length: K }, (_, j) =>
      i === j ? Math.max(tau * PSigPT[i][i], 1e-8) : 0
    )
  )
  const OmegaInv = matInv(Omega)

  // P^T · Ω^{-1} (N×K)
  const PTOmInv = Array.from({ length: n }, (_, i) =>
    Array.from({ length: K }, (_, k) =>
      P.reduce((s, pRow, m) => s + pRow[i] * OmegaInv[m][k], 0)
    )
  )

  // P^T · Ω^{-1} · P (N×N)
  const PTOmInvP = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      PTOmInv[i].reduce((s, v, k) => s + v * P[k][j], 0)
    )
  )

  // step 3: M = (τΣ)^{-1} + P^T·Ω^{-1}·P
  const Mmat = tauSigInv.map((row, i) => row.map((v, j) => v + PTOmInvP[i][j]))
  const Minv = matInv(Mmat)

  // step 4: RHS = (τΣ)^{-1}·Π + P^T·Ω^{-1}·Q
  const rhs1 = mvMul(tauSigInv, PI)
  const rhs2 = Array.from({ length: n }, (_, i) =>
    PTOmInv[i].reduce((s, v, k) => s + v * Q[k], 0)
  )
  const muBL = mvMul(Minv, rhs1.map((v, i) => v + rhs2[i]))

  // step 5: Σ_BL = Σ + M^{-1}
  const Sigma_BL = cov.map((row, i) => row.map((v, j) => v + Minv[i][j]))

  return { muBL, PI, Sigma_BL, Minv, Omega, tau, lam, views }
}

/*
  Build data-driven views from momentum signals.
  Top asset → absolute bullish view
  Bottom asset → absolute bearish view
  Relative spread between top and bottom
*/
export function buildMomentumViews(muD, covW, n) {
  const annRet = muD.map((m) => m * TD)
  const sorted = annRet.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r)
  const views = []

  const top = sorted[0]
  const bot = sorted[sorted.length - 1]

  // view 1: bullish on top momentum asset (conservative 80% of trailing return)
  const p1 = Array(n).fill(0)
  p1[top.i] = 1
  views.push({
    p: p1,
    q: top.r * 0.8,
    omega: covW[top.i][top.i] * TD * 0.25,
    label: `Bullish: asset[${top.i}]`,
  })

  // view 2: bearish on worst momentum asset
  const p2 = Array(n).fill(0)
  p2[bot.i] = 1
  views.push({
    p: p2,
    q: bot.r * 0.6,
    omega: covW[bot.i][bot.i] * TD * 0.35,
    label: `Cautious: asset[${bot.i}]`,
  })

  // view 3: relative — top outperforms bottom (spread trade)
  if (top.i !== bot.i && top.r - bot.r > 0.02) {
    const p3 = Array(n).fill(0)
    p3[top.i] = 1
    p3[bot.i] = -1
    views.push({
      p: p3,
      q: (top.r - bot.r) * 0.5,
      omega: Math.max(0.02, (covW[top.i][top.i] + covW[bot.i][bot.i]) * TD * 0.2),
      label: `Relative: top vs bottom`,
    })
  }

  return views
}
