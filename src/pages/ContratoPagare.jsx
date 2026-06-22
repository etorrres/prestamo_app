import { useEffect, useMemo, useState } from 'react'
import { Loader2, PenLine, Printer } from 'lucide-react'
import Badge from '../components/Badge'
import SignaturePad from '../components/SignaturePad'
import { useAuth } from '../context/useAuth'
import { DOCUMENT_STATUSES } from '../lib/constants'
import { loadConfiguration } from '../lib/configuration'
import { auditFields, friendlyError, selectUserRows } from '../lib/db'
import {
  amountInWords,
  dateParts,
  formatDate,
  formatIdentity,
  formatPhone,
  lempiras,
  number,
  safeText,
} from '../utils/formatters'

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
    setError('')
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

  const documentData = useMemo(() => {
    const firstInstallment = selected.cuotas[0]
    const totals = selected.cuotas.reduce(
      (acc, cuota) => ({
        capital: acc.capital + Number(cuota.capital || 0),
        interes: acc.interes + Number(cuota.interes || 0),
        total: acc.total + Number(cuota.total || 0),
      }),
      { capital: 0, interes: 0, total: 0 },
    )
    const signedAt = dateParts(selected.loan?.fecha_inicio || new Date())
    const frecuenciaTexto = selected.loan?.frecuencia === 'QUINCENAL' ? 'quincenales' : 'mensuales'

    return {
      firstInstallment,
      frecuenciaTexto,
      signedAt,
      totals,
      valorCuota: firstInstallment?.total || 0,
    }
  }, [selected.cuotas, selected.loan?.fecha_inicio, selected.loan?.frecuencia])

  const isSigned = selected.loan?.estado_documental === 'FIRMADO'

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
            Contrato privado y pagare en paginas separadas, generados desde el prestamo seleccionado.
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
            <span className="field-label">Contrato</span>
            <select className="field-input" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
              <option value="">Seleccionar contrato</option>
              {prestamos.map((loan) => {
                const cliente = clientes.find((row) => row.id === loan.cliente_id)
                return (
                  <option key={loan.id} value={loan.id}>
                    {cliente?.nombre || 'Sin cliente'} - {lempiras(loan.total_pagar)}
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
                    setAdenda(`Adenda futura para el contrato ${selected.loan.id}, emitida el ${formatDate(new Date())}.`)
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
          <SignaturePad
            disabled={isSigned || !selected.loan}
            label="Firma acreedora"
            onSave={(data) => saveSignature('acreedora', data)}
          />
          <SignaturePad
            disabled={isSigned || !selected.loan}
            label="Firma deudor"
            onSave={(data) => saveSignature('deudor', data)}
          />
          <SignaturePad disabled={isSigned || !selected.loan} label="Firma aval" onSave={(data) => saveSignature('aval', data)} />
        </div>
      </div>

      {!selected.loan ? (
        <div className="surface p-8 text-center text-sm text-slate-500">No hay contratos para generar documentos.</div>
      ) : (
        <div className="print-area space-y-8">
          <article className="legal-document legal-page">
            <DocumentHeader
              acreedora={acreedora}
              label="Contrato privado"
              title="Contrato privado de prestamo de dinero"
            />

            <section className="legal-copy">
              <p>
                Nosotros, por una parte, <strong>{safeText(acreedora?.nombre)}</strong>, mayor de edad, con identidad No.{' '}
                <strong>{formatIdentity(acreedora?.identidad)}</strong>, en adelante denominada{' '}
                <strong>LA ACREEDORA</strong>; y por otra parte,{' '}
                <strong>{safeText(selected.cliente?.nombre)}</strong>, mayor de edad, con identidad No.{' '}
                <strong>{formatIdentity(selected.cliente?.identidad)}</strong>, con domicilio en{' '}
                <strong>{safeText(selected.cliente?.direccion)}</strong>, con numero de telefono{' '}
                <strong>{formatPhone(selected.cliente?.telefono)}</strong>, en adelante denominado{' '}
                <strong>EL DEUDOR</strong>, convenimos celebrar el presente Contrato Privado de Prestamo de Dinero,
                sujeto a las siguientes clausulas:
              </p>

              <Clause title="Primera: monto del prestamo">
                LA ACREEDORA entrega en calidad de prestamo a EL DEUDOR la cantidad de{' '}
                <strong>{amountInWords(selected.loan.monto)} ({lempiras(selected.loan.monto)})</strong>, cantidad que EL
                DEUDOR declara recibir a su entera satisfaccion en la fecha de firma del presente contrato.
              </Clause>

              <Clause title="Segunda: plazo">
                El plazo del presente prestamo sera de <strong>{selected.loan.plazo_meses} meses</strong>, contados a
                partir de la fecha de firma de este contrato.
              </Clause>

              <Clause title="Tercera: interes">
                Las partes acuerdan un interes fijo de{' '}
                <strong>{number(selected.loan.interes_porcentaje)}%</strong> sobre el capital prestado, calculado de la
                siguiente manera:
              </Clause>

              <FinancialSummary loan={selected.loan} />

              <Clause title="Cuarta: forma de pago">
                EL DEUDOR se compromete a cancelar la deuda mediante{' '}
                <strong>
                  {selected.cuotas.length} cuotas {documentData.frecuenciaTexto}
                </strong>{' '}
                consecutivas de <strong>{lempiras(documentData.valorCuota)}</strong> cada una, iniciando el dia{' '}
                <strong>{formatDate(documentData.firstInstallment?.fecha_vencimiento)}</strong>. Los pagos deberan
                realizarse mediante efectivo, deposito o transferencia bancaria a la cuenta indicada por LA ACREEDORA.
              </Clause>

              <h3 className="legal-section-title">Tabla de amortizacion</h3>
              <AmortizationTable cuotas={selected.cuotas} totals={documentData.totals} />

              <Clause title="Quinta: mora">
                En caso de atraso en cualquiera de las cuotas pactadas, EL DEUDOR pagara un recargo por mora equivalente
                al <strong>{number(selected.loan.mora_periodo || 0)}%</strong> de la cuota vencida por cada periodo de
                retraso, sin perjuicio de las acciones de cobro correspondientes.
              </Clause>

              <Clause title="Sexta: vencimiento anticipado">
                La falta de pago de <strong>dos (2) cuotas consecutivas</strong> facultara a LA ACREEDORA para exigir el
                pago inmediato de la totalidad del saldo pendiente.
              </Clause>

              <Clause title="Septima: comunicaciones">
                EL DEUDOR autoriza expresamente que cualquier comunicacion relacionada con el presente prestamo pueda
                realizarse a traves de llamadas telefonicas, mensajes SMS, WhatsApp o correo electronico, utilizando los
                datos proporcionados durante la contratacion.
              </Clause>

              <Clause title="Octava: gastos de cobro">
                Todos los gastos judiciales, extrajudiciales, honorarios profesionales y demas costos derivados del
                incumplimiento seran por cuenta de EL DEUDOR.
              </Clause>

              <Clause title="Novena: domicilio y jurisdiccion">
                Para todos los efectos legales derivados de este contrato, las partes senalan como domicilio la ciudad de{' '}
                <strong>{safeText(acreedora?.ciudad, 'Tegucigalpa')}</strong>.
              </Clause>

              <p>
                Y en senal de aceptacion firman el presente documento en dos ejemplares del mismo tenor, en la ciudad de{' '}
                <strong>{safeText(acreedora?.ciudad, 'Tegucigalpa')}</strong>, a los{' '}
                <strong>{documentData.signedAt.dia}</strong> dias del mes de{' '}
                <strong>{documentData.signedAt.mes}</strong> de <strong>{documentData.signedAt.anio}</strong>.
              </p>
            </section>

            {adenda ? (
              <section className="mt-8 rounded-lg border border-slate-300 p-4 text-sm">
                <h3 className="font-bold uppercase">Adenda</h3>
                <p className="mt-2">{adenda}</p>
              </section>
            ) : null}

            <ContractSignatures acreedora={acreedora} cliente={selected.cliente} aval={selected.aval} loan={selected.loan} />
          </article>

          <article className="legal-document legal-page legal-page-break">
            <DocumentHeader acreedora={acreedora} label="Titulo ejecutivo" title="Pagare" />

            <div className="mb-8 rounded-lg border-2 border-slate-900 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Por</p>
              <p className="mt-2 text-3xl font-black tracking-normal">{lempiras(selected.loan.total_pagar)}</p>
              <p className="mt-2 text-sm font-semibold uppercase">{amountInWords(selected.loan.total_pagar)}</p>
            </div>

            <section className="legal-copy">
              <p>
                Yo, <strong>{safeText(selected.cliente?.nombre)}</strong>, mayor de edad, con identidad No.{' '}
                <strong>{formatIdentity(selected.cliente?.identidad)}</strong>, con domicilio en{' '}
                <strong>{safeText(selected.cliente?.direccion)}</strong>, por medio del presente <strong>PAGARE</strong>{' '}
                me obligo de forma incondicional e irrevocable a pagar a la orden de{' '}
                <strong>{safeText(acreedora?.nombre)}</strong>, portadora de identidad No.{' '}
                <strong>{formatIdentity(acreedora?.identidad)}</strong>, la suma de{' '}
                <strong>{amountInWords(selected.loan.total_pagar)} ({lempiras(selected.loan.total_pagar)})</strong>.
              </p>

              <p>
                Cantidad que corresponde al capital de <strong>{lempiras(selected.loan.monto)}</strong> mas los intereses
                pactados de <strong>{lempiras(selected.loan.interes_total)}</strong>.
              </p>

              <Clause title="Forma de pago">
                El pago se realizara mediante{' '}
                <strong>
                  {selected.cuotas.length} cuotas {documentData.frecuenciaTexto}
                </strong>{' '}
                de <strong>{lempiras(documentData.valorCuota)}</strong> cada una, iniciando el dia{' '}
                <strong>{formatDate(documentData.firstInstallment?.fecha_vencimiento)}</strong>.
              </Clause>

              <Clause title="Clausula de vencimiento anticipado">
                En caso de incumplimiento de dos (2) cuotas consecutivas, acepto que la totalidad del saldo pendiente se
                considere de plazo vencido y exigible de forma inmediata, obligandome ademas al pago de recargos por mora
                del <strong>{number(selected.loan.mora_periodo || 0)}%</strong> por periodo de atraso, gastos de cobro y
                honorarios profesionales.
              </Clause>

              <Clause title="Renuncia de requerimiento">
                Para todos los efectos legales, renuncio expresamente al requerimiento judicial o extrajudicial de pago y
                senalo como domicilio la ciudad de <strong>{safeText(acreedora?.ciudad, 'Tegucigalpa')}</strong>.
              </Clause>

              <p>
                Firmo el presente Pagare en la ciudad de{' '}
                <strong>{safeText(acreedora?.ciudad, 'Tegucigalpa')}</strong>, a los{' '}
                <strong>{documentData.signedAt.dia}</strong> dias del mes de{' '}
                <strong>{documentData.signedAt.mes}</strong> de <strong>{documentData.signedAt.anio}</strong>.
              </p>
            </section>

            <PagareSignatures acreedora={acreedora} cliente={selected.cliente} loan={selected.loan} />
          </article>
        </div>
      )}
    </section>
  )
}

function DocumentHeader({ acreedora, label, title }) {
  return (
    <header className="mb-8 border-b-2 border-slate-900 pb-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-normal text-slate-950">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{safeText(acreedora?.ciudad, 'Tegucigalpa')}, Honduras</p>
        </div>
        {acreedora?.logo_url ? (
          <img alt="Logo acreedora" className="h-16 max-w-36 object-contain" src={acreedora.logo_url} />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-lg border-2 border-slate-900 text-lg font-black">
            PK
          </div>
        )}
      </div>
    </header>
  )
}

function Clause({ children, title }) {
  return (
    <section>
      <h3 className="legal-clause-title">{title}</h3>
      <p>{children}</p>
    </section>
  )
}

function FinancialSummary({ loan }) {
  const rows = [
    ['Capital prestado', lempiras(loan.monto)],
    ['Interes pactado', lempiras(loan.interes_total)],
    ['Total a pagar', lempiras(loan.total_pagar)],
  ]

  return (
    <table className="legal-table max-w-xl">
      <tbody>
        {rows.map(([label, value], index) => (
          <tr className={index === rows.length - 1 ? 'font-bold' : ''} key={label}>
            <td>{label}</td>
            <td className="text-right">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AmortizationTable({ cuotas, totals }) {
  return (
    <div className="overflow-x-auto">
      <table className="legal-table text-xs">
        <thead>
          <tr>
            <th>Cuota</th>
            <th>Fecha</th>
            <th className="text-right">Capital</th>
            <th className="text-right">Interes</th>
            <th className="text-right">Cuota total</th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map((cuota) => (
            <tr key={cuota.id}>
              <td>{cuota.numero}</td>
              <td>{formatDate(cuota.fecha_vencimiento)}</td>
              <td className="text-right">{lempiras(cuota.capital)}</td>
              <td className="text-right">{lempiras(cuota.interes)}</td>
              <td className="text-right">{lempiras(cuota.total)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td>Total</td>
            <td />
            <td className="text-right">{lempiras(totals.capital)}</td>
            <td className="text-right">{lempiras(totals.interes)}</td>
            <td className="text-right">{lempiras(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ContractSignatures({ acreedora, aval, cliente, loan }) {
  return (
    <footer className="mt-14 space-y-8 text-sm">
      <div className="grid gap-8 sm:grid-cols-2">
        <SignatureBlock
          identity={formatIdentity(acreedora?.identidad)}
          image={loan.firma_acreedora_url}
          name={safeText(acreedora?.nombre)}
          title="LA ACREEDORA"
        />
        <SignatureBlock
          identity={formatIdentity(cliente?.identidad)}
          image={loan.firma_deudor_url}
          name={safeText(cliente?.nombre)}
          title="EL DEUDOR"
        />
      </div>
      <div className="mx-auto max-w-sm">
        <SignatureBlock
          identity={formatIdentity(aval?.identidad)}
          image={loan.firma_aval_url}
          name={safeText(aval?.nombre, 'NO REGISTRADO')}
          title="AVAL"
        />
      </div>
    </footer>
  )
}

function PagareSignatures({ acreedora, cliente, loan }) {
  return (
    <footer className="mt-16 grid gap-10 text-sm sm:grid-cols-2">
      <SignatureBlock
        details={[
          `Direccion: ${safeText(cliente?.direccion)}`,
          `Telefono: ${formatPhone(cliente?.telefono)}`,
        ]}
        identity={formatIdentity(cliente?.identidad)}
        image={loan.firma_deudor_url}
        name={safeText(cliente?.nombre)}
        title="EL DEUDOR"
      />
      <SignatureBlock
        identity={formatIdentity(acreedora?.identidad)}
        image={loan.firma_acreedora_url || acreedora?.firma_url}
        name={safeText(acreedora?.nombre)}
        title="RECIBIDO Y ACEPTADO POR LA ACREEDORA"
      />
    </footer>
  )
}

function SignatureBlock({ details = [], identity, image, name, title }) {
  return (
    <div className="text-center">
      <div className="mb-3 h-16">
        {image ? <img alt={`Firma ${title}`} className="mx-auto h-16 object-contain" src={image} /> : null}
      </div>
      <div className="border-t border-slate-900 pt-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em]">{title}</p>
        <p className="mt-2 font-bold">{name}</p>
        <p>Identidad: {identity}</p>
        {details.map((detail) => (
          <p key={detail}>{detail}</p>
        ))}
      </div>
    </div>
  )
}
