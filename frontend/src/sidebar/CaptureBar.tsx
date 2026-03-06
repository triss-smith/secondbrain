import { useRef, useState } from 'react'
import { Link2, FileUp, Loader2, StickyNote, X } from 'lucide-react'
import { useIngest } from '../hooks/useIngest'
import { NoteModal } from '../components/NoteModal'
import type { Item } from '../types'

interface Props {
  onIngested: (item: Item) => void
}

export function CaptureBar({ onIngested }: Props) {
  const [input, setInput] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { submit, isLoading, error } = useIngest(item => {
    setInput('')
    onIngested(item)
  })

  async function handleSubmit() {
    if (!input.trim()) return
    await submit(input.trim())
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await submit(file)
    e.target.value = ''
  }

  return (
    <div className="p-3 border-t border-surface-3">
      {error && (
        <div className="mb-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="line-clamp-2">{error}</span>
          <X size={12} className="ml-2 shrink-0" />
        </div>
      )}

      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setNoteOpen(true)}
          className="flex-1 text-[11px] py-1 rounded-lg bg-surface-2 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
        >
          <StickyNote size={11} /> Note
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 text-[11px] py-1 rounded-lg bg-surface-2 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
        >
          <FileUp size={11} /> File
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFile} />

      <input
        className="w-full bg-surface-2 text-xs text-white placeholder-slate-500 rounded-lg px-3 py-2 outline-none border border-transparent focus:border-accent transition-colors"
        placeholder="Paste a YouTube, TikTok, article URL..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={isLoading}
      />

      <button
        onClick={handleSubmit}
        disabled={isLoading || !input.trim()}
        className="mt-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? <><Loader2 size={12} className="animate-spin" /> Processing...</> : 'Add to Brain'}
      </button>

      {noteOpen && (
        <NoteModal
          onClose={() => setNoteOpen(false)}
          onSubmit={text => submit(text)}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
