// Colour tokens — keeping everything in one place makes theming easier
// spent way too long picking these, do not change lightly
export const C = {
  bg:     '#03070e',
  panel:  '#060d1a',
  card:   '#08111f',
  border: '#0d1d35',
  border2:'#152a4a',
  cyan:   '#00c8f0',
  green:  '#00d98a',
  amber:  '#f5a623',
  red:    '#ef4060',
  purple: '#9d7de8',
  pink:   '#e87dd4',
  teal:   '#00c4a8',
  blue:   '#4488ff',
  text:   '#dce8f4',
  muted:  '#47607a',
  dim:    '#22374f',
}

export const ASSET_COLORS = [
  '#00c8f0','#00d98a','#f5a623','#9d7de8','#e87dd4',
  '#00c4a8','#4488ff','#ef4060','#38bdf8','#34d399',
  '#fbbf24','#a78bfa','#f472b6','#2dd4bf','#60a5fa',
]

export const STRAT_META = [
  { k: 'maxSharpe',   label: 'Max Sharpe',       col: '#00c8f0' },
  { k: 'minVar',      label: 'Min Variance',      col: '#00d98a' },
  { k: 'riskParity',  label: 'Risk Parity',       col: '#f5a623' },
  { k: 'blModel',     label: 'Black-Litterman',   col: '#9d7de8' },
  { k: 'equalWeight', label: 'Equal Weight',      col: '#47607a' },
]

// trading days per year — standard
export const TD = 252

// walk-forward params
export const EST_WIN = 252   // estimation window in days
export const REBAL   = 21    // rebalance frequency in days
export const N_MC    = 4000  // monte carlo portfolios

// preset sectors for quick-add
export const PRESET_SECTORS = {
  'US Tech':     ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','INTC','ORCL'],
  'US Finance':  ['JPM','GS','BAC','MS','V','MA','BRK-B','C','WFC','AXP'],
  'US Health':   ['JNJ','UNH','PFE','ABBV','MRK','LLY','CVS','MDT','BMY','AMGN'],
  'US Energy':   ['XOM','CVX','COP','SLB','EOG','PXD','MPC','VLO','PSX','OXY'],
  'US Consumer': ['PG','KO','PEP','WMT','HD','MCD','NKE','SBUX','COST','TGT'],
  'ETFs':        ['SPY','QQQ','IWM','GLD','TLT','VNQ','EFA','EEM','AGG','HYG'],
  'India NSE':   ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
                  'HINDUNILVR.NS','BAJFINANCE.NS','SBIN.NS','WIPRO.NS','ADANIENT.NS'],
  'Europe':      ['ASML','SAP','NVO','NESN.SW','ROG.SW','AZN','SHEL','TTE','LVMH.PA','SIE.DE'],
}

// GBM fallback params if yahoo is unavailable
// μ = annual drift, σ = annual vol, s0 = starting price
export const GBM_PARAMS = {
  AAPL:  { mu: 0.22, sig: 0.24, s0: 182 },
  MSFT:  { mu: 0.20, sig: 0.21, s0: 374 },
  NVDA:  { mu: 0.60, sig: 0.52, s0: 550 },
  GOOGL: { mu: 0.17, sig: 0.23, s0: 151 },
  META:  { mu: 0.30, sig: 0.34, s0: 380 },
  AMZN:  { mu: 0.19, sig: 0.25, s0: 188 },
  TSLA:  { mu: 0.20, sig: 0.58, s0: 248 },
  JPM:   { mu: 0.14, sig: 0.19, s0: 194 },
  GS:    { mu: 0.13, sig: 0.22, s0: 446 },
  V:     { mu: 0.13, sig: 0.17, s0: 268 },
  JNJ:   { mu: 0.04, sig: 0.13, s0: 157 },
  UNH:   { mu: 0.16, sig: 0.17, s0: 548 },
  XOM:   { mu: 0.13, sig: 0.21, s0: 115 },
  CVX:   { mu: 0.12, sig: 0.20, s0: 156 },
  PG:    { mu: 0.06, sig: 0.12, s0: 153 },
  KO:    { mu: 0.05, sig: 0.12, s0: 62  },
  WMT:   { mu: 0.10, sig: 0.13, s0: 170 },
  MA:    { mu: 0.14, sig: 0.18, s0: 450 },
  AMD:   { mu: 0.25, sig: 0.45, s0: 165 },
  INTC:  { mu: -0.05,sig: 0.26, s0: 30  },
  SPY:   { mu: 0.12, sig: 0.15, s0: 476 },
  QQQ:   { mu: 0.16, sig: 0.18, s0: 418 },
  GLD:   { mu: 0.07, sig: 0.13, s0: 186 },
  TLT:   { mu: -0.02,sig: 0.12, s0: 92  },
}
