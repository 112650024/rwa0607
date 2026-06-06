import { type Stock, logoUrl } from "@/lib/catalog"

export function StockLogo({ stock, size = 40 }: { stock: Stock; size?: number }) {
  const url = logoUrl(stock)
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
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full bg-white object-contain p-1"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </div>
  )
}
