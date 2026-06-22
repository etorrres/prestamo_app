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

export function lempiras(value = 0) {
  return `L ${number(value)}`
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

export function dateParts(value) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return {
    anio: date.getFullYear(),
    dia: date.getDate(),
    mes: new Intl.DateTimeFormat('es-HN', { month: 'long' }).format(date),
  }
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

const units = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
]
const specials = {
  10: 'diez',
  11: 'once',
  12: 'doce',
  13: 'trece',
  14: 'catorce',
  15: 'quince',
}
const tens = {
  20: 'veinte',
  30: 'treinta',
  40: 'cuarenta',
  50: 'cincuenta',
  60: 'sesenta',
  70: 'setenta',
  80: 'ochenta',
  90: 'noventa',
}
const hundreds = {
  100: 'cien',
  200: 'doscientos',
  300: 'trescientos',
  400: 'cuatrocientos',
  500: 'quinientos',
  600: 'seiscientos',
  700: 'setecientos',
  800: 'ochocientos',
  900: 'novecientos',
}

function integerToSpanish(value) {
  const n = Math.trunc(Number(value) || 0)
  if (n < 10) return units[n]
  if (specials[n]) return specials[n]
  if (n < 20) return `dieci${units[n - 10]}`
  if (n === 20) return 'veinte'
  if (n < 30) return `veinti${units[n - 20]}`
  if (n < 100) {
    const ten = Math.floor(n / 10) * 10
    const rest = n % 10
    return rest ? `${tens[ten]} y ${units[rest]}` : tens[ten]
  }
  if (n === 100) return hundreds[100]
  if (n < 1000) {
    const hundred = Math.floor(n / 100) * 100
    const rest = n % 100
    const prefix = hundred === 100 ? 'ciento' : hundreds[hundred]
    return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix
  }
  if (n < 1_000_000) {
    const thousand = Math.floor(n / 1000)
    const rest = n % 1000
    const prefix = thousand === 1 ? 'mil' : `${integerToSpanish(thousand)} mil`
    return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix
  }
  const million = Math.floor(n / 1_000_000)
  const rest = n % 1_000_000
  const prefix = million === 1 ? 'un millon' : `${integerToSpanish(million)} millones`
  return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix
}

export function amountInWords(value = 0) {
  const amount = Math.round((Number(value) || 0) * 100)
  const whole = Math.floor(amount / 100)
  const cents = amount % 100
  const currency = whole === 1 ? 'LEMPIRA' : 'LEMPIRAS'
  const centText = cents ? ` CON ${String(cents).padStart(2, '0')}/100` : ' EXACTOS'
  const words = integerToSpanish(whole).replace(/uno$/, 'un')
  return `${words.toLocaleUpperCase('es-HN')} ${currency}${centText}`
}
