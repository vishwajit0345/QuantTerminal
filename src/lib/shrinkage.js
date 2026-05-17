/*
  shrinkage.js — OAS Ledoit-Wolf covariance estimator

  Reference: Chen, Wiesel, Eldar, Hero (2010)
  "Shrinkage Algorithms for MMSE Covariance Estimation"

  The problem: sample covariance has estimation error of order N/T.
  With 15 assets and 252 days that's a ~6% noise ratio — enough to
  blow up the optimiser with extreme weights.

  OAS shrinks S toward a scaled identity: Σ_hat = (1-ρ)S + ρ*(tr(S)/n)*I
  The key: ρ is derived analytically from the data, not chosen manually.

  ρ_OAS = [(1 - 2/n)*tr(S²) + tr(S)²] / [(T+1 - 2/n)*(tr(S²) - tr(S)²/n)]
*/

import { sampCov } from './math.js'

export function oasShrink(RM) {
  const n = RM.length
  const T = RM[0].length
  const S = sampCov(RM)

  // compute tr(S) and tr(S²) = frobenius norm squared
  let trS = 0
  let trS2 = 0
  for (let i = 0; i < n; i++) {
    trS += S[i][i]
    for (let j = 0; j < n; j++) trS2 += S[i][j] * S[i][j]
  }

  const trS_sq = trS * trS
  const muTarget = trS / n  // scalar shrinkage target = avg variance

  const numerator = (1 - 2 / n) * trS2 + trS_sq
  const denominator = (T + 1 - 2 / n) * (trS2 - trS_sq / n)

  // clamp rho to [0, 1]
  const rho = Math.min(1, Math.max(0, Math.abs(denominator) > 1e-14 ? numerator / denominator : 1))

  // shrunk estimator
  const cov = S.map((row, i) =>
    row.map((v, j) => (1 - rho) * v + (i === j ? rho * muTarget : 0))
  )

  return { cov, rho, muTarget, S, n, T }
}
