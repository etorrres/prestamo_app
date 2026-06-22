import { formatDate, formatPhone, money, safeText } from './formatters'

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

export function paymentReceiptMessage({
  acreedora,
  cliente,
  cuota,
  fecha,
  metodo,
  monto,
  prestamo,
  saldoAnterior,
  saldoPendiente,
}) {
  const loanNumber = prestamo.numero || String(prestamo.id || '').slice(0, 8).toLocaleUpperCase('es-HN')

  return [
    '*COMPROBANTE DE PAGO*',
    '',
    `Cliente: *${safeText(cliente.nombre)}*`,
    `Numero de prestamo: *${loanNumber || 'N/D'}*`,
    `Cuota pagada: *#${cuota.numero || 'N/D'}*`,
    `Fecha de pago: *${formatDate(fecha)}*`,
    `Metodo de pago: *${safeText(metodo)}*`,
    `Monto pagado: *${money(monto)}*`,
    `Saldo anterior: *${money(saldoAnterior)}*`,
    `Saldo pendiente: *${money(saldoPendiente)}*`,
    `Acreedora: *${safeText(acreedora?.nombre)}*`,
    '',
    'Gracias por su pago. Conservamos este comprobante como constancia del abono registrado.',
  ].join('\n')
}
