import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  HandCoins,
  Loader2,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/useAuth'
import { friendlyError, selectUserRows } from '../lib/db'
import { formatDate, inputDate, money } from '../utils/formatters'
import { getInstallmentVisualState } from '../utils/loanCalculator'

export default function Dashboard() {
  const { supabase, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prestamos, setPrestamos] = useState([])
  const [cuotas, setCuotas] = useState([])
  const [pagos, setPagos] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [loanResult, installmentResult, paymentResult] = await Promise.all([
        selectUserRows(supabase, 'prestamos', user?.id),
        selectUserRows(supabase, 'cuotas', user?.id, { order: 'fecha_vencimiento', ascending: true }),
        selectUserRows(supabase, 'pagos', user?.id, { order: 'fecha', ascending: false }),
      ])
      const loadError = loanResult.error || installmentResult.error || paymentResult.error
      if (loadError) setError(friendlyError(loadError))
      setPrestamos(loanResult.data || [])
      setCuotas(installmentResult.data || [])
      setPagos(paymentResult.data || [])
      setLoading(false)
    }
    load()
  }, [supabase, user?.id])

  const stats = useMemo(() => {
    const today = inputDate()
    const totalPrestado = prestamos.reduce((sum, row) => sum + Number(row.monto || 0), 0)
    const intereses = prestamos.reduce((sum, row) => sum + Number(row.interes_total || 0), 0)
    const totalRecuperado = pagos.reduce((sum, row) => sum + Number(row.monto || 0), 0)
    const totalPendiente = cuotas
      .filter((row) => row.estado !== 'PAGADA')
      .reduce((sum, row) => sum + Number(row.total || 0), 0)
    const cobrosHoy = cuotas.filter((row) => row.estado !== 'PAGADA' && row.fecha_vencimiento === today)
    const vencidas = cuotas.filter((row) => getInstallmentVisualState(row) === 'VENCIDA')
    const porVencer = cuotas.filter((row) => getInstallmentVisualState(row) === 'PROXIMA')
    const activos = prestamos.filter((row) => row.estado !== 'CANCELADO')

    return {
      activos: activos.length,
      cobrosHoy: cobrosHoy.length,
      intereses,
      porVencer: porVencer.length,
      totalPendiente,
      totalPrestado,
      totalRecuperado,
      vencidas: vencidas.length,
    }
  }, [cuotas, pagos, prestamos])

  const nextInstallments = cuotas
    .filter((row) => row.estado !== 'PAGADA')
    .slice(0, 8)
    .map((row) => ({ ...row, visual: getInstallmentVisualState(row) }))

  const columns = [
    { header: 'Cuota', key: 'numero', render: (row) => `#${row.numero}` },
    { header: 'Vencimiento', key: 'fecha_vencimiento', render: (row) => formatDate(row.fecha_vencimiento) },
    { header: 'Total', key: 'total', render: (row) => money(row.total) },
    { header: 'Estado', key: 'estado', render: (row) => <Badge value={row.visual} /> },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Resumen financiero de prestamos, recuperacion, alertas y cuotas pendientes.
          </p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Calculando indicadores
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={HandCoins} label="Total prestado" value={money(stats.totalPrestado)} />
            <StatCard icon={Banknote} label="Total recuperado" tone="blue" value={money(stats.totalRecuperado)} />
            <StatCard icon={WalletCards} label="Total pendiente" tone="amber" value={money(stats.totalPendiente)} />
            <StatCard icon={TrendingUp} label="Intereses generados" tone="emerald" value={money(stats.intereses)} />
            <StatCard icon={CalendarClock} label="Cobros de hoy" tone="blue" value={stats.cobrosHoy} />
            <StatCard icon={AlertTriangle} label="Cuotas vencidas" tone="red" value={stats.vencidas} />
            <StatCard icon={Clock3} label="Por vencer" tone="amber" value={stats.porVencer} />
            <StatCard icon={CheckCircle2} label="Prestamos activos" tone="slate" value={stats.activos} />
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-slate-950 dark:text-white">Proximos cobros</h2>
            <DataTable columns={columns} emptyText="No hay cuotas pendientes." rows={nextInstallments} />
          </div>
        </>
      )}
    </section>
  )
}
