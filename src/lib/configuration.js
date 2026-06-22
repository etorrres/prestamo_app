import { DEFAULT_CREDITOR } from './constants'

const storageKey = 'prestamos_keydi_configuracion'

function timeValue(value) {
  const time = new Date(value || 0).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function readLocalConfiguration() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
    return { ...DEFAULT_CREDITOR, ...saved }
  } catch {
    return DEFAULT_CREDITOR
  }
}

export function saveLocalConfiguration(values) {
  localStorage.setItem(storageKey, JSON.stringify(values))
}

export async function loadConfiguration(supabase, userId) {
  const local = readLocalConfiguration()
  if (!supabase || !userId) return { data: local, source: 'local' }

  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return { data: local, source: 'local' }
  const server = { ...DEFAULT_CREDITOR, ...data }
  const merged = timeValue(local.fecha_actualizacion) > timeValue(server.fecha_actualizacion)
    ? { ...server, ...local }
    : server
  saveLocalConfiguration(merged)
  return { data: merged, source: 'supabase' }
}

export async function saveConfiguration(supabase, userId, values) {
  const payload = {
    ...values,
    fecha_actualizacion: new Date().toISOString(),
    user_id: userId,
  }
  saveLocalConfiguration(payload)

  if (!supabase || !userId) return { data: payload, source: 'local' }

  const { data, error } = await supabase
    .from('configuracion')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return { data: payload, error, source: 'local' }
  saveLocalConfiguration(data)
  return { data, source: 'supabase' }
}

export async function uploadPublicFile(supabase, userId, bucket, folder, file) {
  if (!supabase || !userId || !file) return { publicUrl: '' }
  const extension = file.name.split('.').pop() || 'bin'
  const path = `${userId}/${folder}/${Date.now()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (error) return { error }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
