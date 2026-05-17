# QuantPortPro — Quant Terminal Portfolio Optimizer

A bloomberg Terminal-grade portfolio optimization system built as a final-year project. Fetches real stock data from Yahoo Finance and runs institutional-quality quant models.

## What's inside it

- **Bloomberg Terminal UI** — Pure black + orange #ff6600 aesthetic, IBM Plex Mono font, scan-line overlay, live market clocks (NY/LON/HKG/MUM), ticker tape, F-key navigation bar
- **Factor Analysis tab** — Beta, Jensen's Alpha, Treynor Ratio, Information Ratio, Tracking Error, Up/Down Capture, Rolling Beta, Rolling Correlation, Kelly Criterion, Omega Ratio, Gain-to-Pain, Regime detection
- **Stress Testing tab** — 6 historical scenarios: GFC 2008, COVID 2020, Dot-com 2000, Rate Hike 2022, India Crash 2008, Mild Correction. Per-asset breakdown, monetary impact calculator
- **Cornish-Fisher CVaR** — Fat-tail adjusted VaR using skewness and excess kurtosis correction
- **Keyboard shortcuts** — F2–F10 switch tabs, F12 runs optimization

## Running it

**Windows:** Double-click `run.bat`

**Mac/Linux:**
```bash
bash run.sh
```

First run installs Node.js dependencies (~30 seconds). Then opens at `http://localhost:5173`.

## Architecture

```
src/
├── constants/bloomberg.js   ← Bloomberg design system (all colors, tokens, constants)
├── lib/
│   ├── math.js              ← Linear algebra from scratch (sampCov, matInv, projSimplex)
│   ├── shrinkage.js         ← OAS Ledoit-Wolf (Chen et al. 2010)
│   ├── blackLitterman.js    ← Full He-Litterman posterior (1999)
│   ├── optimization.js      ← Frank-Wolfe Max Sharpe, Min Var, ERC Risk Parity
│   ├── analytics.js         ← VaR, CVaR, Sortino, Calmar, MDD, rolling metrics
│   ├── backtest.js          ← Walk-forward backtest (zero look-ahead)
│   ├── dataFetch.js         ← Yahoo Finance + GBM fallback
│   └── factors.js           ← NEW: Beta, Alpha, IR, Kelly, Stress Tests, Regimes
├── components/
│   └── BloombergShell.jsx   ← NEW: Header, TickerTape, FunctionKeyBar, Panel, Metric
├── hooks/
│   └── usePortfolioEngine.js
├── views/
│   ├── FactorView.jsx       ← NEW: Factor analysis + regime tab
│   └── StressView.jsx       ← NEW: Historical stress testing tab
└── App.jsx                  ← Main Bloomberg Terminal layout
```

## Math implemented (all from scratch)

| Module | Algorithm | Reference |
|---|---|---|
| `shrinkage.js` | OAS Ledoit-Wolf: ρ = [(1−2/n)tr(S²)+tr(S)²] / [(T+1−2/n)(tr(S²)−tr(S)²/n)] | Chen et al. 2010 |
| `blackLitterman.js` | Full 9-step BL posterior: M⁻¹[(τΣ)⁻¹Π + P^TΩ⁻¹Q] | He & Litterman 1999 |
| `optimization.js` | Frank-Wolfe constrained Max Sharpe on probability simplex, O(1/t) | Duchi et al. 2008 |
| `optimization.js` | ERC Risk Parity: successive approximation of wᵢ·(Σw)ᵢ = constant | Maillard et al. 2010 |
| `backtest.js` | Walk-forward: EST_WIN=252d, REBAL=21d, zero look-ahead guaranteed | Industry standard |
| `factors.js` | Cornish-Fisher VaR: z_CF = z_N + (z²−1)/6·S + (z³−3z)/24·K − ... | Cornish-Fisher 1937 |
| `factors.js` | Kelly Criterion: f* = μ_ex / σ² | Kelly 1956 |
| `factors.js` | Omega Ratio: Σ(gains above θ) / Σ(losses below θ) | Keating & Shadwick 2002 |

## Known limitations

- Matrix inversion uses Gaussian elimination (Cholesky would be faster for SPD matrices — TODO)
- Yahoo Finance via CORS proxy (corsproxy.io) — production would use own backend proxy
- Frontier curve is approximate — shifts μ rather than solving exact QP per target
- No tax-aware optimization (STCG/LTCG matters for Indian portfolios)
- No integer lot-size rounding for actual share counts
- Portfolio state is in-memory — reloading resets everything

## Ticker format reference

| Exchange | Format | Example |
|---|---|---|
| US stocks | Ticker | `AAPL`, `MSFT`, `JPM` |
| NSE India | Add `.NS` | `RELIANCE.NS`, `TCS.NS`, `JSWSTEEL.NS` |
| BSE India | Add `.BO` | `RELIANCE.BO` |
| London LSE | Add `.L` | `AZN.L`, `SHEL.L` |
| Germany | Add `.DE` | `SIE.DE`, `BMW.DE` |
| Switzerland | Add `.SW` | `NESN.SW` |
| ETFs | Ticker | `SPY`, `QQQ`, `GLD`, `TLT` |
| Crypto | Add `-USD` | `BTC-USD`, `ETH-USD` |
