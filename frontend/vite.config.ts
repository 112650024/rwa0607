import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// 讓 /api/twse 與 /api/history 在本機 `npm run dev` 也能運作(平常它們是 Vercel serverless,dev 不會跑)。
// 直接重用 api/*.js 的 getQuotes()/getHistory(),本機/線上行為一致 → 走勢線不再是平的/合成的。
function twseDevApi(): Plugin {
  return {
    name: 'twse-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const send = (data: unknown) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }
        try {
          if (req.url.startsWith('/api/twse')) {
            // @ts-ignore - api/twse.js 是純 JS 模組,無 .d.ts 型別宣告
            const { getQuotes } = await import('./api/twse.js')
            return send(await getQuotes())
          }
          if (req.url.startsWith('/api/history')) {
            // @ts-ignore - api/history.js 是純 JS 模組,無 .d.ts 型別宣告
            const { getHistory } = await import('./api/history.js')
            return send(await getHistory())
          }
          if (req.url.startsWith('/api/valuation')) {
            if (req.method !== 'POST') {
              res.statusCode = 405
              return send({ comments: {} })
            }
            const chunks: Buffer[] = []
            req.on('data', (c: Buffer) => chunks.push(c))
            req.on('end', async () => {
              let stocks: unknown[] = []
              try {
                stocks = JSON.parse(Buffer.concat(chunks).toString() || '{}').stocks ?? []
              } catch {
                /* 空 body */
              }
              try {
                // @ts-ignore - api/valuation.js 是純 JS 模組,無 .d.ts 型別宣告
                const { getValuations } = await import('./api/valuation.js')
                send({ comments: await getValuations(stocks) })
              } catch {
                send({ comments: {} })
              }
            })
            return
          }
        } catch {
          res.statusCode = 200
          return res.end('{}')
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), twseDevApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
