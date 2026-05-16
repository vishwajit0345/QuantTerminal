/*
  db.js — IndexedDB persistence layer for Quant Terminal

  Stores optimized portfolio results so they survive page refresh
  and browser restart. Results are kept until the user explicitly
  deletes them — no automatic expiry.

  Schema (object store: "results"):
    id         — auto-increment primary key
    savedAt    — ISO timestamp string
    label      — user-editable name (default: assets + date)
    tickers    — string[]
    assets     — {ticker, name}[]
    dateRange  — { start, end }
    params     — { rf, txBps, rho, yrs, canWF }
    strategies — per-strategy metrics + weights (all 5 strategies)
    equityCurves — downsampled walk-forward equity curves (100 pts)

  We intentionally DO NOT store:
    - rets matrix (huge — up to 15×1260 floats)
    - prices matrix (similar size)
    - mc array (5000 scatter points)
  Those can be recomputed by re-running the optimizer.
*/

const DB_NAME    = 'QuantPortPro'
const DB_VERSION = 1
const STORE      = 'results'

// ── Open / init ───────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = e => {
      const db    = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }

    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

// ── Serialize engine → storable record ───────────────────────────
/*
  Takes the full engine object and strips out the heavy arrays
  (rets, prices, mc) keeping only the computed results we need
  to display in the Saved Results tab.

  Equity curves are downsampled to 100 points for storage efficiency
  (~10KB per curve vs ~10MB for the full 1260-point series).
*/
export function serializeEngine(engine, label = '') {
  const { tickers, assets, inSample, wf, canWF, rho, yrs,
          startDate, endDate, rf, txBps, n } = engine

  // Downsample equity curve to 100 points
  const downsample = (arr, pts = 100) => {
    if (!arr || arr.length === 0) return []
    const sk = Math.max(1, Math.floor(arr.length / pts))
    return arr.filter((_, i) => i % sk === 0).map(v => +v.toFixed(4))
  }

  // Per-strategy serialization
  const strategies = {}
  const STRAT_KEYS = ['maxSharpe', 'minVar', 'riskParity', 'blModel', 'equalWeight']

  STRAT_KEYS.forEach(k => {
    const is = inSample[k]
    const wfk = wf[k]
    strategies[k] = {
      // In-sample
      weights:  is?.w   ? [...is.w]   : [],
      ret:      is?.ret  ?? 0,
      vol:      is?.vol  ?? 0,
      sharpe:   is?.sharpe ?? 0,
      mdd:      is?.mdd  ?? 0,
      // Walk-forward (if available)
      wf: wfk ? {
        cagr:    wfk.cagr    ?? 0,
        vol:     wfk.vol     ?? 0,
        sharpe:  wfk.sharpe  ?? 0,
        sortino: wfk.sortino ?? 0,
        mdd:     wfk.mdd     ?? 0,
        var95:   wfk.var95   ?? 0,
        cvar95:  wfk.cvar95  ?? 0,
        var99:   wfk.var99   ?? 0,
      } : null,
    }
  })

  // Equity curves (downsampled)
  const equityCurves = {}
  if (canWF) {
    STRAT_KEYS.forEach(k => {
      if (wf[k]?.cum) equityCurves[k] = downsample(wf[k].cum)
    })
  }

  const defaultLabel = label || `${tickers.join(', ')} · ${new Date().toLocaleDateString('en-IN')}`

  return {
    savedAt:   new Date().toISOString(),
    label:     defaultLabel,
    tickers:   [...tickers],
    assets:    assets.map(a => ({ ticker: a.ticker, name: a.name })),
    dateRange: { start: startDate, end: endDate },
    params:    { rf, txBps, rho: +rho.toFixed(4), yrs: +yrs.toFixed(2), canWF, n },
    strategies,
    equityCurves,
  }
}

// ── CRUD operations ───────────────────────────────────────────────

// Save a new result — returns the assigned id
export async function saveResult(engine, label = '') {
  const db     = await openDB()
  const record = serializeEngine(engine, label)
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req   = store.add(record)
    req.onsuccess = e => resolve(e.target.result)   // the auto-generated id
    req.onerror   = e => reject(e.target.error)
  })
}

// Get all saved results, newest first
export async function getAllResults() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req   = store.getAll()
    req.onsuccess = e => resolve([...e.target.result].reverse())
    req.onerror   = e => reject(e.target.error)
  })
}

// Update label of a saved result
export async function updateLabel(id, newLabel) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(id)
    getReq.onsuccess = e => {
      const record = e.target.result
      if (!record) { reject(new Error('Not found')); return }
      record.label = newLabel
      const putReq = store.put(record)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = e2 => reject(e2.target.error)
    }
    getReq.onerror = e => reject(e.target.error)
  })
}

// Delete a single result by id
export async function deleteResult(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req   = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

// Delete ALL saved results
export async function clearAllResults() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req   = store.clear()
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

// Get total count of saved results
export async function getResultCount() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req   = store.count()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}
