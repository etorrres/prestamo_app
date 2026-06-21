export function friendlyError(error) {
  if (!error) return ''
  return 'No se pudo completar la operacion. Verifica la conexion y las migraciones SQL.'
}

export function auditFields(userId, includeCreation = false) {
  const now = new Date().toISOString()
  return {
    ...(includeCreation ? { fecha_creacion: now } : {}),
    fecha_actualizacion: now,
    user_id: userId,
  }
}

export async function selectUserRows(supabase, table, userId, options = {}) {
  const { ascending = false, order = 'fecha_creacion', select = '*' } = options
  if (!supabase || !userId) return { data: [], error: null }

  let query = supabase.from(table).select(select).eq('user_id', userId)
  if (order) query = query.order(order, { ascending })
  return query
}

export async function insertUserRow(supabase, table, userId, payload) {
  return supabase
    .from(table)
    .insert({ ...payload, ...auditFields(userId, true) })
    .select()
    .single()
}

export async function updateUserRow(supabase, table, userId, id, payload) {
  return supabase
    .from(table)
    .update({ ...payload, ...auditFields(userId) })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
}

export async function deleteUserRow(supabase, table, userId, id) {
  return supabase.from(table).delete().eq('id', id).eq('user_id', userId)
}
