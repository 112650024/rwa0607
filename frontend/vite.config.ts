import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// 讓 /api/twse 在本機 `npm run dev` 也能運作(平常它是 Vercel serverless,dev 不會跑)。
// 直接重用 api/twse.js 的 getQuotes(),本機/線上行為一致 → 走勢線不再是平的。
function twseDevApi(): Plugin {
  return {
    name: 'twse-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/twse')) return next()
        try {
          // @ts-ignore - api/twse.js 是純 JS 模組,無 .d.ts 型別宣告
          const { getQuotes } = await import('./api/twse.js')
          const data = await getQuotes()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        } catch {
          res.statusCode = 200
          res.end('{}')
        }
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
