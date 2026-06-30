import { digitsOnly, toUpperName } from './formatters'

const emailRegex =
  /^(?!.*\.\.)[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+$/u

export function normalizeIdentity(value = '') {
  const digits = digitsOnly(value)
  return digits.length === 13 ? digits : ''
}

export function validateIdentity(value = '') {
  return digitsOnly(value).length === 13 || 'La identidad debe tener 13 digitos.'
}

export function normalizePhone(value = '') {
  const digits = digitsOnly(value)
  if (digits.length === 8) return `504${digits}`
  if (digits.length === 11 && digits.startsWith('504')) return digits
  return ''
}

export function validatePhone(value = '') {
  const normalized = normalizePhone(value)
  if (!normalized) return 'Telefono hondureno invalido.'
  if (!normalized.startsWith('504')) return 'El telefono debe usar codigo 504.'
  return normalized.slice(3).length === 8 || 'El numero local debe tener 8 digitos.'
}

export function validateEmail(value = '') {
  if (!value) return true
  return emailRegex.test(String(value).trim()) || 'Correo invalido.'
}

export function validateName(value = '') {
  const normalized = toUpperName(value)
  if (normalized.length < 3) return 'Ingresa un nombre valido.'
  return /^[\p{L}\s.'-]+$/u.test(normalized) || 'Solo letras, espacios, tildes y n.'
}

export function requiredMessage(label) {
  return `${label} es obligatorio.`
}

export function validatePositiveMoney(value) {
  return Number(value) > 0 || 'El monto debe ser mayor que cero.'
}

export function sanitizePersonPayload(values, userId) {
  return {
    correo: values.correo?.trim() || null,
    direccion: values.direccion?.trim() || null,
    fecha_actualizacion: new Date().toISOString(),
    identidad: normalizeIdentity(values.identidad),
    nombre: toUpperName(values.nombre),
    telefono: normalizePhone(values.telefono),
    user_id: userId,
  }
}
