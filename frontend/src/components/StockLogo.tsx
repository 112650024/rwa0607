import { useState } from "react"
import { type Stock, logoCandidates } from "@/lib/catalog"

/**
 * 多來源 logo:依序嘗試 Clearbit → DuckDuckGo → 網站 favicon,
 * 全部失敗才退回「品牌色 + 中文簡稱」文字徽記(不再出現 Google 的地球預設圖)。
 */
export function StockLogo({ stock, size = 40 }: { stock: Stock; size?: number }) {
  const candidates = logoCandidates(stock)
  const [idx, setIdx] = useState(0)
  const src = candidates[idx]

  return (
    <div
      className="relative grid place-items-center rounded-xl overflow-hidden font-mono-num font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        background: `linear-gradient(135deg, ${stock.tint})`,
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      <span>{stock.name.slice(0, 2)}</span>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full bg-white object-contain p-1"
          onError={() => setIdx((i) => i + 1)} // 換下一個來源;全失敗則露出文字徽記
        />
      )}
    </div>
  )
}
