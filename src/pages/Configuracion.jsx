import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Loader2, Save, Upload } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { loadConfiguration, saveConfiguration, uploadPublicFile } from '../lib/configuration'
import { formatIdentity, toUpperName } from '../utils/formatters'
import { normalizeIdentity, normalizePhone, validateEmail, validateIdentity, validateName, validatePhone } from '../utils/validators'

export default function Configuracion() {
  const { supabase, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    control,
  } = useForm()
  const logoUrl = useWatch({ control, name: 'logo_url' })
  const firmaUrl = useWatch({ control, name: 'firma_url' })
  const identidad = useWatch({ control, name: 'identidad' })

  useEffect(() => {
    async function load() {
      const { data, source } = await loadConfiguration(supabase, user?.id)
      reset(data)
      setMessage(source === 'local' ? 'Usando configuracion local hasta aplicar la migracion SQL.' : '')
      setLoading(false)
    }
    load()
  }, [reset, supabase, user?.id])

  async function onSubmit(values) {
    setMessage('')
    const payload = {
      ciudad: values.ciudad?.trim() || '',
      correo: values.correo?.trim() || '',
      cuenta_bancaria: values.cuenta_bancaria?.trim() || '',
      direccion: values.direccion?.trim() || '',
      firma_url: values.firma_url?.trim() || '',
      identidad: normalizeIdentity(values.identidad),
      logo_url: values.logo_url?.trim() || '',
      nombre: toUpperName(values.nombre),
      telefono: values.telefono ? normalizePhone(values.telefono) : '',
    }
    const { source } = await saveConfiguration(supabase, user?.id, payload)
    reset(payload)
    setMessage(source === 'supabase' ? 'Configuracion guardada.' : 'Configuracion guardada localmente.')
  }

  async function handleFile(field, folder, file) {
    if (!file) return
    setUploading(field)
    const { publicUrl, error } = await uploadPublicFile(supabase, user?.id, 'documentos', folder, file)
    if (error || !publicUrl) {
      setMessage('No fue posible subir el archivo. Verifica el bucket documentos en Supabase Storage.')
    } else {
      setValue(field, publicUrl, { shouldDirty: true })
      setMessage('Archivo cargado correctamente.')
    }
    setUploading('')
  }

  if (loading) {
    return (
      <section className="page-shell">
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Cargando configuracion
        </div>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuracion</h1>
          <p className="page-subtitle">
            Datos de la acreedora usados en documentos, recordatorios y vistas legales.
          </p>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      <form className="surface grid gap-5 p-4 sm:p-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="field-label">Nombre de acreedora</span>
            <input
              className="field-input"
              onBlur={(event) => setValue('nombre', toUpperName(event.target.value), { shouldValidate: true })}
              {...register('nombre', { required: true, validate: validateName })}
            />
            {errors.nombre ? <p className="field-error">Ingresa un nombre valido.</p> : null}
          </label>

          <label className="block">
            <span className="field-label">Identidad</span>
            <input className="field-input" inputMode="numeric" {...register('identidad', { validate: validateIdentity })} />
            {errors.identidad ? <p className="field-error">{errors.identidad.message}</p> : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatIdentity(identidad)}</p>
          </label>

          <label className="block">
            <span className="field-label">Telefono</span>
            <input className="field-input" inputMode="tel" {...register('telefono', { validate: (value) => !value || validatePhone(value) })} />
            {errors.telefono ? <p className="field-error">{errors.telefono.message}</p> : null}
          </label>

          <label className="block">
            <span className="field-label">Ciudad</span>
            <input className="field-input" {...register('ciudad')} />
          </label>

          <label className="block">
            <span className="field-label">Correo</span>
            <input className="field-input" type="email" {...register('correo', { validate: validateEmail })} />
            {errors.correo ? <p className="field-error">{errors.correo.message}</p> : null}
          </label>

          <label className="block md:col-span-2">
            <span className="field-label">Direccion</span>
            <textarea className="field-input min-h-24 resize-y" {...register('direccion')} />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label">Cuenta bancaria</span>
            <input className="field-input" {...register('cuenta_bancaria')} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface-muted p-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Logo</p>
            {logoUrl ? <img alt="Logo" className="mt-3 h-20 max-w-full rounded-lg object-contain" src={logoUrl} /> : null}
            <input className="field-input" {...register('logo_url')} placeholder="URL del logo" />
            <label className="btn-secondary mt-3 w-full cursor-pointer">
              {uploading === 'logo_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir logo
              <input
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleFile('logo_url', 'logo', event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>

          <div className="surface-muted p-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Firma digital opcional</p>
            {firmaUrl ? <img alt="Firma" className="mt-3 h-20 max-w-full rounded-lg bg-white object-contain" src={firmaUrl} /> : null}
            <input className="field-input" {...register('firma_url')} placeholder="URL de firma" />
            <label className="btn-secondary mt-3 w-full cursor-pointer">
              {uploading === 'firma_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir firma
              <input
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleFile('firma_url', 'firma-acreedora', event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuracion
          </button>
        </div>
      </form>
    </section>
  )
}
