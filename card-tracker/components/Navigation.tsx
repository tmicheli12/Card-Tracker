'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/add', label: 'Add Card', icon: '➕' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/grading', label: 'Grading', icon: '🏆' },
  { href: '/analytics', label: 'Analytics', icon: '📈' },
]

export default function Navigation({ layout }: { layout: 'mobile' | 'horizontal' }) {
  const pathname = usePathname()

  if (layout === 'mobile') {
    return (
      <div className="flex items-stretch">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg leading-tight">{icon}</span>
              <span className="leading-tight">{label}</span>
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
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        )
      })}
      <Link
        href="/settings"
        className={`ml-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          pathname === '/settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        ⚙️ Settings
      </Link>
    </div>
  )
}
