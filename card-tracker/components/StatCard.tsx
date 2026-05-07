interface StatCardProps {
  label: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'slate'
  icon?: string
  gradient?: boolean
}

const styles = {
  blue:   { bg: 'bg-blue-950/40',    icon: 'bg-blue-900 text-blue-400',     value: 'text-blue-400',    border: 'border-blue-900' },
  green:  { bg: 'bg-emerald-950/40', icon: 'bg-emerald-900 text-emerald-400', value: 'text-emerald-400', border: 'border-emerald-900' },
  orange: { bg: 'bg-orange-950/40',  icon: 'bg-orange-900 text-orange-400',  value: 'text-orange-400',  border: 'border-orange-900' },
  purple: { bg: 'bg-violet-950/40',  icon: 'bg-violet-900 text-violet-400',  value: 'text-violet-400',  border: 'border-violet-900' },
  red:    { bg: 'bg-red-950/40',     icon: 'bg-red-900 text-red-400',       value: 'text-red-400',     border: 'border-red-900' },
  slate:  { bg: 'bg-zinc-800',       icon: 'bg-zinc-700 text-zinc-400',     value: 'text-zinc-300',    border: 'border-zinc-700' },
}

export default function StatCard({ label, value, sub, color = 'blue', icon }: StatCardProps) {
  const s = styles[color]
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-none">{label}</span>
        {icon && (
          <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-base ${s.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <span className={`text-2xl font-extrabold leading-none ${s.value}`}>{value}</span>
        {sub && <p className="text-xs text-zinc-500 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  )
}
