import { X } from 'lucide-react'

export default function Modal({ children, onClose, open, title }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex min-h-svh items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[94svh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl dark:bg-slate-950 sm:max-w-3xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          <button aria-label="Cerrar" className="icon-btn" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
