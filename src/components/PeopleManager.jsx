import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Edit3, Loader2, MessageCircle, Plus, Search, Trash2 } from 'lucide-react'
import Badge from './Badge'
import DataTable from './DataTable'
import Modal from './Modal'
import { useAuth } from '../context/useAuth'
import { deleteUserRow, friendlyError, insertUserRow, selectUserRows, updateUserRow } from '../lib/db'
import { formatIdentity, formatPhone, safeText, toUpperName } from '../utils/formatters'
import {
  normalizeIdentity,
  normalizePhone,
  requiredMessage,
  validateEmail,
  validateIdentity,
  validateName,
  validatePhone,
} from '../utils/validators'
import { openWhatsapp } from '../utils/whatsapp'

const defaultValues = {
  correo: '',
  direccion: '',
  identidad: '',
  nombre: '',
  telefono: '',
}

export default function PeopleManager({ hasEmail = false, table, title, typeLabel }) {
  const { supabase, user } = useAuth()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm({ defaultValues })

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, user?.id])

  async function loadRows() {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await selectUserRows(supabase, table, user?.id)
    if (loadError) setError(friendlyError(loadError))
    setRows(data || [])
    setLoading(false)
  }

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleUpperCase('es-HN')
    if (!needle) return rows
    return rows.filter((row) =>
      [row.nombre, row.identidad, row.telefono, row.correo, row.direccion]
        .filter(Boolean)
        .some((value) => String(value).toLocaleUpperCase('es-HN').includes(needle)),
    )
  }, [query, rows])

  function openCreate() {
    setEditing(null)
    reset(defaultValues)
    setOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    reset({
      correo: row.correo || '',
      direccion: row.direccion || '',
      identidad: row.identidad || '',
      nombre: row.nombre || '',
      telefono: row.telefono || '',
    })
    setOpen(true)
  }

  async function onSubmit(values) {
    setError('')
    const payload = {
      direccion: values.direccion?.trim() || null,
      identidad: normalizeIdentity(values.identidad),
      nombre: toUpperName(values.nombre),
      telefono: normalizePhone(values.telefono),
    }
    if (hasEmail) payload.correo = values.correo?.trim() || null

    const result = editing
      ? await updateUserRow(supabase, table, user.id, editing.id, payload)
      : await insertUserRow(supabase, table, user.id, payload)

    if (result.error) {
      setError(friendlyError(result.error))
      return
    }

    setOpen(false)
    await loadRows()
  }

  async function remove(row) {
    const confirmed = window.confirm(`Eliminar ${row.nombre}?`)
    if (!confirmed) return
    const { error: deleteError } = await deleteUserRow(supabase, table, user.id, row.id)
    if (deleteError) {
      setError(friendlyError(deleteError))
      return
    }
    await loadRows()
  }

  const columns = [
    {
      header: 'Nombre',
      key: 'nombre',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-950 dark:text-white">{row.nombre}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatIdentity(row.identidad)}</p>
        </div>
      ),
    },
    {
      header: 'Telefono',
      key: 'telefono',
      render: (row) => formatPhone(row.telefono),
    },
    ...(hasEmail
      ? [
          {
            header: 'Correo',
            key: 'correo',
            render: (row) => safeText(row.correo, 'Sin correo'),
          },
        ]
      : []),
    {
      header: 'Direccion',
      key: 'direccion',
      render: (row) => safeText(row.direccion, 'Sin direccion'),
    },
    {
      header: 'Estado',
      key: 'estado',
      render: () => <Badge value="ACTIVO">Activo</Badge>,
    },
    {
      header: 'Acciones',
      key: 'acciones',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            aria-label="Abrir WhatsApp"
            className="icon-btn"
            onClick={() => openWhatsapp(row.telefono, `Hola ${row.nombre}. Le saluda Prestamos Keydi.`)}
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button aria-label="Editar" className="icon-btn" onClick={() => openEdit(row)} type="button">
            <Edit3 className="h-4 w-4" />
          </button>
          <button aria-label="Eliminar" className="icon-btn" onClick={() => remove(row)} type="button">
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
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            Administra {typeLabel.toLocaleLowerCase('es-HN')} con identidad y telefono normalizados para Honduras.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate} type="button">
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      <div className="surface p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-input mt-0 pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, identidad, telefono o direccion"
            value={query}
          />
        </label>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Cargando registros
        </div>
      ) : (
        <DataTable columns={columns} emptyText={`No hay ${typeLabel.toLowerCase()} registrados.`} rows={filteredRows} />
      )}

      <Modal
        onClose={() => setOpen(false)}
        open={open}
        title={editing ? `Editar ${typeLabel}` : `Nuevo ${typeLabel}`}
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block">
            <span className="field-label">Nombre</span>
            <input
              className="field-input"
              onBlur={(event) => setValue('nombre', toUpperName(event.target.value), { shouldValidate: true })}
              {...register('nombre', {
                required: requiredMessage('Nombre'),
                validate: validateName,
              })}
            />
            {errors.nombre ? <p className="field-error">{errors.nombre.message}</p> : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Identidad</span>
              <input
                className="field-input"
                inputMode="numeric"
                {...register('identidad', {
                  required: requiredMessage('Identidad'),
                  validate: validateIdentity,
                })}
              />
              {errors.identidad ? <p className="field-error">{errors.identidad.message}</p> : null}
            </label>
            <label className="block">
              <span className="field-label">Telefono</span>
              <input
                className="field-input"
                inputMode="tel"
                {...register('telefono', {
                  required: requiredMessage('Telefono'),
                  validate: validatePhone,
                })}
              />
              {errors.telefono ? <p className="field-error">{errors.telefono.message}</p> : null}
            </label>
          </div>

          {hasEmail ? (
            <label className="block">
              <span className="field-label">Correo</span>
              <input
                className="field-input"
                type="email"
                {...register('correo', {
                  validate: validateEmail,
                })}
              />
              {errors.correo ? <p className="field-error">{errors.correo.message}</p> : null}
            </label>
          ) : null}

          <label className="block">
            <span className="field-label">Direccion</span>
            <textarea className="field-input min-h-24 resize-y" {...register('direccion')} />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
