import { parseAbi } from "viem"
import { useReadContract } from "wagmi"
import { UNISWAP } from "@/lib/contracts"

export const POOL_ABI = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, uint8 d, bool e)",
])
export const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 ticksCrossed, uint256 gasEstimate)",
])
export const ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
])
export const ERC20_APPROVE_ABI = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"])

/** Uniswap 池價(TWD / 股),由 slot0 sqrtPriceX96 換算;回 null 表示尚未建池。 */
export function usePoolPrice(): number | null {
  const u = UNISWAP
  const { data } = useReadContract({
    address: u?.pool,
    abi: POOL_ABI,
    functionName: "slot0",
    query: { enabled: !!u, refetchInterval: 10000 },
  })
  if (!u || !data) return null
  const sqrtP = (data as unknown as unknown[])[0] as bigint
  const ratio = (Number(sqrtP) / 2 ** 96) ** 2 // token1_raw / token0_raw
  const twdIsToken0 = u.token0.toLowerCase() === u.twd.toLowerCase()
  // dTSMC 18 位、TWD 6 位 → 小數位因子 1e12
  const twdPerShare = twdIsToken0 ? 1e12 / ratio : ratio * 1e12
  return Number.isFinite(twdPerShare) ? twdPerShare : null
}
