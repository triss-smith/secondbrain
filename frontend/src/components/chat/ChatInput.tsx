import { Loader2, Send } from 'lucide-react'
import { TextareaHTMLAttributes, useRef } from 'react'

interface Props {
  value?: string
  onChange?: (v: string) => void
  onSend: () => void
  streaming: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function ChatInput({
  value,
  onChange,
  onSend,
  streaming,
  placeholder = 'Ask your brain anything...',
  className = '',
  autoFocus = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const text = value ?? ''

  const handleKeyDown: TextareaHTMLAttributes<HTMLTextAreaElement>['onKeyDown'] = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleChange: TextareaHTMLAttributes<HTMLTextAreaElement>['onChange'] = e => {
    onChange?.(e.target.value)
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }

  return (
    <div className={`p-3 border-t border-surface-3 shrink-0 ${className}`}>
      <div className="flex items-end gap-2 bg-surface-2 rounded-xl px-3 py-2 border border-transparent focus-within:border-accent transition-colors">
        <textarea
          ref={ref}
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none resize-none max-h-32"
          placeholder={placeholder}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
        <button
          onClick={onSend}
          disabled={streaming || !text.trim()}
          className="text-accent disabled:text-slate-600 transition-colors shrink-0 pb-0.5"
        >
          {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-slate-600 text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
    </div>
  )
}

