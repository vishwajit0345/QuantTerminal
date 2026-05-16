/*
  optimization.js — portfolio weight solvers

  Three strategies + the Frank-Wolfe engine for constrained max Sharpe.

  Key insight: the textbook formula w* = Σ^{-1}(μ - rf) is WRONG under
  long-only constraints. Zeroing out negative weights and renormalising
  does NOT maximise Sharpe on the simplex — it just makes the portfolio feasible.
  Frank-Wolfe solves the actual constrained problem correctly.
*/

import { dot, matInv, mvMul, projSimplex } from './math.js'
import { TD } from '../constants/theme.js'

/*
  Max Sharpe via Frank-Wolfe conditional gradient method.

  Problem: max SR(w) = (w^T μ_ex) / √(w^T Σ w)   s.t. w ∈ Δ^{n-1}

  Algorithm (one iteration):
    g = gradient of SR at current w
    s = e_k where k = argmax(g)   ← linear oracle over simplex
    d = s - w                     ← descent direction
    w ← projSimplex(w + α_t * d)  where α_t = 2/(t+2)

  Convergence: O(1/t) to global max on the simplex.
  iters=2500 is plenty for n ≤ 15 assets.
*/
export function maxSharpeQP(muD, cov, rf, iters = 2500) {
  const n = muD.length
  const rfD = rf / 100 / TD
  const ex = muD.map((m) => m - rfD)

  // fallback to min var if no positive excess return
  if (ex.every((e) => e <= 0)) return minVarW(cov)

  let w = Array(n).fill(1 / n)
  let bestW = [...w]
  let bestSR = -Infinity

  for (let k = 0; k < iters; k++) {
    const muP = dot(w, ex)
    let varP = 0
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) varP += w[i] * w[j] * cov[i][j]

    const sigP = Math.sqrt(Math.max(varP, 1e-14))
    const sr = muP / sigP

    if (sr > bestSR) {
      bestSR = sr
      bestW = [...w]
    }

    // gradient: ∂SR/∂w_i = ex_i/σ - SR*(Σw)_i/σ²
    const covW = cov.map((row) => dot(row, w))
    const grad = ex.map((e, i) => e / sigP - (sr * covW[i]) / (sigP * sigP))

    // linear oracle: vertex of simplex with max gradient
    const kStar = grad.indexOf(Math.max(...grad))
    const d = w.map((wi, i) => (i === kStar ? 1 : 0) - wi)

    // open-loop step α_t = 2/(t+2)
    const alpha = 2.0 / (k + 2)
    w = projSimplex(w.map((wi, i) => wi + alpha * d[i]))
  }

  return bestW
}

/*
  Minimum Variance portfolio — analytical long-only.

  Unconstrained: w* = Σ^{-1} · 1 / (1^T · Σ^{-1} · 1)
  Then project to non-negative simplex.
*/
export function minVarW(cov) {
  const n = cov.length
  try {
    const inv = matInv(cov)
    const raw = inv.map((row) => row.reduce((s, v) => s + v, 0))  // Σ^{-1} · 1
    const pos = raw.map((v) => Math.max(0, v))
    const s = pos.reduce((a, b) => a + b, 0)
    return s < 1e-12 ? Array(n).fill(1 / n) : pos.map((v) => v / s)
  } catch {
    return Array(n).fill(1 / n)
  }
}

/*
  Risk Parity / Equal Risk Contribution (ERC).

  Reference: Maillard, Roncalli, Teïletche (2010)

  Target: w_i * (Σw)_i / √(w^T Σ w) = constant for all i
  i.e. every asset contributes equally to total portfolio variance.

  Algorithm: successive approximation — converges reliably.
  w_i ← w_i * sqrt(target / RC_i)  then renormalise

  Not convex, but this fixed-point iteration always converges in practice.
*/
export function riskParityW(cov, iters = 800) {
  const n = cov.length
  let w = Array(n).fill(1 / n)

  for (let k = 0; k < iters; k++) {
    let vp = 0
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) vp += w[i] * w[j] * cov[i][j]

    const sv = Math.sqrt(Math.max(vp, 1e-14))
    const mrc = w.map((_, i) => w.reduce((s, wj, j) => s + wj * cov[i][j], 0) / sv)
    const rc = w.map((wi, i) => wi * mrc[i])  // risk contributions
    const tgt = vp / n  // equal target

    const nw = w.map((wi, i) =>
      wi * Math.sqrt(Math.max(tgt, 1e-14) / Math.max(rc[i], 1e-14))
    )
    const ns = nw.reduce((a, b) => a + b, 0)
    w = nw.map((v) => v / ns)
  }

  return w
}

/*
  Apply max-weight-per-asset constraint (default 35%).
  Called after each optimizer to enforce position limits.
*/
export function applyMaxWeight(w, maxFrac = 0.35) {
  if (!w.some((v) => v > maxFrac)) return w
  const capped = w.map((v) => Math.min(v, maxFrac))
  const excess = 1 - capped.reduce((s, v) => s + v, 0)
  const nUnder = capped.filter((v) => v < maxFrac).length || 1
  return capped.map((v) => (v < maxFrac ? v + excess / nUnder : v))
}
