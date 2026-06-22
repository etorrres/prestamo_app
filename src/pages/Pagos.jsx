import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { CreditCard, Loader2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import { useAuth } from '../context/useAuth'
import { PAYMENT_METHODS } from '../lib/constants'
import { auditFields, friendlyError, selectUserRows } from '../lib/db'
import { formatDate, inputDate, money } from '../utils/formatters'
import { requiredMessage, validatePositiveMoney } from '../utils/validators'

const defaultValues = {
  cliente_id: '',
  cuota_id: '',
  fecha: inputDate(),
  metodo: 'EFECTIVO',
  monto: '',
  observacion: '',
  prestamo_id: '',
}

export default function Pagos() {
  const { supabase, user } = useAuth()
  const [cuotas, setCuotas] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    control,
  } = useForm({ defaultValues })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function load() {
    setLoading(true)
    setError('')
    const [installmentResult, loanResult, clientResult, paymentResult] = await Promise.all([
      selectUserRows(supabase, 'cuotas', user?.id, { order: 'fecha_vencimiento', ascending: true }),
      selectUserRows(supabase, 'prestamos', user?.id),
      selectUserRows(supabase, 'clientes', user?.id),
      selectUserRows(supabase, 'pagos', user?.id, { order: 'fecha', ascending: false }),
    ])
    const loadError = installmentResult.error || loanResult.error || clientResult.error || paymentResult.error
    if (loadError) setError(friendlyError(loadError))
    setCuotas(installmentResult.data || [])
    setPrestamos(loanResult.data || [])
    setClientes(clientResult.data || [])
    setPagos(paymentResult.data || [])
    setLoading(false)
  }

  const pendingInstallments = useMemo(() => {
    const loans = new Map(prestamos.map((row) => [row.id, row]))
    const clients = new Map(clientes.map((row) => [row.id, row]))
    return cuotas
      .filter((cuota) => cuota.estado !== 'PAGADA')
      .map((cuota) => {
        const loan = loans.get(cuota.prestamo_id)
        const client = clients.get(loan?.cliente_id)
        const balance = Math.max(0, Number(cuota.total || 0) - Number(cuota.pagado || 0))
        return {
          ...cuota,
          balance,
          cliente_id: client?.id || '',
          cliente: client?.nombre || 'Sin cliente',
          contrato: loan ? `${client?.nombre || 'Sin cliente'} - ${money(loan.total_pagar)}` : 'Sin contrato',
          prestamo_id: loan?.id || cuota.prestamo_id,
        }
      })
  }, [clientes, cuotas, prestamos])

  const selectedClientId = useWatch({ control, name: 'cliente_id' })
  const selectedLoanId = useWatch({ control, name: 'prestamo_id' })
  const selectedCuotaId = useWatch({ control, name: 'cuota_id' })

  const loanOptions = useMemo(() => {
    const clients = new Map(clientes.map((row) => [row.id, row]))
    return prestamos
      .filter((loan) => loan.estado !== 'CANCELADO')
      .filter((loan) => (selectedClientId ? loan.cliente_id === selectedClientId : true))
      .map((loan) => {
        const client = clients.get(loan.cliente_id)
        return {
          ...loan,
          cliente: client?.nombre || 'Sin cliente',
        }
      })
  }, [clientes, prestamos, selectedClientId])

  const cuotaOptions = useMemo(() => {
    if (!selectedLoanId) return []
    return pendingInstallments.filter((cuota) => cuota.prestamo_id === selectedLoanId)
  }, [pendingInstallments, selectedLoanId])

  useEffect(() => {
    const selectedLoan = prestamos.find((loan) => loan.id === selectedLoanId)
    if (!selectedLoan) return
    if (!selectedClientId) {
      setValue('cliente_id', selectedLoan.cliente_id || '')
      return
    }
    if (selectedLoan.cliente_id !== selectedClientId) {
      setValue('prestamo_id', '')
      setValue('cuota_id', '')
      setValue('monto', '')
    }
  }, [prestamos, selectedClientId, selectedLoanId, setValue])

  useEffect(() => {
    if (!selectedLoanId) {
      setValue('cuota_id', '')
      setValue('monto', '')
      return
    }

    const selectedCuotaStillVisible = cuotaOptions.some((cuota) => cuota.id === selectedCuotaId)
    if (selectedCuotaId && !selectedCuotaStillVisible) {
      setValue('cuota_id', '')
      setValue('monto', '')
    }
  }, [cuotaOptions, selectedCuotaId, selectedLoanId, setValue])

  useEffect(() => {
    const selected = cuotaOptions.find((row) => row.id === selectedCuotaId)
    if (selected) setValue('monto', selected.balance || selected.total)
  }, [cuotaOptions, selectedCuotaId, setValue])

  async function onSubmit(values) {
    setError('')
    setSuccess('')
    const selected = cuotas.find((cuota) => cuota.id === values.cuota_id && cuota.prestamo_id === values.prestamo_id)
    if (!selected) {
      setError('Selecciona un contrato y una cuota pendiente.')
      return
    }

    const paymentAmount = Number(values.monto)
    const nextPaid = Number(selected.pagado || 0) + paymentAmount
    const isPaid = nextPaid + 0.009 >= Number(selected.total || 0)

    const paymentPayload = {
      cuota_id: selected.id,
      fecha: values.fecha,
      metodo: values.metodo,
      monto: paymentAmount,
      observacion: values.observacion?.trim() || null,
      prestamo_id: selected.prestamo_id,
    }

    const { error: paymentError } = await supabase
      .from('pagos')
      .insert({ ...paymentPayload, ...auditFields(user.id, true) })

    if (paymentError) {
      setError(friendlyError(paymentError))
      return
    }

    const { error: installmentError } = await supabase
      .from('cuotas')
      .update({
        ...auditFields(user.id),
        estado: isPaid ? 'PAGADA' : 'PENDIENTE',
        fecha_pago: isPaid ? values.fecha : null,
        pagado: Number(nextPaid.toFixed(2)),
      })
      .eq('id', selected.id)
      .eq('user_id', user.id)

    if (installmentError) {
      setError(friendlyError(installmentError))
      return
    }

    const updatedCuotas = cuotas.map((cuota) =>
      cuota.id === selected.id
        ? {
            ...cuota,
            estado: isPaid ? 'PAGADA' : 'PENDIENTE',
            pagado: Number(nextPaid.toFixed(2)),
          }
        : cuota,
    )
    const loanInstallments = updatedCuotas.filter((cuota) => cuota.prestamo_id === selected.prestamo_id)
    const saldo = loanInstallments.reduce(
      (sum, cuota) => sum + Math.max(0, Number(cuota.total || 0) - Number(cuota.pagado || 0)),
      0,
    )
    const loanStatus = loanInstallments.every((cuota) => cuota.estado === 'PAGADA') ? 'CANCELADO' : 'ACTIVO'

    const { error: loanError } = await supabase
      .from('prestamos')
      .update({
        ...auditFields(user.id),
        estado: loanStatus,
        saldo: Number(saldo.toFixed(2)),
      })
      .eq('id', selected.prestamo_id)
      .eq('user_id', user.id)

    if (loanError) {
      setError(friendlyError(loanError))
      return
    }

    reset(defaultValues)
    setSuccess('Pago registrado correctamente.')
    await load()
  }

  const paymentColumns = [
    { header: 'Fecha', key: 'fecha', render: (row) => formatDate(row.fecha) },
    { header: 'Monto', key: 'monto', render: (row) => money(row.monto) },
    { header: 'Metodo', key: 'metodo' },
    { header: 'Observacion', key: 'observacion', render: (row) => row.observacion || 'Sin observacion' },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-subtitle">
            Registra pagos por cuota, actualiza saldos y cancela prestamos cuando todas las cuotas esten pagadas.
          </p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <form className="surface h-fit p-4 sm:p-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Nuevo pago</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Primero elige cliente o contrato.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Persona del contrato</span>
              <select className="field-input" {...register('cliente_id')}>
                <option value="">Todas las personas</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Contrato</span>
              <select
                className="field-input"
                {...register('prestamo_id', {
                  required: requiredMessage('Contrato'),
                })}
              >
                <option value="">Seleccionar contrato</option>
                {loanOptions.map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    {loan.cliente} - {formatDate(loan.fecha_inicio)} - saldo {money(loan.saldo ?? loan.total_pagar)}
                  </option>
                ))}
              </select>
              {errors.prestamo_id ? <p className="field-error">{errors.prestamo_id.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Cuota del contrato</span>
              <select
                className="field-input"
                disabled={!selectedLoanId}
                {...register('cuota_id', {
                  required: requiredMessage('Cuota'),
                })}
              >
                <option value="">{selectedLoanId ? 'Seleccionar cuota' : 'Selecciona primero un contrato'}</option>
                {cuotaOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    Cuota #{row.numero} - vence {formatDate(row.fecha_vencimiento)} - saldo {money(row.balance)}
                  </option>
                ))}
              </select>
              {errors.cuota_id ? <p className="field-error">{errors.cuota_id.message}</p> : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="block">
                <span className="field-label">Fecha</span>
                <input className="field-input" type="date" {...register('fecha')} />
              </label>
              <label className="block">
                <span className="field-label">Metodo</span>
                <select className="field-input" {...register('metodo')}>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="field-label">Monto</span>
              <input
                className="field-input"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...register('monto', {
                  required: requiredMessage('Monto'),
                  validate: validatePositiveMoney,
                })}
              />
              {errors.monto ? <p className="field-error">{errors.monto.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Observacion</span>
              <textarea className="field-input min-h-24 resize-y" {...register('observacion')} />
            </label>
          </div>

          <button className="btn-primary mt-5 w-full" disabled={isSubmitting || loading} type="submit">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar pago
          </button>
        </form>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-950 dark:text-white">Historial de pagos</h2>
          {loading ? (
            <div className="surface grid place-items-center p-10 text-sm text-slate-500">
              <Loader2 className="mb-2 h-5 w-5 animate-spin" />
              Cargando pagos
            </div>
          ) : (
            <DataTable columns={paymentColumns} emptyText="No hay pagos registrados." rows={pagos} />
          )}
        </div>
      </div>
    </section>
  )
}
