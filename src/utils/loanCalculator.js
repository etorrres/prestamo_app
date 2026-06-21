import { inputDate } from './formatters'

function cents(value) {
  return Math.round((Number(value) || 0) * 100)
}

function currencyFromCents(value) {
  return Number((value / 100).toFixed(2))
}

function addMonths(date, amount) {
  const next = new Date(date)
  const day = next.getDate()
  next.setMonth(next.getMonth() + amount)
  if (next.getDate() < day) next.setDate(0)
  return next
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function calculateLoan({ fechaInicio, frecuencia, interesPorcentaje, monto, plazoMeses }) {
  const principalCents = cents(monto)
  const interestCents = Math.round((principalCents * (Number(interesPorcentaje) || 0)) / 100)
  const totalCents = principalCents + interestCents
  const installmentsCount = frecuencia === 'QUINCENAL' ? Number(plazoMeses) * 2 : Number(plazoMeses)
  const count = Math.max(1, installmentsCount || 1)
  const basePrincipal = Math.floor(principalCents / count)
  const baseInterest = Math.floor(interestCents / count)
  let principalAccum = 0
  let interestAccum = 0
  const start = new Date(`${fechaInicio || inputDate()}T00:00:00`)

  const cuotas = Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1
    const capitalCents = isLast ? principalCents - principalAccum : basePrincipal
    const interestPartCents = isLast ? interestCents - interestAccum : baseInterest
    principalAccum += capitalCents
    interestAccum += interestPartCents
    const dueDate =
      frecuencia === 'QUINCENAL' ? addDays(start, 15 * (index + 1)) : addMonths(start, index + 1)

    return {
      capital: currencyFromCents(capitalCents),
      estado: 'PENDIENTE',
      fecha_vencimiento: inputDate(dueDate),
      interes: currencyFromCents(interestPartCents),
      numero: index + 1,
      total: currencyFromCents(capitalCents + interestPartCents),
    }
  })

  return {
    cantidadCuotas: count,
    cuotas,
    interesTotal: currencyFromCents(interestCents),
    monto: currencyFromCents(principalCents),
    totalPagar: currencyFromCents(totalCents),
  }
}

export function loanStatusFromInstallments(cuotas = []) {
  if (!cuotas.length) return 'ACTIVO'
  return cuotas.every((cuota) => cuota.estado === 'PAGADA') ? 'CANCELADO' : 'ACTIVO'
}

export function getInstallmentVisualState(cuota) {
  if (cuota.estado === 'PAGADA') return 'PAGADA'
  const today = inputDate()
  const due = String(cuota.fecha_vencimiento || '').slice(0, 10)
  if (due < today) return 'VENCIDA'
  if (due === today) return 'HOY'
  const diff = Math.ceil((new Date(`${due}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86_400_000)
  if (diff <= 3) return 'PROXIMA'
  return 'PENDIENTE'
}
