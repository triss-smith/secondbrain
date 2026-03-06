import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_CHAT_URL } from '../api'
import type { ChatMessage } from '../types'

export function useChat(itemIds: string[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<string>('')

  useEffect(() => {
    const ws = new WebSocket(WS_CHAT_URL)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.token) {
        pendingRef.current += data.token
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: pendingRef.current }
          } else {
            updated.push({ role: 'assistant', content: pendingRef.current })
          }
          return updated
        })
      } else if (data.done) {
        setStreaming(false)
        pendingRef.current = ''
      } else if (data.error) {
        setError(data.error)
        setStreaming(false)
      }
    }

    ws.onerror = () => setError('WebSocket connection error')

    return () => ws.close()
  }, [])

  const send = useCallback(
    (question: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected')
        return
      }
      const userMessage: ChatMessage = { role: 'user', content: question }
      setMessages(prev => [...prev, userMessage])
      setStreaming(true)
      setError(null)
      pendingRef.current = ''

      wsRef.current.send(
        JSON.stringify({
          question,
          item_ids: itemIds.length > 0 ? itemIds : undefined,
          history: messages.slice(-10),
        })
      )
    },
    [itemIds, messages]
  )

  const clear = useCallback(() => setMessages([]), [])

  return { messages, send, streaming, error, clear }
}
