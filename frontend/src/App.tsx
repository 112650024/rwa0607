import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="font-mono-num text-xs tracking-widest text-primary/80 uppercase">
        Real World Asset · On-chain · Sepolia
      </span>
      <h1 className="font-display text-6xl font-bold">
        Formosa<span className="text-primary">X</span>
      </h1>
      <p className="text-muted-foreground max-w-md">
        台股 RWA 鏈上金融 — 受監管穩定幣、預言機報價、股票借貸與 IPO 認購。
      </p>
      <div className="flex gap-3">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">連接錢包</Button>
        <Button variant="outline">探索市場</Button>
      </div>
    </div>
  )
}

export default App
