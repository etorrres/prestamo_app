import { useRef, useState } from 'react'
import { Eraser, Save } from 'lucide-react'

export default function SignaturePad({ disabled, label, onSave }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  function point(event) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function start(event) {
    if (disabled) return
    drawing.current = true
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const { x, y } = point(event)
    context.beginPath()
    context.moveTo(x, y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event) {
    if (!drawing.current || disabled) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const { x, y } = point(event)
    context.lineTo(x, y)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.4
    context.strokeStyle = '#0f172a'
    context.stroke()
    setHasInk(true)
  }

  function stop() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  function save() {
    if (!hasInk || disabled) return
    onSave?.(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div className="surface-muted p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
        <div className="flex gap-2">
          <button aria-label="Limpiar firma" className="icon-btn" disabled={disabled} onClick={clear} type="button">
            <Eraser className="h-4 w-4" />
          </button>
          <button aria-label="Guardar firma" className="icon-btn" disabled={!hasInk || disabled} onClick={save} type="button">
            <Save className="h-4 w-4" />
          </button>
        </div>
      </div>
      <canvas
        className="signature-canvas h-36 w-full rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-700"
        height="220"
        onPointerCancel={stop}
        onPointerDown={start}
        onPointerLeave={stop}
        onPointerMove={move}
        onPointerUp={stop}
        ref={canvasRef}
        width="640"
      />
    </div>
  )
}
