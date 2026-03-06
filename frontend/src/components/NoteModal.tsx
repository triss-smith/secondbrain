import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onSubmit: (text: string) => Promise<void>
  isLoading: boolean
}

export function NoteModal({ onClose, onSubmit, isLoading }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit() {
    if (!text.trim() || isLoading) return
    await onSubmit(text.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-surface-1 border border-surface-3 rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
          <h2 className="text-sm font-semibold text-white">New Note</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) handleSubmit()
            }}
            placeholder="Write your note here..."
            className="w-full h-72 bg-surface-2 text-sm text-white placeholder-slate-500 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-accent transition-colors resize-none leading-relaxed"
            disabled={isLoading}
          />
          <p className="text-[10px] text-slate-600 mt-1.5">⌘+Enter to save</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : 'Add to Brain'}
          </button>
        </div>
      </div>
    </div>
  )
}
