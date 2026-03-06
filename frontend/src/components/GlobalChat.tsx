import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Trash2, X } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { listItems } from '../api'
import type { Item } from '../types'
import { CONTENT_TYPE_LABELS } from '../canvas/nodeUtils'

interface Props {
  onClose: () => void
}

function buildSuggestions(items: Item[]): string[] {
  const suggestions: string[] = []

  // Group by content type
  const byType: Record<string, number> = {}
  const allTags: string[] = []
  for (const item of items) {
    byType[item.content_type] = (byType[item.content_type] ?? 0) + 1
    allTags.push(...(item.tags ?? []))
  }

  // Top tags
  const tagCounts: Record<string, number> = {}
  for (const tag of allTags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

  if (topTags[0]) suggestions.push(`What have I saved about ${topTags[0]}?`)
  if (topTags[1]) suggestions.push(`Summarize everything related to ${topTags[1]}`)

  // By content type
  for (const [type, count] of Object.entries(byType)) {
    if (count > 0) {
      const label = CONTENT_TYPE_LABELS[type as keyof typeof CONTENT_TYPE_LABELS] ?? type
      suggestions.push(`What ${label.toLowerCase()}s have I saved?`)
      break
    }
  }

  // Recent item
  if (items[0]) suggestions.push(`Tell me about "${items[0].title}"`)

  return suggestions.slice(0, 4)
}

export function GlobalChat({ onClose }: Props) {
  const { messages, send, streaming, connected, error, clear } = useChat([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listItems().then(items => setSuggestions(buildSuggestions(items))).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSend() {
    const q = input.trim()
    if (!q || streaming) return
    setInput('')
    send(q)
  }

  return (
    <div className="flex flex-col h-full w-80 border-l border-surface-3 bg-surface-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3 bg-surface-2 shrink-0">
        <div>
          <p className="text-sm font-semibold text-white">Brain Chat</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            <p className="text-[10px] text-slate-500">{connected ? 'Searches across all your knowledge' : 'Connecting...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clear}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8 space-y-3">
            <p className="text-sm font-medium text-white">Ask your Second Brain</p>
            <p className="text-xs text-slate-500">Ask anything — I'll search across all your saved notes, videos, articles, and more.</p>
            {suggestions.length > 0 && (
              <div className="space-y-2 pt-2">
                {suggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="w-full text-left text-xs text-slate-400 hover:text-white bg-surface-2 hover:bg-surface-3 px-3 py-2 rounded-lg transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <span className="text-[9px] font-bold text-accent">AI</span>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : 'bg-surface-2 text-slate-200 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator — shows while waiting for first token */}
        {streaming && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <span className="text-[9px] font-bold text-accent">AI</span>
            </div>
            <div className="bg-surface-2 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-surface-3 shrink-0">
        <div className="flex items-end gap-2 bg-surface-2 rounded-xl px-3 py-2 border border-transparent focus-within:border-accent transition-colors">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none resize-none max-h-32"
            placeholder="Ask your brain anything..."
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="text-accent disabled:text-slate-600 transition-colors shrink-0 pb-0.5"
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
