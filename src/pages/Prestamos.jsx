import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Edit3, Loader2, Plus, Trash2 } from 'lucide-react'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/useAuth'
import { FRECUENCIAS } from '../lib/constants'
import { auditFields, friendlyError, selectUserRows } from '../lib/db'
import { formatDate, inputDate, money } from '../utils/formatters'
import { calculateLoan } from '../utils/loanCalculator'
import { requiredMessage, validatePositiveMoney } from '../utils/validators'

const defaultValues = {
  aval_id: '',
  cliente_id: '',
  fecha_contrato: inputDate(),
  fecha_inicio_pago: inputDate(),
  frecuencia: 'MENSUAL',
  interes_porcentaje: 10,
  monto: '',
  mora_periodo: 0,
  plazo_meses: 1,
}

function canEditLoan(loan) {
  const status = loan?.estado_documental || 'BORRADOR'
  return status !== 'APROBADO' && status !== 'FIRMADO'
}

export default function Prestamos() {
  const { supabase, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [prestamos, setPrestamos] = useState([])
  const [clientes, setClientes] = useState([])
  const [avales, setAvales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    control,
  } = useForm({ defaultValues })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function load() {
    setLoading(true)
    setError('')
    const [loanResult, clientResult, guarantorResult] = await Promise.all([
      selectUserRows(supabase, 'prestamos', user?.id),
      selectUserRows(supabase, 'clientes', user?.id),
      selectUserRows(supabase, 'avales', user?.id),
    ])
    const loadError = loanResult.error || clientResult.error || guarantorResult.error
    if (loadError) setError(friendlyError(loadError))
    setPrestamos(loanResult.data || [])
    setClientes(clientResult.data || [])
    setAvales(guarantorResult.data || [])
    setLoading(false)
  }

  const watched = useWatch({ control }) || defaultValues
  const calculation = calculateLoan({
    fechaInicio: watched.fecha_contrato,
    fechaInicioPago: watched.fecha_inicio_pago,
    frecuencia: watched.frecuencia,
    interesPorcentaje: watched.interes_porcentaje,
    monto: watched.monto,
    plazoMeses: watched.plazo_meses,
  })

  const rows = useMemo(() => {
    const clients = new Map(clientes.map((row) => [row.id, row.nombre]))
    const guarantors = new Map(avales.map((row) => [row.id, row.nombre]))
    return prestamos.map((row) => ({
      ...row,
      aval: guarantors.get(row.aval_id) || 'Sin aval',
      cliente: clients.get(row.cliente_id) || 'Sin cliente',
    }))
  }, [avales, clientes, prestamos])

  function openCreate() {
    setEditingLoan(null)
    reset(defaultValues)
    setOpen(true)
  }

  function openEdit(row) {
    if (!canEditLoan(row)) {
      setError('Solo se pueden editar contratos en estado BORRADOR.')
      return
    }

    setEditingLoan(row)
    reset({
      aval_id: row.aval_id || '',
      cliente_id: row.cliente_id || '',
      fecha_contrato: row.fecha_contrato || row.fecha_inicio || inputDate(),
      fecha_inicio_pago: row.fecha_inicio_pago || row.fecha_inicio || inputDate(),
      frecuencia: row.frecuencia_pago || row.frecuencia || 'MENSUAL',
      interes_porcentaje: row.interes_porcentaje ?? 0,
      monto: row.monto ?? '',
      mora_periodo: row.mora_periodo ?? 0,
      plazo_meses: row.plazo_meses ?? 1,
    })
    setOpen(true)
  }

  async function onSubmit(values) {
    setError('')
    const loan = calculateLoan({
      fechaInicio: values.fecha_contrato,
      fechaInicioPago: values.fecha_inicio_pago,
      frecuencia: values.frecuencia,
      interesPorcentaje: values.interes_porcentaje,
      monto: values.monto,
      plazoMeses: values.plazo_meses,
    })

    const payload = {
      aval_id: values.aval_id || null,
      cliente_id: values.cliente_id,
      estado: 'ACTIVO',
      fecha_contrato: values.fecha_contrato,
      fecha_inicio: values.fecha_contrato,
      fecha_inicio_pago: values.fecha_inicio_pago,
      frecuencia: values.frecuencia,
      frecuencia_pago: values.frecuencia,
      interes_porcentaje: Number(values.interes_porcentaje),
      interes_total: loan.interesTotal,
      monto: loan.monto,
      mora_periodo: Number(values.mora_periodo || 0),
      plazo_meses: Number(values.plazo_meses),
      saldo: loan.totalPagar,
      total_pagar: loan.totalPagar,
    }

    if (editingLoan) {
      if (!canEditLoan(editingLoan)) {
        setError('Este contrato ya fue aprobado o firmado y no puede editarse.')
        return
      }

      const [currentLoanResult, paymentsResult, paidInstallmentsResult] = await Promise.all([
        supabase
          .from('prestamos')
          .select('estado_documental')
          .eq('id', editingLoan.id)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('pagos')
          .select('id', { count: 'exact', head: true })
          .eq('prestamo_id', editingLoan.id)
          .eq('user_id', user.id),
        supabase
          .from('cuotas')
          .select('id', { count: 'exact', head: true })
          .eq('prestamo_id', editingLoan.id)
          .eq('user_id', user.id)
          .eq('estado', 'PAGADA'),
      ])

      if (currentLoanResult.error || paymentsResult.error || paidInstallmentsResult.error) {
        setError('No se pudo validar si el contrato tiene pagos registrados.')
        return
      }

      if (!canEditLoan(currentLoanResult.data)) {
        setError('Este contrato ya fue aprobado o firmado y no puede editarse.')
        return
      }

      if ((paymentsResult.count || 0) > 0 || (paidInstallmentsResult.count || 0) > 0) {
        setError('No se puede editar un contrato que ya tiene pagos o cuotas pagadas.')
        return
      }

      const { error: updateError } = await supabase
        .from('prestamos')
        .update({ ...payload, ...auditFields(user.id), estado_documental: editingLoan.estado_documental || 'BORRADOR' })
        .eq('id', editingLoan.id)
        .eq('user_id', user.id)

      if (updateError) {
        setError(friendlyError(updateError))
        return
      }

      const { error: deleteInstallmentsError } = await supabase
        .from('cuotas')
        .delete()
        .eq('prestamo_id', editingLoan.id)
        .eq('user_id', user.id)

      if (deleteInstallmentsError) {
        setError(friendlyError(deleteInstallmentsError))
        return
      }

      const cuotas = loan.cuotas.map((cuota) => ({
        ...cuota,
        ...auditFields(user.id, true),
        pagado: 0,
        prestamo_id: editingLoan.id,
      }))

      const { error: cuotasError } = await supabase.from('cuotas').insert(cuotas)
      if (cuotasError) {
        setError(friendlyError(cuotasError))
        return
      }

      setOpen(false)
      setEditingLoan(null)
      await load()
      return
    }

    const { data, error: loanError } = await supabase
      .from('prestamos')
      .insert({ ...payload, ...auditFields(user.id, true), estado_documental: 'BORRADOR' })
      .select()
      .single()

    if (loanError) {
      setError(friendlyError(loanError))
      return
    }

    const cuotas = loan.cuotas.map((cuota) => ({
      ...cuota,
      ...auditFields(user.id, true),
      pagado: 0,
      prestamo_id: data.id,
    }))

    const { error: cuotasError } = await supabase.from('cuotas').insert(cuotas)
    if (cuotasError) {
      setError(friendlyError(cuotasError))
      return
    }

    setOpen(false)
    await load()
  }

  async function remove(row) {
    const confirmed = window.confirm(`Eliminar prestamo de ${row.cliente}? Tambien se eliminaran sus cuotas y pagos.`)
    if (!confirmed) return
    await supabase.from('pagos').delete().eq('prestamo_id', row.id).eq('user_id', user.id)
    await supabase.from('cuotas').delete().eq('prestamo_id', row.id).eq('user_id', user.id)
    const { error: deleteError } = await supabase
      .from('prestamos')
      .delete()
      .eq('id', row.id)
      .eq('user_id', user.id)
    if (deleteError) setError(friendlyError(deleteError))
    await load()
  }

  const columns = [
    {
      header: 'Cliente',
      key: 'cliente',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-950 dark:text-white">{row.cliente}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aval: {row.aval}</p>
        </div>
      ),
    },
    {
      header: 'Contrato',
      key: 'fecha_contrato',
      render: (row) => formatDate(row.fecha_contrato || row.fecha_inicio),
    },
    {
      header: 'Inicio pago',
      key: 'fecha_inicio_pago',
      render: (row) => formatDate(row.fecha_inicio_pago || row.fecha_inicio),
    },
    { header: 'Monto', key: 'monto', render: (row) => money(row.monto) },
    { header: 'Interes', key: 'interes_total', render: (row) => money(row.interes_total) },
    { header: 'Total', key: 'total_pagar', render: (row) => money(row.total_pagar) },
    { header: 'Saldo', key: 'saldo', render: (row) => money(row.saldo ?? row.total_pagar) },
    { header: 'Estado', key: 'estado', render: (row) => <Badge value={row.estado || 'ACTIVO'} /> },
    {
      header: 'Documento',
      key: 'estado_documental',
      render: (row) => <Badge value={row.estado_documental || 'BORRADOR'} />,
    },
    {
      header: 'Acciones',
      key: 'acciones',
      render: (row) => (
        <div className="flex gap-2">
          <button
            aria-label="Editar contrato"
            className="icon-btn"
            disabled={!canEditLoan(row)}
            onClick={() => openEdit(row)}
            title={canEditLoan(row) ? 'Editar contrato' : 'Contrato aprobado o firmado'}
            type="button"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button aria-label="Eliminar prestamo" className="icon-btn" onClick={() => remove(row)} type="button">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Prestamos</h1>
          <p className="page-subtitle">
            Crea prestamos con interes total pactado para todo el plazo. No se aplica interes compuesto.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate} type="button">
          <Plus className="h-4 w-4" />
          Nuevo prestamo
        </button>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Cargando prestamos
        </div>
      ) : (
        <DataTable columns={columns} emptyText="No hay prestamos registrados." rows={rows} />
      )}

      <Modal
        onClose={() => {
          setOpen(false)
          setEditingLoan(null)
        }}
        open={open}
        title={editingLoan ? 'Editar contrato' : 'Nuevo prestamo'}
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Cliente</span>
              <select
                className="field-input"
                {...register('cliente_id', {
                  required: requiredMessage('Cliente'),
                })}
              >
                <option value="">Seleccionar</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
              {errors.cliente_id ? <p className="field-error">{errors.cliente_id.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Aval</span>
              <select className="field-input" {...register('aval_id')}>
                <option value="">Sin aval</option>
                {avales.map((aval) => (
                  <option key={aval.id} value={aval.id}>
                    {aval.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="field-label">Monto capital</span>
              <input
                className="field-input"
                inputMode="decimal"
                type="number"
                {...register('monto', {
                  required: requiredMessage('Monto'),
                  validate: validatePositiveMoney,
                })}
              />
              {errors.monto ? <p className="field-error">{errors.monto.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Interes total pactado (%)</span>
              <input
                className="field-input"
                inputMode="decimal"
                min="0"
                step="0.01"
                type="number"
                {...register('interes_porcentaje', {
                  min: { message: 'No puede ser negativo.', value: 0 },
                  required: requiredMessage('Interes'),
                })}
              />
              {errors.interes_porcentaje ? <p className="field-error">{errors.interes_porcentaje.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Plazo meses</span>
              <input
                className="field-input"
                inputMode="numeric"
                min="1"
                type="number"
                {...register('plazo_meses', {
                  min: { message: 'El plazo minimo es 1 mes.', value: 1 },
                  required: requiredMessage('Plazo'),
                })}
              />
              {errors.plazo_meses ? <p className="field-error">{errors.plazo_meses.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Frecuencia</span>
              <select className="field-input" {...register('frecuencia')}>
                {FRECUENCIAS.map((frecuencia) => (
                  <option key={frecuencia} value={frecuencia}>
                    {frecuencia}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Fecha del contrato</span>
              <input
                className="field-input"
                type="date"
                {...register('fecha_contrato', {
                  required: requiredMessage('Fecha del contrato'),
                })}
              />
              {errors.fecha_contrato ? <p className="field-error">{errors.fecha_contrato.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Inicio de pago</span>
              <input
                className="field-input"
                type="date"
                {...register('fecha_inicio_pago', {
                  required: requiredMessage('Inicio de pago'),
                })}
              />
              {errors.fecha_inicio_pago ? <p className="field-error">{errors.fecha_inicio_pago.message}</p> : null}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                En frecuencia quincenal se usaran vencimientos los dias 1 y 16.
              </p>
            </label>

            <label className="block">
              <span className="field-label">Mora por periodo</span>
              <input
                className="field-input"
                inputMode="decimal"
                min="0"
                step="0.01"
                type="number"
                {...register('mora_periodo')}
              />
            </label>
          </div>

          <div className="surface-muted grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Capital</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">{money(calculation.monto)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Interes total</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">{money(calculation.interesTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total a pagar</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">{money(calculation.totalPagar)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cuotas</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">{calculation.cantidadCuotas}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Primera cuota</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                {formatDate(calculation.cuotas[0]?.fecha_vencimiento)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setOpen(false)
                setEditingLoan(null)
              }}
              type="button"
            >
              Cancelar
            </button>
            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingLoan ? 'Guardar cambios' : 'Crear y generar cuotas'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
