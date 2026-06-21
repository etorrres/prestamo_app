import { formatDate, formatPhone, money } from './formatters'

export function whatsappUrl(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '')
  const hondurasPhone = digits.startsWith('504') ? digits : `504${digits}`
  return `https://wa.me/${hondurasPhone}?text=${encodeURIComponent(message)}`
}

export function openWhatsapp(phone, message) {
  window.open(whatsappUrl(phone, message), '_blank', 'noopener,noreferrer')
}

export function preventiveReminder({ acreedora, cliente, cuota }) {
  return `Hola ${cliente.nombre}. Le saluda ${acreedora.nombre}. Le recordamos que su cuota ${cuota.numero} por ${money(cuota.total)} vence el ${formatDate(cuota.fecha_vencimiento)}. Telefono registrado: ${formatPhone(cliente.telefono)}.`
}

export function overdueReminder({ acreedora, cliente, cuota }) {
  return `Hola ${cliente.nombre}. Su cuota ${cuota.numero} por ${money(cuota.total)} se encuentra vencida desde el ${formatDate(cuota.fecha_vencimiento)}. Favor comunicarse con ${acreedora.nombre} para regularizar el pago.`
}
