import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from 'reactflow'
import { X, BookmarkPlus, Maximize2 } from 'lucide-react'
import type { ChatNodeData } from '../../types'
import { useChat } from '../../hooks/useChat'
import { ChatMessages } from '../../components/chat/ChatMessages'
import { ChatInput } from '../../components/chat/ChatInput'

export function ChatNode({ data, id }: NodeProps<ChatNodeData>) {
  const { item_ids, title } = data
  const { messages, send, streaming, error } = useChat(item_ids)
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const modalBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    modalBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const q = input.trim()
    if (!q || streaming) return
    setInput('')
    send(q)
  }

  function handleSaveAsPage() {
    const content = messages
      .map(m => `**${m.role === 'user' ? 'You' : 'AI'}:** ${m.content}`)
      .join('\n\n')
    window.dispatchEvent(new CustomEvent('save-as-page', { detail: { node_id: id, title, content } }))
  }

  const header = (onExpand?: () => void, onClose?: () => void) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-surface-3 bg-surface-2">
      <div>
        <p className="text-xs font-semibold text-white">{title || 'Chat'}</p>
        {item_ids.length > 0 && (
          <p className="text-[10px] text-slate-500">{item_ids.length} source{item_ids.length > 1 ? 's' : ''}</p>
        )}
      </div>
      <div className="flex gap-1">
        <button
          className="nodrag text-slate-400 hover:text-accent p-1 rounded transition-colors"
          title="Save conversation as Page"
          onClick={handleSaveAsPage}
        >
          <BookmarkPlus size={13} />
        </button>
        {onExpand && (
          <button
            className="nodrag text-slate-400 hover:text-accent p-1 rounded transition-colors"
            title="Expand"
            onClick={onExpand}
          >
            <Maximize2 size={13} />
          </button>
        )}
        {onClose && (
          <button
            className="nodrag text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
            title="Close"
            onClick={onClose}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="w-80 rounded-xl border border-surface-3 bg-surface-1 flex flex-col overflow-hidden shadow-xl">
        <Handle type="target" position={Position.Left} className="!bg-accent !border-0 !w-2 !h-2" />
        {header(
          () => setExpanded(true),
          () => window.dispatchEvent(new CustomEvent('remove-chat-node', { detail: { node_id: id } }))
        )}
        <ChatMessages
          messages={messages}
          streaming={streaming}
          error={error}
          bottomRef={bottomRef}
          className="min-h-[200px] max-h-[320px]"
        />
        <ChatInput value={input} onChange={setInput} onSend={handleSend} streaming={streaming} />
      </div>

      {expanded && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setExpanded(false)}
        >
          <div className="w-full max-w-2xl h-[70vh] bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {header(undefined, () => setExpanded(false))}
            <ChatMessages
              messages={messages}
              streaming={streaming}
              error={error}
              bottomRef={modalBottomRef}
              className="flex-1"
            />
            <ChatInput value={input} onChange={setInput} onSend={handleSend} streaming={streaming} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
