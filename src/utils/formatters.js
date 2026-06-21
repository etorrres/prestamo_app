export function toUpperName(value = '') {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\s.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .toLocaleUpperCase('es-HN')
}

export function digitsOnly(value = '') {
  return String(value).replace(/\D/g, '')
}

export function formatIdentity(value = '') {
  const digits = digitsOnly(value)
  if (digits.length !== 13) return value || ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`
}

export function formatPhone(value = '') {
  const digits = digitsOnly(value)
  const local = digits.startsWith('504') ? digits.slice(3) : digits
  if (local.length !== 8) return value || ''
  return `+504 ${local.slice(0, 4)}-${local.slice(4)}`
}

export function money(value = 0) {
  return new Intl.NumberFormat('es-HN', {
    currency: 'HNL',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(Number(value) || 0)
}

export function number(value = 0) {
  return new Intl.NumberFormat('es-HN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function inputDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function safeText(value, fallback = 'No registrado') {
  const text = String(value ?? '').trim()
  return text || fallback
}
