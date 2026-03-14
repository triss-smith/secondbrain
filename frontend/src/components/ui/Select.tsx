import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
}

export function Select({ label, helperText, error, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...rest}
          className={`w-full bg-surface-2 border text-white text-xs rounded-lg pl-3 pr-7 py-2 outline-none transition-colors appearance-none ${
            error ? 'border-red-500 focus:border-red-500' : 'border-surface-3 focus:border-accent'
          } ${className}`.trim()}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-slate-400">
          ▼
        </span>
      </div>
      {error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-600">{helperText}</p>
      ) : null}
    </div>
  )
}

