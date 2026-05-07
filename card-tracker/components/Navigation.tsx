'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',           label: 'Dashboard', icon: '📊' },
  { href: '/add',        label: 'Add Card',  icon: '➕' },
  { href: '/inventory',  label: 'Inventory', icon: '📦' },
  { href: '/grading',    label: 'Grading',   icon: '🏆' },
  { href: '/analytics',  label: 'Analytics', icon: '📈' },
]

export default function Navigation({ layout }: { layout: 'mobile' | 'horizontal' }) {
  const pathname = usePathname()

  if (layout === 'mobile') {
    return (
      <div className="flex items-stretch h-16">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}>
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {links.map(({ href, label, icon }) => {
        const active = pathname === href
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        )
      })}
      <Link href="/settings"
        className={`ml-1 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
          pathname === '/settings' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}>
        ⚙️ Settings
      </Link>
    </div>
  )
}
