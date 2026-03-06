import { useState } from 'react'
import { ingestFile, ingestText, ingestUrl } from '../api'
import type { Item } from '../types'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function useIngest(onSuccess?: (item: Item) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(input: string | File) {
    setStatus('loading')
    setError(null)
    try {
      let item: Item
      if (input instanceof File) {
        item = await ingestFile(input)
      } else if (isUrl(input)) {
        item = await ingestUrl(input)
      } else {
        item = await ingestText(input)
      }
      setStatus('success')
      onSuccess?.(item)
      return item
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ingestion failed'
      setError(msg)
      setStatus('error')
      return null
    }
  }

  return { submit, status, error, isLoading: status === 'loading' }
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim())
}
