import { inputDate } from './formatters'

function cents(value) {
  return Math.round((Number(value) || 0) * 100)
}

function currencyFromCents(value) {
  return Number((value / 100).toFixed(2))
}

function distributeCents(totalCents, count, preferWhole = true) {
  if (preferWhole && totalCents % 100 === 0) {
    const totalWhole = totalCents / 100
    const baseWhole = Math.floor(totalWhole / count)
    const remainingWhole = totalWhole % count
    return Array.from({ length: count }, (_, index) => (baseWhole + (index < remainingWhole ? 1 : 0)) * 100)
  }

  const base = Math.floor(totalCents / count)
  const remaining = totalCents % count
  return Array.from({ length: count }, (_, index) => base + (index < remaining ? 1 : 0))
}

function distributeWithinLimits(totalCents, limits) {
  const parts = distributeCents(totalCents, limits.length)
  let pending = 0

  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] > limits[index]) {
      pending += parts[index] - limits[index]
      parts[index] = limits[index]
    }
  }

  let index = 0
  let guard = 0
  while (pending > 0 && guard < parts.length * 4) {
    const capacity = limits[index] - parts[index]
    const amount = Math.min(capacity, pending)
    if (amount > 0) {
      parts[index] += amount
      pending -= amount
    }
    index = (index + 1) % parts.length
    guard += 1
  }

  return parts
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
  const totalParts = distributeCents(totalCents, count)
  const interestParts = distributeWithinLimits(interestCents, totalParts)
  const start = new Date(`${fechaInicio || inputDate()}T00:00:00`)

  const cuotas = Array.from({ length: count }, (_, index) => {
    const totalPartCents = totalParts[index]
    const interestPartCents = interestParts[index]
    const capitalCents = totalPartCents - interestPartCents
    const dueDate =
      frecuencia === 'QUINCENAL' ? addDays(start, 15 * (index + 1)) : addMonths(start, index + 1)

    return {
      capital: currencyFromCents(capitalCents),
      estado: 'PENDIENTE',
      fecha_vencimiento: inputDate(dueDate),
      interes: currencyFromCents(interestPartCents),
      numero: index + 1,
      total: currencyFromCents(totalPartCents),
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
