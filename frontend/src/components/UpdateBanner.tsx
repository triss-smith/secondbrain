import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
import { getUpdateStatus, type UpdateStatus } from '../api'

const POLL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function check() {
      getUpdateStatus()
        .then(status => { if (status.available) setUpdate(status) })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  if (!update || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-accent text-white text-sm shrink-0">
      <span>
        Second Brain {update.version} is available.
      </span>
      <div className="flex items-center gap-2">
        <a
          href={update.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors font-medium"
        >
          <Download size={13} />
          Download
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
