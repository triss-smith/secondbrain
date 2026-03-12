import type { ConnectionType } from '../types'
import { CONNECTION_TYPES, CONNECTION_TYPE_CONFIG } from '../connectionConfig'

interface Props {
  x: number
  y: number
  onPick: (type: ConnectionType) => void
  onDismiss: () => void
}

export function ConnectionTypePicker({ x, y, onPick, onDismiss }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onDismiss} />

      {/* Picker */}
      <div
        className="fixed z-50 bg-surface-1 border border-surface-3 rounded-xl shadow-2xl p-3"
        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      >
        <p className="text-[10px] text-slate-500 mb-2 text-center font-medium uppercase tracking-wider">
          Connection type
        </p>
        <div className="flex flex-col gap-1">
          {CONNECTION_TYPES.map(t => {
            const cfg = CONNECTION_TYPE_CONFIG[t]
            return (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
            </button>
          )})}
        </div>
      </div>
    </>
  )
}
