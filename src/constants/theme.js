/*
  theme.js — Quant Terminal design system
  Every color, spacing, font token in one place.
  
  Inspired by the actual Bloomberg Terminal aesthetic:
  pure black, orange primaries, terminal monospace, dense data.
*/

// ── Core palette ────────────────────────────────────────────────
export const B = {
  // backgrounds
  void:    '#000000',   // true black — page background
  surface: '#0a0a0a',   // slightly off-black panels
  panel:   '#0f0f0f',   // card background
  overlay: '#141414',   // elevated elements
  border:  '#1e1e1e',   // subtle borders
  border2: '#2a2a2a',   // stronger borders
  divider: '#333333',   // dividers

  // Bloomberg signature orange family
  orange:  '#ff6600',   // primary — Bloomberg orange
  orange2: '#ff8c00',   // lighter orange
  orangeDim:'#cc5200',  // dimmed orange
  orangeBg: '#1a0a00',  // orange tint background

  // terminal green (positive / active)
  green:   '#00e676',   // bright positive green
  greenDim:'#00c853',   // slightly dimmer
  greenBg: '#001a0a',   // green tint bg

  // red (negative / danger)
  red:     '#ff1744',   // bright negative red
  redDim:  '#d50000',
  redBg:   '#1a0005',

  // yellow / amber (warnings / neutral)
  yellow:  '#ffea00',   // bright yellow alerts
  amber:   '#ffab00',   // amber warnings
  amberBg: '#1a1200',

  // cyan (info / data highlight)
  cyan:    '#00e5ff',
  cyanDim: '#00b0cc',
  cyanBg:  '#001a1f',

  // text scale
  text:    '#f0f0f0',   // primary text
  text2:   '#b0b0b0',   // secondary text
  text3:   '#666666',   // tertiary / muted
  text4:   '#3a3a3a',   // very muted labels

  // specials
  white:   '#ffffff',
  headerBg:'#ff6600',   // Bloomberg header bar
  headerTx:'#000000',   // text on orange header
}

// ── Strategy color map ───────────────────────────────────────────
export const STRAT = [
  { k: 'maxSharpe',   label: 'MAX SHARPE',        col: '#ff6600',   short: 'MSR' },
  { k: 'minVar',      label: 'MIN VARIANCE',       col: '#00e676',   short: 'MVO' },
  { k: 'riskParity',  label: 'RISK PARITY',        col: '#ffab00',   short: 'ERC' },
  { k: 'blModel',     label: 'BLACK-LITTERMAN',    col: '#00e5ff',   short: 'BLK' },
  { k: 'equalWeight', label: 'EQUAL WEIGHT',       col: '#666666',   short: 'EQW' },
]

// ── Asset color rotation ─────────────────────────────────────────
export const ASSET_COLS = [
  '#ff6600','#00e676','#ffab00','#00e5ff','#ff1744',
  '#7c4dff','#f06292','#26c6da','#d4e157','#ff7043',
  '#66bb6a','#42a5f5','#ab47bc','#ec407a','#26a69a',
]

// ── Preset sectors ───────────────────────────────────────────────
export const SECTORS = {
  'US TECH':     ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','ORCL','INTC'],
  'US FINANCE':  ['JPM','GS','BAC','MS','V','MA','BRK-B','C','WFC','AXP'],
  'US HEALTH':   ['JNJ','UNH','PFE','ABBV','MRK','LLY','CVS','MDT','BMY','AMGN'],
  'US ENERGY':   ['XOM','CVX','COP','SLB','EOG','MPC','VLO','PSX','OXY','DVN'],
  'INDIA NSE':   ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS','JSWSTEEL.NS','TATAMOTORS.NS','WIPRO.NS','ADANIENT.NS','BAJFINANCE.NS'],
  'EUROPE':      ['ASML','SAP','NVO','NESN.SW','ROG.SW','AZN','SHEL','LVMH.PA','SIE.DE','BMW.DE'],
  'ETF / INDEX': ['SPY','QQQ','IWM','GLD','TLT','VNQ','EFA','EEM','AGG','HYG'],
  'COMMODITIES': ['GLD','SLV','USO','BNO','PDBC','WOOD','CORN','WEAT'],
}

// ── GBM fallback parameters ──────────────────────────────────────
export const GBM = {
  AAPL:{mu:.22,sig:.24,s0:182}, MSFT:{mu:.20,sig:.21,s0:374},
  NVDA:{mu:.60,sig:.52,s0:550}, GOOGL:{mu:.17,sig:.23,s0:151},
  META:{mu:.30,sig:.34,s0:380}, AMZN:{mu:.19,sig:.25,s0:188},
  TSLA:{mu:.20,sig:.58,s0:248}, JPM:{mu:.14,sig:.19,s0:194},
  GS:{mu:.13,sig:.22,s0:446},   V:{mu:.13,sig:.17,s0:268},
  JNJ:{mu:.04,sig:.13,s0:157},  UNH:{mu:.16,sig:.17,s0:548},
  XOM:{mu:.13,sig:.21,s0:115},  CVX:{mu:.12,sig:.20,s0:156},
  PG:{mu:.06,sig:.12,s0:153},   KO:{mu:.05,sig:.12,s0:62},
  WMT:{mu:.10,sig:.13,s0:170},  MA:{mu:.14,sig:.18,s0:450},
  AMD:{mu:.25,sig:.45,s0:165},  INTC:{mu:-.05,sig:.26,s0:30},
  SPY:{mu:.12,sig:.15,s0:476},  QQQ:{mu:.16,sig:.18,s0:418},
  GLD:{mu:.07,sig:.13,s0:186},  TLT:{mu:-.02,sig:.12,s0:92},
}

// ── Constants ────────────────────────────────────────────────────
export const TD = 252   // trading days / year
export const EST_WIN = 252
export const REBAL = 21
export const N_MC = 5000
