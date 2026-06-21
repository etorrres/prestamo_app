import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { useAuth } from '../context/useAuth'
import { navigation } from '../lib/navigation'

export default function Layout() {
  const { supabase, user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  async function handleLogout() {
    await supabase?.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <button
              aria-label="Abrir menu"
              className="icon-btn lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                Gestion de prestamos personales
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.email || 'Sesion activa'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Cambiar tema"
                className="icon-btn"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                type="button"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button aria-label="Cerrar sesion" className="icon-btn" onClick={handleLogout} type="button">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col pb-20 lg:pb-0">
          <Outlet />
        </main>

        <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <div className="grid grid-cols-5 gap-1 px-2 py-2">
            {navigation.slice(0, 5).map(({ icon: Icon, label, to }) => (
              <button
                className="flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                key={to}
                onClick={() => navigate(to)}
                type="button"
              >
                <Icon className="h-5 w-5" />
                <span className="w-full truncate text-center">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {mobileOpen ? (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/50 lg:hidden">
          <div className="h-full w-80 max-w-[86vw] bg-white p-4 shadow-xl dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-slate-950 dark:text-white">Menu</p>
              <button
                aria-label="Cerrar menu"
                className="icon-btn"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-1">
              {navigation.map(({ icon: Icon, label, to }) => (
                <button
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                  key={to}
                  onClick={() => {
                    navigate(to)
                    setMobileOpen(false)
                  }}
                  type="button"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
