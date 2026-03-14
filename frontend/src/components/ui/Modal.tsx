import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  ariaLabel?: string
}

export function Modal({ isOpen, onClose, children, size = 'md', ariaLabel }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidth =
    size === 'sm' ? 'max-w-md' :
    size === 'lg' ? 'max-w-3xl' :
    size === 'full' ? 'max-w-none' :
    'max-w-2xl'

  const containerClasses =
    size === 'full'
      ? 'w-full h-full rounded-none'
      : `w-full ${maxWidth} rounded-2xl`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      aria-label={ariaLabel}
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-surface-1 border border-surface-3 shadow-2xl flex flex-col ${containerClasses}`}>
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  title: string
  onClose?: () => void
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {onClose && (
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`px-5 pb-5 ${className}`}>
      <div className="flex items-center justify-end gap-2">
        {children}
      </div>
    </div>
  )
}

