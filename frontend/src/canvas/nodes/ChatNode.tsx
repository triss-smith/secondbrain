import { useState, useRef, useEffect } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Send, X, BookmarkPlus, Loader2 } from 'lucide-react'
import type { ChatNodeData } from '../../types'
import { useChat } from '../../hooks/useChat'

export function ChatNode({ data, id }: NodeProps<ChatNodeData>) {
  const { item_ids, title } = data
  const { messages, send, streaming, error } = useChat(item_ids)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    const event = new CustomEvent('save-as-page', {
      detail: { node_id: id, title, content },
    })
    window.dispatchEvent(event)
  }

  return (
    <div className="w-80 rounded-xl border border-surface-3 bg-surface-1 flex flex-col overflow-hidden shadow-xl">
      <Handle type="target" position={Position.Left} className="!bg-accent !border-0 !w-2 !h-2" />

      {/* Header */}
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
          <button
            className="nodrag text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
            title="Close"
            onClick={() => {
              const event = new CustomEvent('remove-chat-node', { detail: { node_id: id } })
              window.dispatchEvent(event)
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 text-center mt-6">
            Ask anything about your saved knowledge
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-slate-200'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-slate-400 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-surface-3">
        <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
          <input
            className="nodrag flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            placeholder="Ask your brain..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="text-accent disabled:text-slate-600 transition-colors"
          >
            {streaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}
