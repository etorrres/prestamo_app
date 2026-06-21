import { NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { navigation } from '../lib/navigation'

export default function Sidebar() {
  return (
    <aside className="no-print hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
            Prestamos
          </p>
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white">Keydi</h1>
        </div>
      </div>
      <nav className="mt-8 space-y-1">
        {navigation.map(({ icon: Icon, label, to }) => (
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
              }`
            }
            key={to}
            to={to}
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
