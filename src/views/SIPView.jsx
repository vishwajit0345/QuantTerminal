/*
  SIPView.jsx — SIP Calculator

  Systematic Investment Plan calculator with:
    - Regular SIP + Step-Up SIP (annual increment)
    - Inflation-adjusted real corpus
    - Lump Sum vs SIP comparison
    - Year-by-year wealth breakdown
    - Accurate month-by-month compounding
    - Quant Terminal aesthetic throughout

  Math:
    Regular SIP:  FV = Σ P × (1+r)^(n-i)   for i = 1..n
    Step-Up SIP:  P_i = P₀ × (1+s)^⌊(i-1)/12⌋
    Lump Sum:     FV = L × (1+R)^Y
    Real corpus:  FV_real = FV / (1+inflation)^Y
    XIRR:         Newton-Raphson on NPV equation
*/

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell, Legend,
} from 'recharts'
import { B } from '../constants/theme.js'

// ── Helpers ──────────────────────────────────────────────────────
const cr  = (v) => `₹${v >= 1e7 ? (v/1e7).toFixed(2)+'Cr' : v >= 1e5 ? (v/1e5).toFixed(2)+'L' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : v.toFixed(0)}`
const crFull = (v) => '₹' + Math.round(v).toLocaleString('en-IN')
const pct  = (v, d=2) => `${v.toFixed(d)}%`

function SectionHead({ label, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6,
      paddingBottom:4, borderBottom:`1px solid ${B.border}` }}>
      <span style={{ fontSize:8.5, color:B.orange, fontWeight:700,
        letterSpacing:'.1em', textTransform:'uppercase' }}>{label}</span>
      {right && <span style={{ fontSize:8, color:B.text3, marginLeft:'auto' }}>{right}</span>}
    </div>
  )
}

function Metric({ label, value, color=B.text, sub, accent, large }) {
  return (
    <div style={{ background: accent?`${color}12`:B.surface,
      border:`1px solid ${accent?color:B.border}`, padding:'7px 10px' }}>
      <div style={{ fontSize:8, color:B.text3, letterSpacing:'.08em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize: large?20:15, fontWeight:700, color,
        fontFamily:'IBM Plex Mono,monospace', letterSpacing:'-.01em' }}>{value}</div>
      {sub && <div style={{ fontSize:8, color:B.text3, marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function BBTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#111', border:`1px solid ${B.border2}`,
      padding:'6px 10px', fontSize:9, fontFamily:'IBM Plex Mono,monospace' }}>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||B.text, marginBottom:1 }}>
          {p.name}: {typeof p.value === 'number' ? crFull(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Core SIP Engine ───────────────────────────────────────────────

/*
  computeSIP — accurate month-by-month compounding
  
  Assumptions:
  - SIP invested at START of each month (annuity due)
  - Step-up applied at start of each new year
  - All returns are pre-tax (gross)
*/
function computeSIP({ monthly, annualReturn, years, stepUp, inflation, lumpSum }) {
  const r   = annualReturn / 100 / 12   // monthly rate
  const inf = inflation / 100 / 12      // monthly inflation
  const n   = years * 12                // total months
  const s   = stepUp / 100             // annual step-up rate

  let corpus = 0
  let totalInvested = 0
  const yearlyData = []

  // Month-by-month calculation
  // Each SIP instalment P_i at month i grows for (n - i) more months
  // P_i = monthly * (1+s)^floor((i-1)/12)   [step-up every 12 months]
  for (let i = 1; i <= n; i++) {
    const yearIndex = Math.floor((i - 1) / 12)
    const P = monthly * Math.pow(1 + s, yearIndex)
    const growthMonths = n - i                    // months of growth after investment
    corpus += P * Math.pow(1 + r, growthMonths)
    totalInvested += P
  }

  // Lump sum FV
  const lumpFV = lumpSum * Math.pow(1 + annualReturn/100, years)

  // Real (inflation-adjusted) corpus
  const realCorpus = corpus / Math.pow(1 + inflation/100, years)
  const realLumpFV = lumpFV / Math.pow(1 + inflation/100, years)

  // XIRR approximation via Newton-Raphson
  // NPV(x) = -Σ P_i/(1+x)^(i/12) + corpus/(1+x)^years = 0
  const xirr = computeXIRR(monthly, annualReturn, years, stepUp)

  // Year-by-year breakdown for charts
  let runningCorpus = 0
  let runningInvested = 0
  for (let y = 1; y <= years; y++) {
    const monthStart = (y - 1) * 12 + 1
    const monthEnd   = y * 12

    // Corpus at end of year y (recalculate for all months up to y*12)
    let corpusAtY = 0, investedAtY = 0
    const ny = y * 12
    for (let i = 1; i <= ny; i++) {
      const yi = Math.floor((i - 1) / 12)
      const P  = monthly * Math.pow(1 + s, yi)
      corpusAtY  += P * Math.pow(1 + r, ny - i)
      investedAtY += P
    }

    yearlyData.push({
      year:     `Y${y}`,
      invested: Math.round(investedAtY),
      returns:  Math.round(corpusAtY - investedAtY),
      corpus:   Math.round(corpusAtY),
      sipAmt:   Math.round(monthly * Math.pow(1 + s, y - 1)),
    })
  }

  return {
    corpus, totalInvested,
    totalReturns: corpus - totalInvested,
    wealthRatio:  corpus / totalInvested,
    realCorpus,
    lumpFV, realLumpFV,
    xirr,
    yearlyData,
  }
}

/*
  XIRR via Newton-Raphson
  Finds the annual rate x such that:
  Σ -P_i / (1+x)^(i/12) + FV / (1+x)^years = 0
*/
function computeXIRR(monthly, guessReturn, years, stepUp) {
  const n = years * 12
  const s = stepUp / 100

  // Build cashflows: negative (outflows) each month, positive (inflow) at end
  const cashflows = []
  let totalInv = 0
  for (let i = 0; i < n; i++) {
    const yi = Math.floor(i / 12)
    const P  = monthly * Math.pow(1 + s, yi)
    cashflows.push({ t: i / 12, cf: -P })
    totalInv += P
  }
  // Final corpus at end
  const r = guessReturn / 100 / 12
  let fv = 0
  for (let i = 1; i <= n; i++) {
    const yi = Math.floor((i-1)/12)
    const P  = monthly * Math.pow(1 + s, yi)
    fv += P * Math.pow(1 + r, n - i)
  }
  cashflows.push({ t: years, cf: fv })

  // Newton-Raphson
  let x = guessReturn / 100
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dnpv = 0
    for (const { t, cf } of cashflows) {
      const disc = Math.pow(1 + x, t)
      npv  += cf / disc
      dnpv += -t * cf / (disc * (1 + x))
    }
    const dx = npv / dnpv
    x -= dx
    if (Math.abs(dx) < 1e-8) break
  }
  return x * 100
}

// ── Slider + Manual Text Input ────────────────────────────────────
/*
  Combined input: slider for quick drag + text box for precise manual entry.
  rawText tracks what the user is typing so partial values (e.g. "1") don't
  get clamped immediately. On blur the value is clamped to [min, max].
*/
function SliderInput({ label, value, setValue, min, max, step, format, color=B.orange, prefix='', suffix='' }) {
  const [rawText, setRawText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Keep rawText in sync when value changes from slider
  const handleSlider = (e) => {
    const v = +e.target.value
    setValue(v)
    setRawText(String(v))
  }

  // While typing — accept anything, don't clamp yet
  const handleTextChange = (e) => {
    setRawText(e.target.value)
  }

  // On blur — parse, clamp, commit
  const handleBlur = () => {
    setFocused(false)
    const parsed = parseFloat(rawText.replace(/[₹,%\s]/g, ''))
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed))
      // Round to nearest step
      const stepped = Math.round(clamped / step) * step
      setValue(stepped)
      setRawText(String(stepped))
    } else {
      setRawText(String(value)) // revert on invalid
    }
  }

  const handleFocus = () => {
    setFocused(true)
    setRawText(String(value))
  }

  // Keep rawText updated when value changes externally (e.g. slider)
  // but not while the user is actively typing
  const displayText = focused ? rawText : String(value)

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
        <span style={{ fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace', letterSpacing:'.06em' }}>{label}</span>
        {/* Manual text input */}
        <div style={{ display:'flex', alignItems:'center', gap:2,
          background: B.panel, border:`1px solid ${focused ? color : B.border2}`,
          padding:'1px 5px', transition:'border-color .15s' }}>
          {prefix && <span style={{ fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace' }}>{prefix}</span>}
          <input
            type="text"
            value={displayText}
            onChange={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            style={{
              width: 64, background:'transparent', border:'none', outline:'none',
              fontSize:10, color, fontWeight:700, fontFamily:'IBM Plex Mono,monospace',
              textAlign:'right', padding:0,
            }}
          />
          {suffix && <span style={{ fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace' }}>{suffix}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={handleSlider}
        style={{ width:'100%', accentColor:color, cursor:'pointer' }}
      />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:7.5, color:B.text3, marginTop:1 }}>
        <span>{format(min)}</span>
        <span style={{ fontSize:7.5, color:B.text3 }}>type or drag</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

// ── Main SIP View ─────────────────────────────────────────────────
export function SIPView() {
  // Inputs
  const [monthly,    setMonthly]    = useState(10000)
  const [annReturn,  setAnnReturn]  = useState(12)
  const [years,      setYears]      = useState(20)
  const [stepUp,     setStepUp]     = useState(10)
  const [inflation,  setInflation]  = useState(6)
  const [lumpSum,    setLumpSum]    = useState(100000)
  const [mode,       setMode]       = useState('stepup') // 'regular' | 'stepup' | 'compare'

  // Compute
  const regular = useMemo(() =>
    computeSIP({ monthly, annualReturn:annReturn, years, stepUp:0, inflation, lumpSum }),
    [monthly, annReturn, years, inflation, lumpSum]
  )

  const stepup = useMemo(() =>
    computeSIP({ monthly, annualReturn:annReturn, years, stepUp, inflation, lumpSum }),
    [monthly, annReturn, years, stepUp, inflation, lumpSum]
  )

  const active = mode === 'regular' ? regular : stepup

  // Chart data — wealth growth
  const growthData = active.yearlyData.map(d => ({
    year:     d.year,
    Invested: d.invested,
    Returns:  d.returns,
    Corpus:   d.corpus,
  }))

  // Comparison data
  const compareData = active.yearlyData.map((d, i) => ({
    year:     d.year,
    'Step-Up SIP': stepup.yearlyData[i].corpus,
    'Regular SIP': regular.yearlyData[i].corpus,
    'Lump Sum':    Math.round(lumpSum * Math.pow(1 + annReturn/100, i+1)),
  }))

  // Monthly SIP progression (step-up)
  const sipProgressData = Array.from({ length: years }, (_, y) => ({
    year:   `Y${y+1}`,
    sipAmt: Math.round(monthly * Math.pow(1 + stepUp/100, y)),
  }))

  const fmtCr = v => cr(v)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:10, height:'100%' }}>

      {/* ── Left Panel: Inputs ────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:8,
        background:B.surface, border:`1px solid ${B.border}`, padding:'10px 12px', overflowY:'auto' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, fontWeight:700, color:B.orange, letterSpacing:'.1em' }}>SIP CALCULATOR</span>
        </div>

        {/* Mode selector */}
        <div style={{ display:'flex', gap:3 }}>
          {[['regular','REGULAR'],['stepup','STEP-UP'],['compare','COMPARE']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              flex:1, padding:'4px 0', fontSize:8, fontFamily:'IBM Plex Mono,monospace',
              background: mode===k ? B.orangeBg : B.panel,
              border: `1px solid ${mode===k ? B.orange : B.border}`,
              color: mode===k ? B.orange : B.text3, cursor:'pointer',
            }}>{l}</button>
          ))}
        </div>

        <SliderInput label="MONTHLY SIP (₹)"
          value={monthly} setValue={setMonthly} min={500} max={1000000} step={500}
          format={v => '₹'+v.toLocaleString('en-IN')} color={B.orange}
          prefix="₹" />

        <SliderInput label="EXPECTED ANNUAL RETURN"
          value={annReturn} setValue={setAnnReturn} min={4} max={30} step={0.5}
          format={v => `${v}%`} color={B.green}
          suffix="%" />

        <SliderInput label="INVESTMENT DURATION"
          value={years} setValue={setYears} min={1} max={40} step={1}
          format={v => `${v} Yrs`} color={B.cyan}
          suffix=" Yrs" />

        {mode !== 'regular' && (
          <SliderInput label="ANNUAL STEP-UP %"
            value={stepUp} setValue={setStepUp} min={0} max={30} step={1}
            format={v => `${v}%`} color={B.amber}
            suffix="%" />
        )}

        <SliderInput label="INFLATION RATE"
          value={inflation} setValue={setInflation} min={2} max={12} step={0.5}
          format={v => `${v}%`} color={B.red}
          suffix="%" />

        {mode === 'compare' && (
          <SliderInput label="LUMP SUM AMOUNT (₹)"
            value={lumpSum} setValue={setLumpSum} min={10000} max={5000000} step={10000}
            format={v => '₹'+v.toLocaleString('en-IN')} color={B.border2}
            prefix="₹" />
        )}

        {/* Key output summary in sidebar */}
        <div style={{ borderTop:`1px solid ${B.border}`, paddingTop:8 }}>
          <div style={{ fontSize:8.5, color:B.text3, marginBottom:6, letterSpacing:'.08em' }}>QUICK SUMMARY</div>
          {[
            { l:'Total Invested',   v: crFull(active.totalInvested),   c:B.text2 },
            { l:'Total Returns',    v: crFull(active.totalReturns),    c:B.green },
            { l:'Final Corpus',     v: crFull(active.corpus),          c:B.orange },
            { l:'Real Corpus',      v: crFull(active.realCorpus),      c:B.amber },
            { l:'Wealth Ratio',     v: `${active.wealthRatio.toFixed(2)}×`, c:B.cyan },
            { l:'XIRR',             v: `${active.xirr.toFixed(2)}%`,   c:B.green },
          ].map(m => (
            <div key={m.l} style={{ display:'flex', justifyContent:'space-between',
              padding:'3px 0', borderBottom:`1px solid ${B.border}20`, alignItems:'center' }}>
              <span style={{ fontSize:9, color:B.text3, fontFamily:'IBM Plex Mono,monospace' }}>{m.l}</span>
              <span style={{ fontSize:10, color:m.c, fontWeight:700, fontFamily:'IBM Plex Mono,monospace' }}>{m.v}</span>
            </div>
          ))}
        </div>

        {/* SIP formula note */}
        <div style={{ background:B.panel, border:`1px solid ${B.border}`,
          padding:'6px 8px', fontSize:8, color:B.text3, fontFamily:'IBM Plex Mono,monospace', lineHeight:1.8 }}>
          <div style={{ color:B.orange, marginBottom:2 }}>SIP FORMULA</div>
          <div>FV = Σ P_i × (1+r)^(n-i)</div>
          <div>P_i = P₀ × (1+s)^⌊(i-1)/12⌋</div>
          <div style={{ color:B.text3, marginTop:3 }}>r = monthly rate · s = step-up</div>
        </div>
      </div>

      {/* ── Right Panel: Charts + Metrics ────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>

        {/* Top metrics row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
          <Metric label="FINAL CORPUS"      value={cr(active.corpus)}         color={B.orange} accent large />
          <Metric label="TOTAL INVESTED"    value={cr(active.totalInvested)}  color={B.text2} />
          <Metric label="WEALTH GAIN"       value={cr(active.totalReturns)}   color={B.green} accent />
          <Metric label="WEALTH RATIO"      value={`${active.wealthRatio.toFixed(2)}×`} color={B.cyan} />
          <Metric label="REAL CORPUS"       value={cr(active.realCorpus)}     color={B.amber}
            sub={`After ${inflation}% inflation`} />
          <Metric label="XIRR"              value={`${active.xirr.toFixed(2)}%`} color={B.green} accent />
        </div>

        {/* Step-up info banner */}
        {mode === 'stepup' && (
          <div style={{ padding:'5px 10px', background:B.amberBg,
            border:`1px solid ${B.amber}20`, fontSize:9, color:B.amber,
            fontFamily:'IBM Plex Mono,monospace', display:'flex', gap:16 }}>
            <span>START SIP: ₹{monthly.toLocaleString('en-IN')}/mo</span>
            <span>→</span>
            <span>YEAR {Math.ceil(years/2)} SIP: ₹{Math.round(monthly*Math.pow(1+stepUp/100,Math.ceil(years/2)-1)).toLocaleString('en-IN')}/mo</span>
            <span>→</span>
            <span>FINAL SIP: ₹{Math.round(monthly*Math.pow(1+stepUp/100,years-1)).toLocaleString('en-IN')}/mo</span>
            <span style={{ marginLeft:'auto' }}>
              STEP-UP ADVANTAGE: +{cr(stepup.corpus - regular.corpus)} over Regular SIP
            </span>
          </div>
        )}

        {mode === 'compare' && (
          <div style={{ padding:'5px 10px', background:B.greenBg,
            border:`1px solid ${B.green}20`, fontSize:9, color:B.green,
            fontFamily:'IBM Plex Mono,monospace', display:'flex', gap:24 }}>
            <span>STEP-UP SIP: {crFull(stepup.corpus)}</span>
            <span>REGULAR SIP: {crFull(regular.corpus)}</span>
            <span>LUMP SUM ({crFull(lumpSum)}): {crFull(active.lumpFV)}</span>
          </div>
        )}

        {/* Main wealth growth chart */}
        <div>
          <SectionHead label={mode === 'compare' ? 'Strategy Comparison — Corpus Over Time' : 'Wealth Accumulation — Invested vs Returns'} />
          <ResponsiveContainer width="100%" height={200}>
            {mode === 'compare' ? (
              <LineChart data={compareData} margin={{ top:4, right:12, bottom:4, left:0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
                <XAxis dataKey="year" tick={{ fill:B.text3, fontSize:8 }} interval={Math.floor(years/8)} />
                <YAxis tick={{ fill:B.text3, fontSize:8 }} tickFormatter={fmtCr} />
                <Tooltip content={<BBTooltip />} />
                <Line type="monotone" dataKey="Step-Up SIP"  stroke={B.orange} dot={false} strokeWidth={2.5} />
                <Line type="monotone" dataKey="Regular SIP"  stroke={B.green}  dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="Lump Sum"     stroke={B.border2} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            ) : (
              <AreaChart data={growthData} margin={{ top:4, right:12, bottom:4, left:0 }}>
                <defs>
                  <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={B.border2} stopOpacity=".8" />
                    <stop offset="100%" stopColor={B.border2} stopOpacity=".1" />
                  </linearGradient>
                  <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={B.green} stopOpacity=".7" />
                    <stop offset="100%" stopColor={B.green} stopOpacity=".05" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
                <XAxis dataKey="year" tick={{ fill:B.text3, fontSize:8 }} interval={Math.floor(years/8)} />
                <YAxis tick={{ fill:B.text3, fontSize:8 }} tickFormatter={fmtCr} />
                <Tooltip content={<BBTooltip />} />
                <Area type="monotone" dataKey="Invested" stackId="1" stroke={B.border2}
                  fill="url(#invGrad)" strokeWidth={1.5} name="Invested" />
                <Area type="monotone" dataKey="Returns" stackId="1" stroke={B.green}
                  fill="url(#retGrad)" strokeWidth={1.5} name="Returns" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Bottom row: Year table + SIP progression */}
        <div style={{ display:'grid', gridTemplateColumns: mode==='stepup' ? '1fr 1fr' : '1fr', gap:8 }}>

          {/* Year-by-year table */}
          <div>
            <SectionHead label="Year-by-Year Breakdown" right={`${years} years · ${annReturn}% p.a.`} />
            <div style={{ overflowY:'auto', maxHeight:220 }}>
              <table style={{ width:'100%', borderCollapse:'collapse',
                fontSize:9, fontFamily:'IBM Plex Mono,monospace' }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${B.border}`, position:'sticky', top:0, background:B.surface }}>
                    {['YEAR','SIP/MO','INVESTED','RETURNS','CORPUS','RATIO'].map(h => (
                      <th key={h} style={{ padding:'3px 6px', color:B.text3,
                        textAlign:'right', fontWeight:400, letterSpacing:'.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.yearlyData.map((d, i) => {
                    const ratio = d.corpus / d.invested
                    return (
                      <tr key={i} style={{ background: i%2===0?'transparent':B.panel,
                        borderBottom:`1px solid ${B.border}15` }}>
                        <td style={{ padding:'3px 6px', color:B.orange, fontWeight:700 }}>{d.year}</td>
                        <td style={{ padding:'3px 6px', color:B.amber, textAlign:'right' }}>
                          ₹{d.sipAmt.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding:'3px 6px', color:B.text2, textAlign:'right' }}>{cr(d.invested)}</td>
                        <td style={{ padding:'3px 6px', color:B.green, textAlign:'right' }}>{cr(d.returns)}</td>
                        <td style={{ padding:'3px 6px', color:B.text, fontWeight:700, textAlign:'right' }}>{cr(d.corpus)}</td>
                        <td style={{ padding:'3px 6px', textAlign:'right',
                          color: ratio > 3 ? B.green : ratio > 1.5 ? B.amber : B.text3 }}>
                          {ratio.toFixed(2)}×
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step-up SIP progression chart */}
          {mode === 'stepup' && (
            <div>
              <SectionHead label={`SIP Amount Progression (${stepUp}% annual step-up)`} />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sipProgressData} margin={{ top:4, right:8, bottom:16, left:0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill:B.text3, fontSize:8 }} interval={Math.floor(years/8)} />
                  <YAxis tick={{ fill:B.text3, fontSize:8 }} tickFormatter={v => '₹'+Math.round(v/1000)+'K'} />
                  <Tooltip content={<BBTooltip />} />
                  <Bar dataKey="sipAmt" name="Monthly SIP" radius={[2,2,0,0]}>
                    {sipProgressData.map((_, i) => (
                      <Cell key={i} fill={B.amber}
                        fillOpacity={0.3 + 0.7 * (i / Math.max(sipProgressData.length-1, 1))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Inflation warning */}
        <div style={{ padding:'5px 10px', background:B.redBg, border:`1px solid ${B.red}20`,
          fontSize:8.5, color:B.red, fontFamily:'IBM Plex Mono,monospace',
          display:'flex', justifyContent:'space-between' }}>
          <span>⚠ INFLATION IMPACT ({inflation}% p.a.): {crFull(active.corpus)} nominal → {crFull(active.realCorpus)} real ({years}Y)</span>
          <span>PURCHASING POWER EROSION: {pct((1 - active.realCorpus/active.corpus)*100, 1)}</span>
        </div>

      </div>
    </div>
  )
}
