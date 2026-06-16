// 成本基礎追蹤(localStorage,以本機買賣紀錄估算未實現損益)。
// 鏈上沒有成本價 → 在「交易」頁買入時記成本、賣出時依平均成本扣除。
// 限制:只反映「在這台瀏覽器做的」買賣;換裝置/清快取會歸零(故標示為估算)。

export type CostPos = { shares: number; cost: number } // cost 為累計投入 TWD
type CostMap = Record<string, CostPos>

const key = (addr?: string | null) => `formosax:cost:${(addr || "anon").toLowerCase()}`

function load(addr?: string | null): CostMap {
  try {
    return JSON.parse(localStorage.getItem(key(addr)) || "{}") as CostMap
  } catch {
    return {}
  }
}
function save(addr: string | null | undefined, m: CostMap) {
  try {
    localStorage.setItem(key(addr), JSON.stringify(m))
  } catch {
    /* localStorage 不可用時略過 */
  }
}

/** 買入:累加股數與成本。 */
export function recordBuy(addr: string | null | undefined, code: string, shares: number, twdCost: number) {
  if (!(shares > 0)) return
  const m = load(addr)
  const p = m[code] || { shares: 0, cost: 0 }
  m[code] = { shares: p.shares + shares, cost: p.cost + Math.max(0, twdCost) }
  save(addr, m)
}

/** 賣出:依平均成本法等比例扣除。 */
export function recordSell(addr: string | null | undefined, code: string, shares: number) {
  const m = load(addr)
  const p = m[code]
  if (!p || p.shares <= 0) return
  const sell = Math.min(shares, p.shares)
  const remain = p.shares - sell
  const avg = p.cost / p.shares
  m[code] = remain <= 1e-9 ? { shares: 0, cost: 0 } : { shares: remain, cost: avg * remain }
  save(addr, m)
}

export function getCostMap(addr?: string | null): CostMap {
  return load(addr)
}

/** 以當前持股數 × 平均成本估算成本基礎與損益;無紀錄回 null。 */
export function pnlFor(addr: string | null | undefined, code: string, curShares: number, curValue: number) {
  const p = getCostMap(addr)[code]
  if (!p || p.shares <= 0) return null
  const avg = p.cost / p.shares
  const basis = avg * curShares
  if (!(basis > 0)) return null
  return { basis, pnl: curValue - basis, pct: ((curValue - basis) / basis) * 100 }
}
