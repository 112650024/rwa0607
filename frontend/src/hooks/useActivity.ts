import { useEffect, useState } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { parseAbiItem } from "viem"
import { STOCKS, LENDING } from "@/lib/contracts"
import { stockByCode } from "@/lib/catalog"

export type Activity = {
  kind: "buy" | "sell" | "borrow" | "repay" | "deposit" | "withdraw" | "collateral"
  text: string
  hash: `0x${string}`
  block: bigint
}

// 事件簽名(對齊合約;StockToken / LendingPool)
const EV = {
  minted: parseAbiItem("event Minted(address indexed user, uint256 twdAmount, uint256 tokenAmount, uint256 reserve)"),
  redeemed: parseAbiItem("event Redeemed(address indexed user, uint256 tokenAmount, uint256 twdAmount, uint256 reserve)"),
  borrow: parseAbiItem("event Borrow(address indexed user, uint256 amount)"),
  repay: parseAbiItem("event Repay(address indexed user, uint256 amount)"),
  deposit: parseAbiItem("event Deposit(address indexed user, uint256 amount, uint256 shares)"),
  withdraw: parseAbiItem("event Withdraw(address indexed user, uint256 amount, uint256 shares)"),
  supply: parseAbiItem("event SupplyCollateral(address indexed user, address indexed token, uint256 amount)"),
} as const

const twd6 = (v: bigint) => (Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })
const shares18 = (v: bigint) => (Number(v) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 })
const nameOfToken = (addr: string) => {
  const code = STOCKS.find((s) => s.token.toLowerCase() === addr.toLowerCase())?.code
  return (code && stockByCode(code)?.name) || "台股"
}

/**
 * 讀使用者的鏈上活動(viem getLogs,依 user 過濾)。
 * 用有界區塊範圍避免公開 RPC 逾時;失敗則回 error,前端改導向 Etherscan。
 */
export function useActivity(): { items: Activity[]; loading: boolean; error: boolean } {
  const { address } = useAccount()
  const client = usePublicClient()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!address || !client) return
    let alive = true
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const latest = await client.getBlockNumber()
        const fromBlock = latest > 90000n ? latest - 90000n : 0n
        const stockAddrs = STOCKS.map((s) => s.token as `0x${string}`)
        const user = address as `0x${string}`
        const out: Activity[] = []

        const [mints, redeems, borrows, repays, deposits, withdraws, supplies] = await Promise.all([
          client.getLogs({ address: stockAddrs, event: EV.minted, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: stockAddrs, event: EV.redeemed, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: LENDING.address, event: EV.borrow, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: LENDING.address, event: EV.repay, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: LENDING.address, event: EV.deposit, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: LENDING.address, event: EV.withdraw, args: { user }, fromBlock, toBlock: latest }),
          client.getLogs({ address: LENDING.address, event: EV.supply, args: { user }, fromBlock, toBlock: latest }),
        ])

        for (const l of mints) out.push({ kind: "buy", text: `買入 ${nameOfToken(l.address)} ${shares18(l.args.tokenAmount!)} 股`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of redeems) out.push({ kind: "sell", text: `賣出 ${nameOfToken(l.address)} ${shares18(l.args.tokenAmount!)} 股`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of borrows) out.push({ kind: "borrow", text: `借出 ${twd6(l.args.amount!)} TWD`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of repays) out.push({ kind: "repay", text: `還款 ${twd6(l.args.amount!)} TWD`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of deposits) out.push({ kind: "deposit", text: `出借 ${twd6(l.args.amount!)} TWD`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of withdraws) out.push({ kind: "withdraw", text: `取回出借 ${twd6(l.args.amount!)} TWD`, hash: l.transactionHash!, block: l.blockNumber! })
        for (const l of supplies) out.push({ kind: "collateral", text: `質押 ${nameOfToken(l.args.token!)} ${shares18(l.args.amount!)} 股`, hash: l.transactionHash!, block: l.blockNumber! })

        out.sort((a, b) => Number(b.block - a.block))
        if (alive) setItems(out)
      } catch {
        if (alive) setError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [address, client])

  return { items, loading, error }
}
