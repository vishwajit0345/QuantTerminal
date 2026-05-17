/*
  StressView.jsx — Historical Stress Test tab (NEW in v5)

  Shows estimated portfolio P&L under 6 historical crisis scenarios:
    - GFC 2008
    - COVID Crash 2020
    - Dot-com Bust 2000
    - Rate Hike Cycle 2022
    - India Market Crash 2008
    - Mild Correction (hypothetical)

  Uses asset-class shock mapping for each scenario.
*/

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts'
import { B } from '../constants/theme.js'
import { Panel, Metric, SectionHead, BBTooltip } from '../components/TerminalShell.jsx'
import { STRESS_SCENARIOS, runStressTest, classifyAsset } from '../lib/factors.js'

const fmt = (v, d = 2) => `${(v * 100).toFixed(d)}%`
const pct = v => v >= 0 ? `+${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(1)}%`

export function StressView({ engine, strat }) {
  const [activeScenario, setActiveScenario] = useState(STRESS_SCENARIOS[0])
  const [investmentAmount, setInvestmentAmount] = useState(500000)

  const weights = useMemo(() => {
    const opt = engine.inSample?.[strat]
    return opt?.w ?? engine.tickers.map(() => 1 / engine.tickers.length)
  }, [engine, strat])

  // Run all stress tests
  const allResults = useMemo(() =>
    STRESS_SCENARIOS.map(s => ({
      scenario: s,
      result:   runStressTest(weights, engine.tickers, s),
    })),
    [weights, engine]
  )

  // Detail for active scenario
  const activeResult = useMemo(() =>
    runStressTest(weights, engine.tickers, activeScenario),
    [weights, engine, activeScenario]
  )

  const summaryData = allResults.map(({ scenario, result }) => ({
    name: scenario.name.split(' ').slice(0, 2).join(' '),
    shock: result.totalShock,
    fill: result.totalShock < 0 ? B.red : B.green,
    color: scenario.color,
  }))

  const breakdownData = Object.entries(activeResult.breakdown)
    .sort((a, b) => a[1].contribution - b[1].contribution)
    .map(([ticker, d]) => ({
      ticker,
      contribution: d.contribution,
      weight: d.weight,
      shock: d.shock,
      class: d.assetClass,
    }))

  const rupeeImpact = investmentAmount * activeResult.totalShock

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>

      {/* Left: Summary across all scenarios */}
      <div>
        <SectionHead label="Portfolio P&L Across Crisis Scenarios" right="IN-SAMPLE WEIGHTS" />

        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={summaryData} margin={{ top: 4, right: 8, bottom: 20, left: 24 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: B.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }} angle={-20} textAnchor="end" />
            <YAxis tick={{ fill: B.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
            <Tooltip content={<BBTooltip fmt={v => pct(v)} />} />
            <ReferenceLine y={0} stroke={B.border2} />
            <Bar dataKey="shock" radius={[2, 2, 0, 0]} name="Portfolio Shock">
              {summaryData.map((d, i) => <Cell key={i} fill={d.shock < 0 ? B.red : B.green} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table */}
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>SCENARIO</th>
                <th>PERIOD</th>
                <th style={{ textAlign: 'right' }}>PORT SHOCK</th>
                <th style={{ textAlign: 'right' }}>₹/$ IMPACT (5L)</th>
              </tr>
            </thead>
            <tbody>
              {allResults.map(({ scenario, result }) => (
                <tr
                  key={scenario.id}
                  className="hrow"
                  onClick={() => setActiveScenario(scenario)}
                  style={{ background: activeScenario.id === scenario.id ? '#1a0a00' : undefined }}
                >
                  <td style={{ color: scenario.color, fontWeight: 600, fontSize: 10 }}>{scenario.name}</td>
                  <td style={{ color: B.text3, fontSize: 9 }}>{scenario.date}</td>
                  <td style={{
                    textAlign: 'right', fontWeight: 700,
                    color: result.totalShock < 0 ? B.red : B.green
                  }}>
                    {pct(result.totalShock)}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    color: result.totalShock < 0 ? B.red : B.green,
                    fontSize: 10,
                  }}>
                    {result.totalShock < 0 ? '-' : '+'}₹{Math.abs(500000 * result.totalShock).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Investment amount input */}
        <div style={{ marginTop: 10 }}>
          <SectionHead label="Custom Investment Amount" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: B.text3 }}>₹ / $</span>
            <input
              type="number"
              className="bb-input"
              value={investmentAmount}
              onChange={e => setInvestmentAmount(+e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      {/* Right: Detailed breakdown of active scenario */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            background: activeScenario.color, color: '#000',
            fontSize: 10, fontWeight: 700, padding: '2px 8px',
          }}>
            {activeScenario.name}
          </span>
          <span style={{ fontSize: 9, color: B.text3 }}>{activeScenario.date}</span>
        </div>
        <p style={{ fontSize: 9.5, color: B.text2, marginBottom: 10, lineHeight: 1.6 }}>
          {activeScenario.description}
        </p>

        {/* Impact metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
          <Metric
            label="Portfolio Shock"
            value={pct(activeResult.totalShock)}
            color={activeResult.totalShock < 0 ? B.red : B.green}
            accent
          />
          <Metric
            label="Monetary Impact"
            value={`${activeResult.totalShock < 0 ? '-' : '+'}₹${Math.abs(rupeeImpact).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            color={activeResult.totalShock < 0 ? B.red : B.green}
            sub={`on ₹${investmentAmount.toLocaleString('en-IN')}`}
          />
          <Metric
            label="Post-Crash Value"
            value={`₹${((1 + activeResult.totalShock) * investmentAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            color={B.amber}
            sub="estimated"
          />
        </div>

        {/* Per-asset breakdown */}
        <SectionHead label="Per-Asset Contribution to Shock" />
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={breakdownData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 60 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false} />
            <XAxis type="number" tick={{ fill: B.text3, fontSize: 8 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: B.text3, fontSize: 9, fontFamily: 'IBM Plex Mono' }} width={55} />
            <Tooltip content={<BBTooltip fmt={v => pct(v)} />} />
            <ReferenceLine x={0} stroke={B.border2} />
            <Bar dataKey="contribution" name="Contribution" radius={[0, 2, 2, 0]}>
              {breakdownData.map((d, i) => <Cell key={i} fill={d.contribution < 0 ? B.red : B.green} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Detail table */}
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="bb-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>TICKER</th>
                <th>ASSET CLASS</th>
                <th style={{ textAlign: 'right' }}>WEIGHT</th>
                <th style={{ textAlign: 'right' }}>SCENARIO SHOCK</th>
                <th style={{ textAlign: 'right' }}>CONTRIBUTION</th>
              </tr>
            </thead>
            <tbody>
              {breakdownData.map((d, i) => (
                <tr key={i}>
                  <td style={{ color: B.orange, fontWeight: 600 }}>{d.ticker}</td>
                  <td style={{ color: B.text3, fontSize: 9, textTransform: 'uppercase' }}>{d.class}</td>
                  <td style={{ textAlign: 'right' }}>{(d.weight * 100).toFixed(1)}%</td>
                  <td style={{ textAlign: 'right', color: d.shock < 0 ? B.red : B.green }}>{pct(d.shock)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: d.contribution < 0 ? B.red : B.green }}>
                    {pct(d.contribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 8, fontSize: 9, color: B.text3, lineHeight: 1.7, borderTop: `1px solid ${B.border}`, paddingTop: 8 }}>
          <span style={{ color: B.amber }}>⚠ DISCLAIMER:</span> Stress test estimates are based on historical asset-class factor shocks.
          Actual portfolio behaviour may differ significantly due to correlation breakdown, liquidity crises, and idiosyncratic risk.
          This is for educational and risk-awareness purposes only.
        </div>
      </div>
    </div>
  )
}
