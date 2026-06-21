import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { useAuth } from '../context/useAuth'
import { friendlyError, selectUserRows } from '../lib/db'
import { formatDate, money } from '../utils/formatters'
import { getInstallmentVisualState } from '../utils/loanCalculator'

export default function Cuotas() {
  const { supabase, user } = useAuth()
  const [cuotas, setCuotas] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [clientes, setClientes] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [installmentResult, loanResult, clientResult] = await Promise.all([
        selectUserRows(supabase, 'cuotas', user?.id, { order: 'fecha_vencimiento', ascending: true }),
        selectUserRows(supabase, 'prestamos', user?.id),
        selectUserRows(supabase, 'clientes', user?.id),
      ])
      const loadError = installmentResult.error || loanResult.error || clientResult.error
      if (loadError) setError(friendlyError(loadError))
      setCuotas(installmentResult.data || [])
      setPrestamos(loanResult.data || [])
      setClientes(clientResult.data || [])
      setLoading(false)
    }
    load()
  }, [supabase, user?.id])

  const rows = useMemo(() => {
    const clientById = new Map(clientes.map((row) => [row.id, row]))
    const loanById = new Map(prestamos.map((row) => [row.id, row]))
    const needle = query.trim().toLocaleUpperCase('es-HN')

    return cuotas
      .map((cuota) => {
        const loan = loanById.get(cuota.prestamo_id)
        const client = clientById.get(loan?.cliente_id)
        return {
          ...cuota,
          cliente: client?.nombre || 'Sin cliente',
          visual: getInstallmentVisualState(cuota),
        }
      })
      .filter((row) =>
        needle
          ? [row.cliente, row.numero, row.estado, row.fecha_vencimiento].some((value) =>
              String(value || '').toLocaleUpperCase('es-HN').includes(needle),
            )
          : true,
      )
  }, [clientes, cuotas, prestamos, query])

  const columns = [
    { header: 'Cliente', key: 'cliente' },
    { header: 'Cuota', key: 'numero', render: (row) => `#${row.numero}` },
    { header: 'Vencimiento', key: 'fecha_vencimiento', render: (row) => formatDate(row.fecha_vencimiento) },
    { header: 'Capital', key: 'capital', render: (row) => money(row.capital) },
    { header: 'Interes', key: 'interes', render: (row) => money(row.interes) },
    { header: 'Total', key: 'total', render: (row) => money(row.total) },
    { header: 'Estado', key: 'estado', render: (row) => <Badge value={row.visual} /> },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuotas</h1>
          <p className="page-subtitle">Control de vencimientos, capital, interes y estado de cada cuota.</p>
        </div>
      </div>

      <div className="surface p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-input mt-0 pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cuota, cliente o estado"
            value={query}
          />
        </label>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Cargando cuotas
        </div>
      ) : (
        <DataTable columns={columns} emptyText="No hay cuotas generadas." rows={rows} />
      )}
    </section>
  )
}
