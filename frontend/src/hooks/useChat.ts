import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_CHAT_URL } from '../api'
import type { ChatMessage } from '../types'

export function useChat(itemIds: string[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<string>('')
  const queueRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  // Keep messagesRef in sync so send() always sees latest history
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_CHAT_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        // Send any queued message
        if (queueRef.current) {
          ws.send(queueRef.current)
          queueRef.current = null
        }
      }

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

      ws.onerror = () => setError('Connection error — retrying...')

      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 2s
        setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null // prevent reconnect on intentional unmount
        ws.close()
      }
    }
  }, [])

  const send = useCallback((question: string) => {
    const payload = JSON.stringify({
      question,
      item_ids: itemIds.length > 0 ? itemIds : undefined,
      history: messagesRef.current.slice(-10),
    })

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setStreaming(true)
    setError(null)
    pendingRef.current = ''

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    } else {
      // Queue — will be sent once connection opens
      queueRef.current = payload
    }
  }, [itemIds])

  const clear = useCallback(() => setMessages([]), [])

  return { messages, send, streaming, connected, error, clear }
}
