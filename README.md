# QuantTerminal

A Terminal-style portfolio optimizer built in React. The quantitative finance algorithms (covariance shrinkage, Black-Litterman, Frank-Wolfe, risk parity, walk-forward backtesting, risk and factor analytics) are implemented in plain JavaScript, with no third-party finance libraries.

**Live demo:** https://quant-terminal-sjh.vercel.app/

<!-- Add screenshots to docs/screenshots/ and uncomment:
![Overview](docs/screenshots/overview.png)
![Efficient frontier](docs/screenshots/frontier.png)
![Walk-forward backtest](docs/screenshots/backtest.png)
-->

## What It Does

Pick 3 to 12 tickers from NSE, BSE, NYSE or NASDAQ (live Yahoo Finance data), choose a date range, and the app will:

- Run 5 portfolio strategies side by side
- Backtest them with a walk-forward engine (no lookahead)
- Report tail risk: VaR, CVaR and Cornish-Fisher adjusted VaR, plus Sortino, Calmar and max drawdown
- Run factor analysis: Jensen's alpha, beta, information ratio, Treynor, Kelly, Omega, up/down capture
- Stress test the portfolio against 6 historical scenarios
- Project SIP returns with step-up, inflation and an implied XIRR
- Save optimization runs in the browser (IndexedDB)

Defaults: 5-year window, 4.5% risk-free rate, 10 bps transaction cost.

## Tabs

| Key | Tab | What it shows |
|-----|-----|---------------|
| F2 | Overview | Equity curves, metrics, return distribution, drawdown |
| F3 | Frontier | Efficient frontier with 5,000 random long-only portfolios |
| F4 | Allocation | Weights, risk contributions, correlation matrix |
| F5 | Risk | VaR, CVaR, Cornish-Fisher adjusted tail risk |
| F6 | Backtest | Walk-forward, out-of-sample performance comparison |
| F7 | Black-Litterman | Posterior returns from momentum-derived views |
| F8 | Factor Analysis | Beta, alpha, IR, Treynor, Kelly, up/down capture |
| F9 | Stress Test | P&L impact across 6 historical scenarios |
| F10 | Compare | Radar chart and full performance table across strategies |
| F11 | SIP Calc | SIP calculator with step-up, inflation, XIRR |
| F12 | Saved Results | Previously saved optimization runs |

## Strategies

### 1. Max Sharpe (Frank-Wolfe)

Maximizes the Sharpe ratio under long-only, fully-invested constraints.

```
maximize  (μᵀw − rf) / √(wᵀΣw)
subject to  Σwᵢ = 1,  wᵢ ≥ 0
```

Each iteration computes the gradient of the Sharpe ratio, moves toward the simplex vertex with the largest gradient, and uses the open-loop step size 2/(t+2). A projection onto the simplex guards against numerical drift, and the best iterate is kept. Up to 2,500 iterations (1,500 per rebalance in the backtest). If no asset has positive excess return, it falls back to minimum variance.

### 2. Minimum Variance

Starts from the closed-form solution `w = Σ⁻¹1 / (1ᵀΣ⁻¹1)`, then clips negative weights to zero and renormalizes. This is a heuristic, not an exact long-only QP (see Known Limitations).

### 3. Equal Risk Contribution (Risk Parity)

Each asset contributes equally to total portfolio risk:

```
RCᵢ = wᵢ · (Σw)ᵢ / σ  is equal for all i
```

Solved with a multiplicative fixed-point iteration, `wᵢ ← wᵢ · √(target / RCᵢ)` followed by renormalization (Maillard, Roncalli & Teïletche, 2010).

### 4. Black-Litterman (He-Litterman)

```
Π    = λ Σ w_mkt                          (equilibrium returns, λ = 2.5)
M    = (τΣ)⁻¹ + Pᵀ Ω⁻¹ P                  (posterior precision)
μ_BL = M⁻¹ [ (τΣ)⁻¹ Π + Pᵀ Ω⁻¹ Q ]       (posterior mean)
```

Parameters: τ = 0.05, Ω = diag(τ P Σ Pᵀ). The views are generated from momentum over the estimation window: bullish on the strongest asset, cautious on the weakest, and a relative view between the two. `w_mkt` is an equal-weight proxy (no market-cap data). The posterior returns are then fed into the same Frank-Wolfe max-Sharpe solver.

### 5. Equal Weight

1/N baseline for benchmarking.

## Covariance Estimation: OAS Shrinkage

The sample covariance matrix is noisy when the number of observations is not much larger than the number of assets. The project uses the Oracle Approximating Shrinkage (OAS) estimator from Chen, Wiesel, Eldar & Hero (2010), which shrinks toward a scaled identity matrix:

```
Σ_OAS = (1 − ρ) S + ρ (tr(S)/p) I

ρ = ((1 − 2/p) tr(S²) + tr(S)²) / ((n + 1 − 2/p) (tr(S²) − tr(S)²/p))
```

`p` is the number of assets, `n` the number of observations and `S` the sample covariance matrix. ρ is computed from the data and clamped to [0, 1].

## Walk-Forward Backtest

Weights are estimated only from data that was available at the time:

```
Estimation window:  252 trading days
Rebalancing:        every 21 trading days
Transaction cost:   10 bps by default (adjustable, 0 to 100 bps)
                    × one-way turnover (½ Σ|Δw|), charged on the first day of each period
Position cap:       35% per asset
```

At each rebalance date `t`, weights are fitted on returns `[t−252, t)` and applied to returns `[t, t+21)`. Estimation and evaluation windows never overlap. Needs more than about 273 daily returns (roughly 1.1 years) to produce a backtest.

The app also computes full-period (in-sample) optimizations for the allocation views. Treat those as descriptive; the Backtest tab is the out-of-sample view.

## Risk Metrics

- **VaR:** historical simulation at 95% and 99%
- **CVaR (expected shortfall):** average loss beyond the VaR threshold
- **Cornish-Fisher VaR:** adjusts for skewness (S) and excess kurtosis (K)

```
z_CF = z + (z²−1)/6 · S + (z³−3z)/24 · K − (2z³−5z)/36 · S²
```

- **Sortino:** return per unit of downside deviation
- **Calmar:** CAGR divided by maximum drawdown
- **Maximum drawdown:** largest peak-to-trough decline

## Factor Analysis

| Metric | Formula | Meaning |
|--------|---------|---------|
| Beta (β) | Cov(Rp, Rb) / Var(Rb) | Systematic risk vs benchmark |
| Jensen's alpha (α) | Rp − [Rf + β(Rb − Rf)] | Excess return over CAPM |
| Treynor | (Rp − Rf) / β | Return per unit of systematic risk |
| Information ratio | Active return / tracking error | Consistency of active return |
| Up / down capture | Portfolio move / benchmark move in up / down markets | Participation in rallies and drawdowns |
| Kelly | (μ − Rf) / σ² | Theoretical optimal sizing |
| Omega | Σ gains / Σ losses | Gain/loss ratio |

## Stress Testing

Each asset is mapped to an asset class (equity, tech, finance, energy, gold, bonds, REIT, emerging, or a default), and portfolio P&L is estimated as Σ weight × class shock. Selected shocks:

| Scenario | Equity | Tech | Bonds | Gold |
|----------|-------:|-----:|------:|-----:|
| GFC 2008 | −55% | −50% | +15% | +25% |
| COVID crash 2020 | −34% | −28% | +10% | +3% |
| Dot-com bust 2000 | −49% | −78% | +20% | +18% |
| Rate hike cycle 2022 | −19% | −33% | −30% | −1% |
| India crash 2008 | −52% | −55% | +8% | +20% |
| Mild correction (hypothetical) | −12% | −15% | +3% | +4% |

The shocks are approximate historical ranges, not a full revaluation of each holding.

## SIP Calculator

Month-by-month compounding with an annual step-up (not the simplified annuity formula):

```
FV = Σᵢ Pᵢ · (1 + r)^(n − i)        Pᵢ = P₀ · (1 + s)^⌊(i−1)/12⌋
```

The inflation-adjusted corpus is `FV / (1 + inflation)^years`. The XIRR figure solves NPV(x) = 0 with Newton-Raphson over the projected cash flows (monthly outflows, terminal corpus) and is reported as an effective annual rate. It describes the projection, not realized returns.

## Data

Price requests go through `/api/yahoo`, a small proxy to Yahoo Finance's chart endpoint (a Vite dev proxy locally, a Vercel serverless function in production). `corsproxy.io` is used as a backup. If a ticker still fails to load, that ticker is replaced by simulated Geometric Brownian Motion prices and flagged in the sidebar. Results that include simulated tickers are not market results.

Examples: `RELIANCE.NS`, `INFY.NS`, `TCS.NS`, `AAPL`, `MSFT`, `NVDA`, `SPY`, `QQQ`, `GLD`, `TLT`, `AGG`.

## Persistence

Optimization runs are saved to the browser's IndexedDB. There is no server-side storage. Each save stores the strategy weights and walk-forward metrics, equity curves downsampled to 100 points per strategy, and the asset list, date range, risk-free rate and cost settings. Raw return matrices, full price history and Monte Carlo points are not stored; they are recomputed on demand.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Charts | Recharts |
| Styling | CSS variables, IBM Plex Mono |
| Data | Yahoo Finance via a serverless proxy (`api/yahoo.js`) |
| Storage | Browser IndexedDB |
| Math | Plain JavaScript |
| Hosting | Vercel |

## Project Structure

```
api/
└── yahoo.js                   # Serverless proxy for Yahoo Finance
src/
├── App.jsx                    # App shell, sidebar, tab routing, key bindings
├── main.jsx
├── components/                # Terminal shell, ticker input, date range picker
├── constants/
│   └── theme.js               # Colors, strategy definitions, model constants
├── hooks/
│   └── usePortfolioEngine.js  # Fetch → shrink → optimize → backtest pipeline
├── lib/
│   ├── optimization.js        # Frank-Wolfe, minimum variance, risk parity
│   ├── blackLitterman.js      # Black-Litterman and momentum views
│   ├── shrinkage.js           # OAS covariance estimator
│   ├── backtest.js            # Walk-forward engine
│   ├── analytics.js           # VaR, CVaR, Sortino, Calmar
│   ├── factors.js             # Factor metrics, Cornish-Fisher, stress scenarios
│   ├── dataFetch.js           # Yahoo fetching and GBM fallback
│   ├── math.js                # Matrix inverse, covariance, simplex projection
│   └── db.js                  # IndexedDB access
└── views/                     # One view per tab group
```

## Run Locally

```bash
git clone https://github.com/vishwajit0345/QuantTerminal.git
cd QuantTerminal
npm install
npm run dev
# open http://localhost:5173
```

## How to Use

1. Type a ticker in the sidebar (for example `AAPL` or `RELIANCE.NS`). Press Enter to validate it and Enter again to add it. Add at least 3 and at most 12.
2. Set the date range (default: 5 years).
3. Click **Run Optimizer**.
4. Move between tabs with F2 to F12 or by clicking the tab labels.
5. Click **Save Result** to store the run, and open the Saved Results tab to revisit it.

## Design Decisions

**Why Frank-Wolfe for max Sharpe?** The textbook tangency portfolio `Σ⁻¹(μ − rf)` ignores the long-only constraint, and zeroing out negative weights afterwards does not maximize Sharpe. Frank-Wolfe moves toward vertices of the simplex, so every iterate is already a valid long-only portfolio.

**Why OAS over standard Ledoit-Wolf?** OAS picks the shrinkage intensity analytically and tends to behave better than the 2004 Ledoit-Wolf intensity when the sample is small relative to the number of assets.

**Why walk-forward?** In-sample backtests fit to the same data they are scored on and overstate performance. Walk-forward re-estimates using only past data at every rebalance.

**Why IndexedDB over localStorage?** It stores structured data asynchronously and has a much larger quota than localStorage's roughly 5 MB of strings, which matters when saving several runs with equity curves.

## Known Limitations

- Yahoo Finance's chart endpoint is unofficial and can rate-limit or fail; failed tickers fall back to simulated prices
- Minimum Variance clips and renormalizes the closed-form solution instead of solving the constrained problem exactly
- Black-Litterman uses equal weights as the market-weight proxy and momentum-derived views rather than user-entered views
- Stress shocks are class-level estimates, not security-level revaluations
- All computation runs in the browser, so large portfolios may be slow on weak devices
- No tax-aware optimization, lot-size rounding or market-impact model

## About

Built by **Vishwajit**, a final-year B.E. Information Science & Engineering student at DSATM, Bengaluru (batch of 2027). Interested in quantitative finance, portfolio optimization and fintech engineering.

[LinkedIn](https://www.linkedin.com/in/vishwajit-kumar-a32b51291) · [GitHub](https://github.com/vishwajit0345)

## References

- He, G. & Litterman, R. (1999). *The Intuition Behind Black-Litterman Model Portfolios*. Goldman Sachs
- Chen, Y., Wiesel, A., Eldar, Y. & Hero, A. (2010). *Shrinkage Algorithms for MMSE Covariance Estimation*. IEEE
- Maillard, S., Roncalli, T. & Teïletche, J. (2010). *The Properties of Equally Weighted Risk Contribution Portfolios*. Journal of Portfolio Management
- Frank, M. & Wolfe, P. (1956). *An Algorithm for Quadratic Programming*. Naval Research Logistics Quarterly
- Cornish, E.A. & Fisher, R.A. (1937). *Moments and Cumulants in the Specification of Distributions*. Revue de l'Institut International de Statistique
- Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices*. Journal of Multivariate Analysis
