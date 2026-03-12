import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './ui/Modal'

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
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit() {
    if (!text.trim() || isLoading) return
    await onSubmit(text.trim())
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" ariaLabel="New note">
      <ModalHeader title="New Note" onClose={onClose} />
      <ModalBody>
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
      </ModalBody>
      <ModalFooter>
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
      </ModalFooter>
    </Modal>
  )
}
