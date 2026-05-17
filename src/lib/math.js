/*
  math.js — low-level linear algebra utilities
  These are the building blocks everything else depends on.

  Note: using plain Gaussian elimination here. Cholesky would be
  better for SPD matrices but this works for the sizes we deal with.
  TODO: swap matInv for Cholesky decomp when i get time
*/

// box-muller transform for normal random samples
export const bm = () =>
  Math.sqrt(-2 * Math.log(Math.random() + 1e-16)) *
  Math.cos(2 * Math.PI * Math.random())

export const vmean = (a) => a.reduce((s, v) => s + v, 0) / a.length

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)

// log returns: ln(p_t / p_{t-1})
export const logRet = (prices) =>
  prices.slice(1).map((p, i) => Math.log(p / prices[i]))

// matrix × vector
export const mvMul = (M, v) => M.map((row) => dot(row, v))

// matrix × matrix
export const matMul = (A, B) =>
  A.map((row) =>
    B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0))
  )

/*
  Sample covariance matrix
  Σ_ij = (1/T-1) * Σ_t (r_it - μ_i)(r_jt - μ_j)

  RM: n×T matrix of returns (n assets, T time steps)
*/
export function sampCov(RM) {
  const n = RM.length
  const T = RM[0].length
  const mu = RM.map(vmean)

  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0
      for (let t = 0; t < T; t++) s += (RM[i][t] - mu[i]) * (RM[j][t] - mu[j])
      return s / (T - 1)
    })
  )
}

// pearson correlation from return matrix
export function corrMat(RM) {
  const cov = sampCov(RM)
  const n = cov.length
  const sd = cov.map((r, i) => Math.sqrt(Math.max(r[i], 1e-14)))
  return cov.map((r, i) =>
    r.map((v, j) => v / (sd[i] * sd[j] + 1e-14))
  )
}

/*
  Matrix inversion via Gaussian elimination with partial pivoting.
  reg: small regularisation added to diagonal to handle near-singular matrices
  (covariance matrices can get ill-conditioned with highly correlated assets)
*/
export function matInv(M, reg = 1e-9) {
  const n = M.length
  const A = M.map((r, i) => [
    ...r.map((v, j) => (i === j ? v + reg : v)),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])

  for (let c = 0; c < n; c++) {
    let mr = c
    for (let r = c + 1; r < n; r++)
      if (Math.abs(A[r][c]) > Math.abs(A[mr][c])) mr = r
    ;[A[c], A[mr]] = [A[mr], A[c]]

    const pv = A[c][c]
    if (Math.abs(pv) < 1e-14) continue
    for (let j = 0; j < 2 * n; j++) A[c][j] /= pv

    for (let r = 0; r < n; r++) {
      if (r !== c) {
        const f = A[r][c]
        for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]
      }
    }
  }

  return A.map((r) => r.slice(n))
}

/*
  Project vector v onto the probability simplex:
  { w : w >= 0, sum(w) = 1 }

  Algorithm: Duchi et al. (2008) — O(n log n)
  Used inside Frank-Wolfe to enforce the long-only constraint.
*/
export function projSimplex(v) {
  const n = v.length
  const u = [...v].sort((a, b) => b - a)
  let cssv = 0
  let rho = 0
  for (let i = 0; i < n; i++) {
    cssv += u[i]
    if (u[i] - (cssv - 1) / (i + 1) > 0) rho = i
  }
  const theta = (u.slice(0, rho + 1).reduce((s, x) => s + x, 0) - 1) / (rho + 1)
  return v.map((x) => Math.max(0, x - theta))
}
