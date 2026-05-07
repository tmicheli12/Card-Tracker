interface StatCardProps {
  label: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'slate'
  icon?: string
  gradient?: boolean
}

const styles = {
  blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',   value: 'text-blue-700',   border: 'border-blue-100' },
  green:  { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-700', border: 'border-emerald-100' },
  orange: { bg: 'bg-orange-50',  icon: 'bg-orange-100 text-orange-600', value: 'text-orange-700', border: 'border-orange-100' },
  purple: { bg: 'bg-violet-50',  icon: 'bg-violet-100 text-violet-600', value: 'text-violet-700', border: 'border-violet-100' },
  red:    { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',     value: 'text-red-700',    border: 'border-red-100' },
  slate:  { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-500', value: 'text-slate-700',  border: 'border-slate-100' },
}

export default function StatCard({ label, value, sub, color = 'blue', icon }: StatCardProps) {
  const s = styles[color]
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">{label}</span>
        {icon && (
          <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-base ${s.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <span className={`text-2xl font-extrabold leading-none ${s.value}`}>{value}</span>
        {sub && <p className="text-xs text-slate-400 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  )
}
