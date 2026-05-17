
> A Bloomberg Terminal-inspired portfolio optimizer built entirely from scratch in React.  
> Implements institutional-grade quantitative finance algorithms without any third-party finance libraries.


📁 **GitHub:** [https://github.com/vishwajit0345/QuantTerminal](https://github.com/vishwajit0345/QuantTerminal)

---

## What Is This?

Quant Terminal is a web-based portfolio optimization platform that allows users to:

- Select any stock worldwide (NSE, BSE, NYSE, NASDAQ) using live Yahoo Finance data
- Run 5 different portfolio optimization strategies simultaneously
- Backtest strategies with zero lookahead bias using walk-forward methodology
- Analyze risk using institutional metrics like Cornish-Fisher CVaR, VaR, Sortino, Calmar
- View factor analysis including Jensen's Alpha, Beta, Information Ratio, Kelly Criterion
- Stress test portfolios against historical crises (GFC 2008, COVID-19, Dot-com 2000)
- Calculate SIP returns with step-up and Newton-Raphson XIRR
- Save optimization results persistently using browser IndexedDB

---

## Live Features (11 Tabs)

| Key | Tab | What It Shows |
|-----|-----|---------------|
| F2 | Overview | Equity curves, metrics, return distribution, drawdown chart |
| F3 | Frontier | Efficient frontier with 4000 Monte Carlo portfolios |
| F4 | Allocation | Portfolio weights, risk contributions, correlation matrix |
| F5 | Risk | VaR, CVaR, Cornish-Fisher adjusted tail risk metrics |
| F6 | Backtest | Walk-forward out-of-sample performance comparison |
| F7 | Black-Litterman | He-Litterman BL posterior with custom investor views |
| F8 | Factor Analysis | Beta, Alpha, IR, Treynor, Kelly, Up/Down capture |
| F9 | Stress Test | P&L impact across 6 historical crisis scenarios |
| F10 | Compare | Radar chart + full performance table across all strategies |
| F11 | SIP Calc | SIP calculator with step-up, inflation, XIRR |
| F12 | Saved Results | IndexedDB persistent storage for all optimization runs |

---

## Optimization Strategies

### 1. Max Sharpe Ratio (Frank-Wolfe QP)
Maximizes the Sharpe ratio under long-only constraints using the Frank-Wolfe algorithm with correct gradient derivation on the constrained manifold. Unlike gradient descent, Frank-Wolfe handles the simplex constraint naturally without projection.

```
maximize  (μᵀw − rf) / √(wᵀΣw)
subject to  Σwᵢ = 1,  wᵢ ≥ 0
```

### 2. Minimum Variance (Quadratic Programming)
Finds the portfolio with the lowest possible volatility regardless of expected returns.

```
minimize  wᵀΣw
subject to  Σwᵢ = 1,  wᵢ ≥ 0
```

### 3. Equal Risk Contribution (Risk Parity)
Each asset contributes equally to total portfolio risk. Solved iteratively using Newton-Raphson on the risk contribution equations.

```
RCᵢ = wᵢ × (∂σ/∂wᵢ) = σ/N  for all i
```

### 4. Black-Litterman Model (He-Litterman 1999)
Full He-Litterman implementation with CAPM prior, investor views, and Bayesian posterior:

```
Π = λΣw_mkt                          (CAPM equilibrium)
M = (τΣ)⁻¹ + PᵀΩ⁻¹P                 (posterior precision)
μ_BL = M⁻¹[(τΣ)⁻¹Π + PᵀΩ⁻¹Q]       (posterior mean)
```

Parameters: τ = 0.05, Ω = τPΣPᵀ (uncertainty proportional to prior)

### 5. Equal Weight
Baseline 1/N portfolio for benchmarking.

---

## Covariance Estimation — OAS Ledoit-Wolf Shrinkage

Standard sample covariance is noisy for high-dimensional portfolios. This project implements the **Oracle Approximating Shrinkage (OAS)** estimator from Chen, Wiesel, Eldar & Hero (2010):

```
Σ_OAS = (1 − ρ) × S + ρ × μ_S × I

ρ = ((1−2/p) × Tr(S²) + Tr(S)²) / ((n+1−2/p) × (Tr(S²) − Tr(S)²/p))
```

Where `p` = number of assets, `n` = number of observations, `S` = sample covariance matrix.

This produces a better-conditioned covariance matrix especially when the number of observations is not much larger than the number of assets.

---

## Backtesting — Zero Lookahead Bias

All performance metrics use **walk-forward out-of-sample backtesting**:

```
Estimation window:  252 trading days (1 year)
Rebalancing:        Every 21 trading days (monthly)
Transaction costs:  10 bps per unit of turnover
Lookahead bias:     Zero — optimization uses only past data
```

The walk-forward engine strictly separates estimation and evaluation periods. Weights computed on day T use only data from days T-252 to T-1. Performance is evaluated from day T+1 onward.

---

## Risk Metrics

### Value at Risk (VaR)
Historical simulation VaR at 95% and 99% confidence levels from the walk-forward return series.

### Conditional VaR (CVaR / Expected Shortfall)
Average loss beyond the VaR threshold — a more complete measure of tail risk.

### Cornish-Fisher Adjusted VaR
Adjusts VaR for non-normal return distributions using skewness (S) and excess kurtosis (K):

```
z_CF = z_N + (z²−1)/6 × S + (z³−3z)/24 × K − (2z³−5z)/36 × S²
```

### Additional Metrics
- **Sortino Ratio** — return per unit of downside deviation
- **Calmar Ratio** — CAGR divided by maximum drawdown
- **Maximum Drawdown** — largest peak-to-trough decline

---

## Factor Analysis

| Metric | Formula | Description |
|--------|---------|-------------|
| Beta (β) | Cov(Rp,Rb) / Var(Rb) | Systematic risk vs benchmark |
| Jensen's Alpha (α) | Rp − [Rf + β(Rb−Rf)] | Excess return above CAPM prediction |
| Treynor Ratio | (Rp−Rf) / β | Return per unit of systematic risk |
| Information Ratio | Active Return / Tracking Error | Skill of active management |
| Up Capture | Portfolio gain / Benchmark gain in up markets | Bull market participation |
| Down Capture | Portfolio loss / Benchmark loss in down markets | Bear market protection |
| Kelly Criterion | (μ−Rf) / σ² | Theoretically optimal position size |
| Omega Ratio | Σ gains / Σ losses | Probability-weighted gain/loss ratio |

---

## SIP Calculator

Implements accurate month-by-month compounding (not simplified annuity formula):

```
FV = Σᵢ₌₁ⁿ Pᵢ × (1+r)^(n−i)

Pᵢ = P₀ × (1+s)^⌊(i−1)/12⌋     (step-up every 12 months)
```

**XIRR** uses Newton-Raphson iteration to find the internal rate of return — identical to Excel's XIRR function. Reports the effective annual rate (not nominal).

---

## Data

**Primary:** Yahoo Finance (live data via browser fetch)  
**Fallback:** Geometric Brownian Motion simulation when Yahoo Finance is unavailable (CORS on deployed environments)

Supports any ticker worldwide including:
- Indian stocks: `RELIANCE.NS`, `INFY.NS`, `TCS.NS`
- US stocks: `AAPL`, `MSFT`, `NVDA`
- ETFs: `SPY`, `QQQ`, `GLD`
- Bonds: `TLT`, `AGG`

---

## Stress Testing

Portfolio P&L impact estimated across 6 historical crisis scenarios using asset-class shock vectors:

| Scenario | Equity Shock | Bond Shock |
|----------|-------------|------------|
| GFC 2008 | −55% | +20% |
| COVID-19 2020 | −35% | +18% |
| Dot-com 2000 | −48% | +8% |
| Rate Hike 2022 | −28% | −35% |
| India Crash 2008 | −52% | +12% |
| Mild Correction | −12% | +3% |

---

## Persistence — IndexedDB

Optimization results are saved to the browser's IndexedDB — no server required. Results survive page refresh and browser restart until explicitly deleted by the user.

**What is stored per save:**
- All 5 strategy weights and walk-forward metrics
- Downsampled equity curves (100 points per strategy)
- Asset list, date range, RF rate, transaction cost parameters

**What is not stored** (too large, recomputed on demand):
- Raw daily returns matrix
- Full price history
- Monte Carlo scatter points

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Charts | Recharts |
| Styling | CSS Variables + IBM Plex Mono |
| Data | Yahoo Finance API |
| Storage | Browser IndexedDB (no backend) |
| Math | Pure JavaScript (no finance libraries) |
| Deploy | Vercel |

---

## Project Structure

```
src/
├── App.jsx                    # Main app, routing, sidebar, layout
├── components/
│   └── TerminalShell.jsx      # Header, ticker tape, function key bar, shared UI
├── constants/
│   ├── theme.js               # Color tokens, strategy definitions, asset colors
│   └── bloomberg.js           # Re-export alias for backward compatibility
├── hooks/
│   └── usePortfolioEngine.js  # Core optimization engine state management
├── lib/
│   ├── optimization.js        # Frank-Wolfe, Min Var, Risk Parity solvers
│   ├── blackLitterman.js      # He-Litterman BL model (1999)
│   ├── shrinkage.js           # OAS Ledoit-Wolf covariance estimator
│   ├── backtest.js            # Walk-forward backtesting engine
│   ├── analytics.js           # VaR, CVaR, Sortino, Calmar, Cornish-Fisher
│   ├── factors.js             # Beta, Alpha, Kelly, Omega, stress scenarios
│   ├── dataFetch.js           # Yahoo Finance data fetching + GBM fallback
│   ├── math.js                # Matrix operations, Cholesky, projections
│   └── db.js                  # IndexedDB CRUD operations
└── views/
    ├── Overview.jsx            # F2 — equity curves, metrics, distribution
    ├── tabs.jsx                # F3–F6, F10 — frontier, allocation, risk, backtest, compare
    ├── FactorView.jsx          # F8 — factor analysis
    ├── StressView.jsx          # F9 — stress testing
    ├── SIPView.jsx             # F11 — SIP calculator
    └── SavedResultsView.jsx    # F12 — IndexedDB results browser
```

---

## How to Run Locally

```bash
# Clone the repository
git clone https://github.com/vishwajit0345/QuantTerminal.git

# Navigate into the project
cd QuantTerminal

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
http://localhost:5173
```

---

## How to Use

1. **Add Stocks** — Type any ticker (AAPL, RELIANCE.NS, etc.) in the sidebar search box and press Enter
2. **Set Date Range** — Choose start and end dates (default: 5 years)
3. **Run Optimizer** — Click ⚡ RUN OPTIMIZER or press F12
4. **Explore Results** — Navigate tabs using F2–F12 or click tab labels
5. **Save Results** — Click 💾 SAVE RESULT to persist to IndexedDB
6. **View Saved** — Press F12 to open Saved Results tab

---

## Key Design Decisions

**Why Frank-Wolfe for Max Sharpe?**  
The textbook formula w* = Σ⁻¹(μ−rf) is only correct without constraints. Under long-only constraints the problem is non-trivial. Frank-Wolfe handles the simplex constraint naturally without requiring projection steps.

**Why OAS over standard Ledoit-Wolf?**  
Standard Ledoit-Wolf (2004) uses an asymptotic shrinkage intensity that can be suboptimal for small samples. OAS (Chen et al. 2010) solves for the intensity that minimizes expected MSE under the Oracle — giving better conditioning especially for portfolios with fewer observations than assets.

**Why walk-forward over in-sample backtest?**  
In-sample backtests overfit to historical data and produce inflated performance metrics. Walk-forward strictly uses only past data at each rebalancing point, giving a realistic estimate of out-of-sample performance.

**Why IndexedDB over localStorage?**  
localStorage has a 5MB limit and only stores strings. IndexedDB supports structured data, async operations, and 250MB+ storage — necessary for storing multiple optimization results with equity curves.

---

## Known Limitations

- Yahoo Finance CORS restriction on deployed environments — falls back to GBM simulation
- All computation runs client-side (browser) — heavy portfolios may slow on weak devices
- No tax-aware optimization (pre-tax returns only)
- No integer lot rounding for Indian markets
- No market impact model for large position sizes
- Stress shocks are estimated from historical ranges, not exact tick data

---

## About

Built by **Vishwajit** — Pre-final year BTech CSE student at DSATM Bengaluru (2027).

Interested in quantitative finance, portfolio optimization, and fintech engineering.

📧 Connect on [LinkedIn](https://linkedin.com/in/vishwajit)  
💻 More projects on [GitHub](https://github.com/vishwajit0345)

---

## References

- He, G. & Litterman, R. (1999). *The Intuition Behind Black-Litterman Model Portfolios*. Goldman Sachs
- Chen, Y., Wiesel, A., Eldar, Y. & Hero, A. (2010). *Shrinkage Algorithms for MMSE Covariance Estimation*. IEEE
- Frank, M. & Wolfe, P. (1956). *An Algorithm for Quadratic Programming*. Naval Research Logistics
- Cornish, E.A. & Fisher, R.A. (1937). *Moments and Cumulants in the Specification of Distributions*. ISI
- Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices*. Journal of Multivariate Analysis