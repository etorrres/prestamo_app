import { useEffect, useMemo, useState } from 'react'
import { Bell, Loader2, MessageCircle } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/useAuth'
import { loadConfiguration } from '../lib/configuration'
import { friendlyError, selectUserRows } from '../lib/db'
import { formatDate, inputDate, money } from '../utils/formatters'
import { getInstallmentVisualState } from '../utils/loanCalculator'
import { openWhatsapp, overdueReminder, preventiveReminder } from '../utils/whatsapp'

export default function Alertas() {
  const { supabase, user } = useAuth()
  const [cuotas, setCuotas] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [clientes, setClientes] = useState([])
  const [acreedora, setAcreedora] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [installmentResult, loanResult, clientResult, configResult] = await Promise.all([
        selectUserRows(supabase, 'cuotas', user?.id, { order: 'fecha_vencimiento', ascending: true }),
        selectUserRows(supabase, 'prestamos', user?.id),
        selectUserRows(supabase, 'clientes', user?.id),
        loadConfiguration(supabase, user?.id),
      ])
      const loadError = installmentResult.error || loanResult.error || clientResult.error
      if (loadError) setError(friendlyError(loadError))
      setCuotas(installmentResult.data || [])
      setPrestamos(loanResult.data || [])
      setClientes(clientResult.data || [])
      setAcreedora(configResult.data)
      setLoading(false)
    }
    load()
  }, [supabase, user?.id])

  const rows = useMemo(() => {
    const loanById = new Map(prestamos.map((row) => [row.id, row]))
    const clientById = new Map(clientes.map((row) => [row.id, row]))
    const today = inputDate()

    return cuotas
      .filter((cuota) => cuota.estado !== 'PAGADA')
      .map((cuota) => {
        const loan = loanById.get(cuota.prestamo_id)
        const cliente = clientById.get(loan?.cliente_id)
        const diff = Math.ceil(
          (new Date(`${cuota.fecha_vencimiento}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86_400_000,
        )
        return {
          ...cuota,
          cliente,
          dias: diff,
          visual: getInstallmentVisualState(cuota),
        }
      })
      .filter((row) => row.visual === 'VENCIDA' || row.visual === 'HOY' || row.visual === 'PROXIMA')
  }, [clientes, cuotas, prestamos])

  const vencidas = rows.filter((row) => row.visual === 'VENCIDA')
  const hoy = rows.filter((row) => row.visual === 'HOY')
  const proximas = rows.filter((row) => row.visual === 'PROXIMA')

  function send(row) {
    if (!row.cliente || !acreedora) return
    const message =
      row.visual === 'VENCIDA'
        ? overdueReminder({ acreedora, cliente: row.cliente, cuota: row })
        : preventiveReminder({ acreedora, cliente: row.cliente, cuota: row })
    openWhatsapp(row.cliente.telefono, message)
  }

  const columns = [
    {
      header: 'Cliente',
      key: 'cliente',
      render: (row) => row.cliente?.nombre || 'Sin cliente',
    },
    { header: 'Cuota', key: 'numero', render: (row) => `#${row.numero}` },
    { header: 'Vencimiento', key: 'fecha_vencimiento', render: (row) => formatDate(row.fecha_vencimiento) },
    { header: 'Total', key: 'total', render: (row) => money(row.total) },
    { header: 'Estado', key: 'visual', render: (row) => <Badge value={row.visual} /> },
    {
      header: 'WhatsApp',
      key: 'whatsapp',
      render: (row) => (
        <button
          aria-label="Enviar recordatorio WhatsApp"
          className="icon-btn"
          disabled={!row.cliente?.telefono}
          onClick={() => send(row)}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas</h1>
          <p className="page-subtitle">Recordatorios preventivos y de mora mediante enlaces seguros de WhatsApp.</p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Revisando vencimientos
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Bell} label="Vencidas" tone="red" value={vencidas.length} />
            <StatCard icon={Bell} label="Vence hoy" tone="amber" value={hoy.length} />
            <StatCard icon={Bell} label="Vence en 3 dias" tone="blue" value={proximas.length} />
          </div>
          <DataTable columns={columns} emptyText="No hay alertas activas." rows={rows} />
        </>
      )}
    </section>
  )
}
