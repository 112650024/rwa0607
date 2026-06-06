import type { LucideIcon } from "lucide-react"

export function PageHeader({
  title,
  desc,
  icon: Icon,
}: {
  title: string
  desc: string
  icon: LucideIcon
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}
