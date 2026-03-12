import type { InputHTMLAttributes } from 'react'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
}

export function TextInput({ label, helperText, error, className = '', ...rest }: TextInputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-slate-400">
          {label}
        </label>
      )}
      <input
        {...rest}
        className={`w-full bg-surface-2 border text-white text-xs rounded-lg px-3 py-2 outline-none transition-colors placeholder-slate-600 ${
          error ? 'border-red-500 focus:border-red-500' : 'border-surface-3 focus:border-accent'
        } ${className}`.trim()}
      />
      {error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-600">{helperText}</p>
      ) : null}
    </div>
  )
}

