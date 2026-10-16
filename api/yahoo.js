export default async function handler(req, res) {
  const { ticker, start, end, type } = req.query
  if (!ticker) return res.status(400).json({ error: 'ticker required' })

  const t = encodeURIComponent(ticker)
  const url = type === 'validate'
    ? `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=5d`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&period1=${start}&period2=${end}&includePrePost=false`

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/',
      },
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}