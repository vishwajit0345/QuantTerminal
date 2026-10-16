import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://finance.yahoo.com/',
        },
        rewrite: (path) => {
          const u = new URL(path, 'http://x')
          const t = u.searchParams.get('ticker')
          if (u.searchParams.get('type') === 'validate')
            return `/v8/finance/chart/${t}?interval=1d&range=5d`
          return `/v8/finance/chart/${t}?interval=1d&period1=${u.searchParams.get('start')}&period2=${u.searchParams.get('end')}&includePrePost=false`
        },
      },
    },
  },
})