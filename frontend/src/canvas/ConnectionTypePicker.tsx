import type { ConnectionType } from '../types'

const TYPE_COLORS: Record<ConnectionType, string> = {
  related: '#60a5fa',
  source: '#34d399',
  inspired_by: '#f59e0b',
  contradicts: '#f87171',
}

const TYPE_LABELS: Record<ConnectionType, string> = {
  related: 'Related',
  source: 'Source',
  inspired_by: 'Inspired by',
  contradicts: 'Contradicts',
}

const CONNECTION_TYPES: ConnectionType[] = ['related', 'source', 'inspired_by', 'contradicts']

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
          {CONNECTION_TYPES.map(t => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[t] }} />
              <span className="text-xs font-medium" style={{ color: TYPE_COLORS[t] }}>{TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
