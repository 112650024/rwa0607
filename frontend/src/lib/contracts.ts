import type { Abi } from "viem"
import { stringToHex } from "viem"
import deployed from "@/deployed.json"

type Deployed = typeof deployed
type ContractRef = { address: `0x${string}`; abi: Abi }

const ref = (x: { address: string; abi: unknown }): ContractRef => ({
  address: x.address as `0x${string}`,
  abi: x.abi as Abi,
})

export const DEPLOY: Deployed = deployed
export const CHAIN_ID = deployed.chainId
export const EXPLORER = deployed.explorer

export const TWD = ref(deployed.contracts.twd)
export const ORACLE = ref(deployed.contracts.oracle)
export const FACTORY = ref(deployed.contracts.factory)
export const LENDING = ref(deployed.contracts.lending)
export const IPO = ref(deployed.contracts.ipo)
export const STOCK_ABI = deployed.stockTokenAbi as Abi

export type DeployedStock = { code: string; name: string; tokenSymbol: string; token: `0x${string}` }
export const STOCKS = deployed.stocks as DeployedStock[]
export const IPO_OFFERINGS = deployed.ipoOfferings as { id: number; code: string; token: string }[]

export const tokenOf = (code: string) =>
  STOCKS.find((s) => s.code === code)?.token as `0x${string}` | undefined

export const stockContract = (code: string): ContractRef | null => {
  const t = tokenOf(code)
  return t ? { address: t, abi: STOCK_ABI } : null
}

export type UniswapCfg = {
  factory: string
  npm: string
  router: `0x${string}`
  quoter: `0x${string}`
  pool: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  fee: number
  twd: `0x${string}`
  stockToken: `0x${string}`
  stockCode: string
  stockSymbol: string
}
export const UNISWAP = (deployed as { uniswap?: UniswapCfg }).uniswap

export const sym32 = (code: string) => stringToHex(code, { size: 32 })
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`
export const readUrl = (a: string) => `${EXPLORER}/address/${a}#readContract`
