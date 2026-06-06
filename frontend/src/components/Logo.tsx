import { cn } from "@/lib/utils"

/**
 * FormosaX 標誌 — 玉→金漸層方磚 + 上升走勢線(呼應台股 RWA)。
 * size 控制方磚邊長;withWord=true 時右側加字標。
 */
export function Logo({
  size = 44,
  withWord = false,
  className,
}: {
  size?: number
  withWord?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        aria-label="FormosaX"
        style={{ filter: "drop-shadow(0 8px 22px rgba(25,230,176,.45))" }}
      >
        <defs>
          <linearGradient id="fx-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#19e6b0" />
            <stop offset="1" stopColor="#f5b544" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#fx-g)" />
        {/* 上升走勢線 + 收盤點 */}
        <path
          d="M11 33 L20 24 L27 28 L37 15"
          fill="none"
          stroke="#07090e"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="37" cy="15" r="3.4" fill="#07090e" />
      </svg>
      {withWord && (
        <span
          className="font-display font-bold leading-none tracking-tight"
          style={{ fontSize: size * 0.62 }}
        >
          Formosa<span style={{ color: "var(--primary)" }}>X</span>
        </span>
      )}
    </div>
  )
}
