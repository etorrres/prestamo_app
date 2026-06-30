import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { validateEmail } from '../utils/validators'

export default function Login() {
  const { hasSupabaseConfig, loading, session, supabase } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({ defaultValues: { email: '', password: '' } })

  if (!loading && session) {
    return <Navigate replace to={location.state?.from?.pathname || '/'} />
  }

  async function onSubmit(values) {
    setMessage('')
    if (!hasSupabaseConfig || !supabase) {
      setMessage('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesion.')
      return
    }
    const email = values.email.trim()

    const action =
      mode === 'register'
        ? supabase.auth.signUp({
            email,
            password: values.password,
          })
        : supabase.auth.signInWithPassword({
            email,
            password: values.password,
          })

    const { error } = await action
    if (error) {
      setMessage('No fue posible autenticar. Revisa el correo y la contrasena.')
      return
    }

    navigate(location.state?.from?.pathname || '/', { replace: true })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-slate-950 dark:text-white">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Prestamos Keydi
            </p>
            <h1 className="text-xl font-semibold">Acceso seguro</h1>
          </div>
        </div>

        <form className="surface p-5 sm:p-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {mode === 'register' ? 'Crear usuario' : 'Iniciar sesion'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accede con Supabase Auth. La sesion queda persistida en este dispositivo.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Correo</span>
              <input
                autoComplete="email"
                className="field-input"
                inputMode="email"
                type="text"
                {...register('email', {
                  required: 'El correo es obligatorio.',
                  validate: validateEmail,
                })}
              />
              {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
            </label>

            <label className="block">
              <span className="field-label">Contrasena</span>
              <input
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="field-input"
                type="password"
                {...register('password', {
                  minLength: { message: 'Usa al menos 6 caracteres.', value: 6 },
                  required: 'La contrasena es obligatoria.',
                })}
              />
              {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
            </label>
          </div>

          {message ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {message}
            </p>
          ) : null}

          <button className="btn-primary mt-5 w-full" disabled={isSubmitting || loading} type="submit">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>

          <button
            className="mt-4 w-full text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
            onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
            type="button"
          >
            {mode === 'register' ? 'Ya tengo cuenta' : 'Crear nueva cuenta'}
          </button>
        </form>
      </div>
    </main>
  )
}
