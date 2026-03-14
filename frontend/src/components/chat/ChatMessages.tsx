import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../../types'

interface Props {
  messages: ChatMessage[]
  streaming: boolean
  error: string | null
  bottomRef: React.RefObject<HTMLDivElement>
}

export function ChatMessages({ messages, streaming, error, bottomRef }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            {msg.role === 'assistant'
              ? (
                <div className="prose prose-invert prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )
              : msg.content}
          </div>
        </div>
      ))}

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
  )
}

