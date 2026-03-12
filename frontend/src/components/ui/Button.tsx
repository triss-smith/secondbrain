import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses =
    variant === 'primary'
      ? 'bg-accent hover:bg-accent-hover text-white'
      : variant === 'secondary'
        ? 'border border-surface-3 text-slate-400 hover:text-white hover:border-slate-500 bg-surface-1'
        : variant === 'danger'
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'text-slate-400 hover:text-white'

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5'
      : size === 'icon'
        ? 'p-1.5'
        : 'px-5 py-2'

  return (
    <button
      className={`${base} ${variantClasses} ${sizeClasses} ${className}`.trim()}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {leftIcon && <span className="mr-1.5 flex items-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-1.5 flex items-center">{rightIcon}</span>}
    </button>
  )
}

