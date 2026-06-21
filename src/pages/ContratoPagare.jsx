import { useEffect, useMemo, useState } from 'react'
import { Loader2, PenLine, Printer } from 'lucide-react'
import Badge from '../components/Badge'
import SignaturePad from '../components/SignaturePad'
import { useAuth } from '../context/useAuth'
import { DOCUMENT_STATUSES } from '../lib/constants'
import { loadConfiguration } from '../lib/configuration'
import { auditFields, friendlyError, selectUserRows } from '../lib/db'
import { formatDate, formatIdentity, formatPhone, money, number, safeText } from '../utils/formatters'

export default function ContratoPagare() {
  const { supabase, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [prestamos, setPrestamos] = useState([])
  const [clientes, setClientes] = useState([])
  const [avales, setAvales] = useState([])
  const [cuotas, setCuotas] = useState([])
  const [acreedora, setAcreedora] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [adenda, setAdenda] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function load() {
    setLoading(true)
    const [loanResult, clientResult, guarantorResult, installmentResult, configResult] = await Promise.all([
      selectUserRows(supabase, 'prestamos', user?.id),
      selectUserRows(supabase, 'clientes', user?.id),
      selectUserRows(supabase, 'avales', user?.id),
      selectUserRows(supabase, 'cuotas', user?.id, { order: 'numero', ascending: true }),
      loadConfiguration(supabase, user?.id),
    ])
    const loadError = loanResult.error || clientResult.error || guarantorResult.error || installmentResult.error
    if (loadError) setError(friendlyError(loadError))
    setPrestamos(loanResult.data || [])
    setClientes(clientResult.data || [])
    setAvales(guarantorResult.data || [])
    setCuotas(installmentResult.data || [])
    setAcreedora(configResult.data)
    setSelectedId((current) => current || loanResult.data?.[0]?.id || '')
    setLoading(false)
  }

  const selected = useMemo(() => {
    const loan = prestamos.find((row) => row.id === selectedId)
    const cliente = clientes.find((row) => row.id === loan?.cliente_id)
    const aval = avales.find((row) => row.id === loan?.aval_id)
    const loanCuotas = cuotas.filter((row) => row.prestamo_id === loan?.id).sort((a, b) => a.numero - b.numero)
    return { aval, cliente, cuotas: loanCuotas, loan }
  }, [avales, clientes, cuotas, prestamos, selectedId])

  const isSigned = selected.loan?.estado_documental === 'FIRMADO'
  const lastInstallment = selected.cuotas[selected.cuotas.length - 1]

  async function updateDocumentStatus(status) {
    setMessage('')
    if (!selected.loan || isSigned) return
    const { error: updateError } = await supabase
      .from('prestamos')
      .update({ ...auditFields(user.id), estado_documental: status })
      .eq('id', selected.loan.id)
      .eq('user_id', user.id)
    if (updateError) {
      setError(friendlyError(updateError))
      return
    }
    setMessage(`Documento actualizado a ${status}.`)
    await load()
  }

  async function saveSignature(type, dataUrl) {
    setMessage('')
    if (!selected.loan || !supabase || isSigned) return
    const blob = await fetch(dataUrl).then((response) => response.blob())
    const path = `${user.id}/${selected.loan.id}/${type}-${Date.now()}.png`
    const { error: uploadError } = await supabase.storage.from('firmas').upload(path, blob, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: true,
    })
    if (uploadError) {
      setError('No fue posible guardar la firma. Verifica el bucket firmas en Supabase Storage.')
      return
    }
    const { data } = supabase.storage.from('firmas').getPublicUrl(path)
    const field = `firma_${type}_url`
    const { error: updateError } = await supabase
      .from('prestamos')
      .update({ ...auditFields(user.id), [field]: data.publicUrl })
      .eq('id', selected.loan.id)
      .eq('user_id', user.id)
    if (updateError) {
      setError(friendlyError(updateError))
      return
    }
    setMessage('Firma guardada correctamente.')
    await load()
  }

  async function markSigned() {
    if (!selected.loan || isSigned) return
    const { error: updateError } = await supabase
      .from('prestamos')
      .update({ ...auditFields(user.id), estado_documental: 'FIRMADO' })
      .eq('id', selected.loan.id)
      .eq('user_id', user.id)
    if (updateError) {
      setError(friendlyError(updateError))
      return
    }
    setMessage('Documento firmado. La edicion queda bloqueada.')
    await load()
  }

  if (loading) {
    return (
      <section className="page-shell">
        <div className="surface grid place-items-center p-10 text-sm text-slate-500">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Preparando documentos
        </div>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Contrato y pagare</h1>
          <p className="page-subtitle">
            Vista previa legal generada desde datos del prestamo, cuotas y configuracion de la acreedora.
          </p>
        </div>
        <button className="btn-primary" onClick={() => window.print()} type="button">
          <Printer className="h-4 w-4" />
          Imprimir o guardar PDF
        </button>
      </div>

      {error ? <p className="no-print rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="no-print rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="no-print grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface p-4">
          <label className="block">
            <span className="field-label">Prestamo</span>
            <select className="field-input" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
              <option value="">Seleccionar prestamo</option>
              {prestamos.map((loan) => {
                const cliente = clientes.find((row) => row.id === loan.cliente_id)
                return (
                  <option key={loan.id} value={loan.id}>
                    {cliente?.nombre || 'Sin cliente'} - {money(loan.total_pagar)}
                  </option>
                )
              })}
            </select>
          </label>
          {selected.loan ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge value={selected.loan.estado_documental || 'BORRADOR'} />
              {DOCUMENT_STATUSES.filter((status) => status !== 'FIRMADO').map((status) => (
                <button
                  className="btn-secondary"
                  disabled={isSigned}
                  key={status}
                  onClick={() => updateDocumentStatus(status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
              <button className="btn-primary" disabled={isSigned} onClick={markSigned} type="button">
                <PenLine className="h-4 w-4" />
                Marcar firmado
              </button>
              {isSigned ? (
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setAdenda(`Adenda futura para el prestamo ${selected.loan.id}, emitida el ${formatDate(new Date())}.`)
                  }
                  type="button"
                >
                  Generar adenda
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <SignaturePad disabled={isSigned || !selected.loan} label="Firma acreedora" onSave={(data) => saveSignature('acreedora', data)} />
          <SignaturePad disabled={isSigned || !selected.loan} label="Firma deudor" onSave={(data) => saveSignature('deudor', data)} />
          <SignaturePad disabled={isSigned || !selected.loan} label="Firma aval" onSave={(data) => saveSignature('aval', data)} />
        </div>
      </div>

      {!selected.loan ? (
        <div className="surface p-8 text-center text-sm text-slate-500">No hay prestamos para generar documentos.</div>
      ) : (
        <div className="print-area space-y-6">
          <article className="legal-document">
            <header className="mb-8 text-center">
              {acreedora?.logo_url ? (
                <img alt="Logo acreedora" className="mx-auto mb-4 h-16 object-contain" src={acreedora.logo_url} />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-normal">Documento privado</p>
              <h2 className="mt-2 text-2xl font-bold uppercase tracking-normal">Contrato de prestamo personal</h2>
              <p className="mt-2 text-sm">Ciudad de {safeText(acreedora?.ciudad, 'Tegucigalpa')}, {formatDate(selected.loan.fecha_inicio)}</p>
            </header>

            <section className="space-y-4 text-sm leading-7">
              <p>
                Comparecen por una parte <strong>{safeText(acreedora?.nombre)}</strong>, con identidad{' '}
                <strong>{formatIdentity(acreedora?.identidad)}</strong>, en adelante LA ACREEDORA; y por otra parte{' '}
                <strong>{safeText(selected.cliente?.nombre)}</strong>, con identidad{' '}
                <strong>{formatIdentity(selected.cliente?.identidad)}</strong>, telefono{' '}
                <strong>{formatPhone(selected.cliente?.telefono)}</strong>, en adelante EL DEUDOR.
              </p>
              <p>
                Comparece como aval <strong>{safeText(selected.aval?.nombre, 'NO REGISTRADO')}</strong>, identidad{' '}
                <strong>{formatIdentity(selected.aval?.identidad)}</strong>, telefono{' '}
                <strong>{formatPhone(selected.aval?.telefono)}</strong>, quien acepta responder solidariamente por las
                obligaciones aqui descritas.
              </p>

              <h3 className="text-base font-bold uppercase">Primera: monto del prestamo</h3>
              <p>
                LA ACREEDORA entrega a EL DEUDOR la suma de <strong>{money(selected.loan.monto)}</strong>, monto que EL
                DEUDOR declara recibir a satisfaccion.
              </p>

              <h3 className="text-base font-bold uppercase">Segunda: plazo</h3>
              <p>
                El plazo pactado es de <strong>{selected.loan.plazo_meses} meses</strong>, con frecuencia de pago{' '}
                <strong>{selected.loan.frecuencia}</strong>, iniciando el {formatDate(selected.loan.fecha_inicio)} y
                finalizando el {formatDate(lastInstallment?.fecha_vencimiento)}.
              </p>

              <h3 className="text-base font-bold uppercase">Tercera: interes</h3>
              <p>
                El interes pactado es total para todo el prestamo, no compuesto, equivalente a{' '}
                <strong>{number(selected.loan.interes_porcentaje)}%</strong>, por un monto de{' '}
                <strong>{money(selected.loan.interes_total)}</strong>. El total a pagar sera{' '}
                <strong>{money(selected.loan.total_pagar)}</strong>.
              </p>

              <h3 className="text-base font-bold uppercase">Cuarta: forma de pago</h3>
              <p>
                EL DEUDOR pagara mediante cuotas {selected.loan.frecuencia.toLowerCase()}es segun la tabla de
                amortizacion. Cada cuota incluye capital e interes distribuido proporcionalmente, con ajuste de centavos
                en la ultima cuota.
              </p>

              <h3 className="text-base font-bold uppercase">Quinta: tabla de amortizacion</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">#</th>
                      <th className="border px-2 py-1 text-left">Vencimiento</th>
                      <th className="border px-2 py-1 text-right">Capital</th>
                      <th className="border px-2 py-1 text-right">Interes</th>
                      <th className="border px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.cuotas.map((cuota) => (
                      <tr key={cuota.id}>
                        <td className="border px-2 py-1">{cuota.numero}</td>
                        <td className="border px-2 py-1">{formatDate(cuota.fecha_vencimiento)}</td>
                        <td className="border px-2 py-1 text-right">{money(cuota.capital)}</td>
                        <td className="border px-2 py-1 text-right">{money(cuota.interes)}</td>
                        <td className="border px-2 py-1 text-right">{money(cuota.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold uppercase">Sexta: mora</h3>
              <p>
                La falta de pago oportuno generara mora por periodo de <strong>{money(selected.loan.mora_periodo)}</strong>,
                sin perjuicio de otros gastos de cobro documentados.
              </p>

              <h3 className="text-base font-bold uppercase">Septima: vencimiento anticipado</h3>
              <p>
                El incumplimiento de una o mas obligaciones faculta a LA ACREEDORA a exigir el saldo pendiente, intereses,
                mora y gastos aplicables.
              </p>

              <h3 className="text-base font-bold uppercase">Octava: comunicaciones</h3>
              <p>
                Las partes aceptan como validas las comunicaciones remitidas a los telefonos, correos y direcciones
                registrados en este documento.
              </p>

              <h3 className="text-base font-bold uppercase">Novena: gastos de cobro</h3>
              <p>
                EL DEUDOR y EL AVAL reconocen que los gastos razonables de cobro derivados del incumplimiento seran a su
                cargo.
              </p>

              <h3 className="text-base font-bold uppercase">Decima: domicilio y jurisdiccion</h3>
              <p>
                Para los efectos legales, las partes se someten al domicilio y jurisdiccion competente de{' '}
                {safeText(acreedora?.ciudad, 'Tegucigalpa')}, Honduras.
              </p>
            </section>

            {adenda ? (
              <section className="mt-8 rounded-lg border p-4 text-sm">
                <h3 className="font-bold uppercase">Adenda</h3>
                <p className="mt-2">{adenda}</p>
              </section>
            ) : null}

            <footer className="mt-14 grid gap-10 text-center text-sm sm:grid-cols-3">
              <div>
                {selected.loan.firma_acreedora_url ? (
                  <img alt="Firma acreedora" className="mx-auto h-16 object-contain" src={selected.loan.firma_acreedora_url} />
                ) : null}
                <div className="mt-10 border-t border-slate-900 pt-2">LA ACREEDORA</div>
              </div>
              <div>
                {selected.loan.firma_deudor_url ? (
                  <img alt="Firma deudor" className="mx-auto h-16 object-contain" src={selected.loan.firma_deudor_url} />
                ) : null}
                <div className="mt-10 border-t border-slate-900 pt-2">EL DEUDOR</div>
              </div>
              <div>
                {selected.loan.firma_aval_url ? (
                  <img alt="Firma aval" className="mx-auto h-16 object-contain" src={selected.loan.firma_aval_url} />
                ) : null}
                <div className="mt-10 border-t border-slate-900 pt-2">EL AVAL</div>
              </div>
            </footer>
          </article>

          <article className="legal-document">
            <header className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-normal">Titulo ejecutivo</p>
              <h2 className="mt-2 text-2xl font-bold uppercase tracking-normal">Pagare</h2>
            </header>
            <section className="space-y-4 text-sm leading-7">
              <p>
                Yo, <strong>{safeText(selected.cliente?.nombre)}</strong>, identidad{' '}
                <strong>{formatIdentity(selected.cliente?.identidad)}</strong>, pagare incondicionalmente a la orden de{' '}
                <strong>{safeText(acreedora?.nombre)}</strong> la cantidad de{' '}
                <strong>{money(selected.loan.total_pagar)}</strong>, correspondiente a capital e interes total pactado.
              </p>
              <p>
                El pago se realizara conforme a la tabla de amortizacion del contrato, con vencimiento final el{' '}
                <strong>{formatDate(lastInstallment?.fecha_vencimiento)}</strong>. En caso de incumplimiento, acepto el
                cobro del saldo, mora, gastos de cobro y demas obligaciones derivadas del contrato.
              </p>
              <p>
                Firma como aval solidario <strong>{safeText(selected.aval?.nombre, 'NO REGISTRADO')}</strong>, identidad{' '}
                <strong>{formatIdentity(selected.aval?.identidad)}</strong>.
              </p>
            </section>
            <footer className="mt-16 grid gap-10 text-center text-sm sm:grid-cols-2">
              <div>
                <div className="mt-14 border-t border-slate-900 pt-2">EL DEUDOR</div>
              </div>
              <div>
                <div className="mt-14 border-t border-slate-900 pt-2">EL AVAL</div>
              </div>
            </footer>
          </article>
        </div>
      )}
    </section>
  )
}
