import { useEffect, useState } from 'react'
import { X, ExternalLink, PlusSquare } from 'lucide-react'
import { getItem } from '../api'
import type { Item } from '../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_LABELS } from '../canvas/nodeUtils'

interface Props {
  itemId: string
  onClose: () => void
  onAddToCanvas: (item: Item) => void
}

export function ItemDetailModal({ itemId, onClose, onAddToCanvas }: Props) {
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getItem(itemId).then(data => {
      setItem(data)
      setLoading(false)
    })
  }, [itemId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = item ? (CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7') : '#7c6af7'
  const label = item ? CONTENT_TYPE_LABELS[item.content_type] : ''

  // Strip ingest header lines for clean display
  function cleanContent(raw: string): string {
    const lines = raw.split('\n')
    const headerKeys = ['Title:', 'Channel:', 'Author:', 'URL:', 'Transcript:', 'Creator:', 'Podcast:', 'Caption/Description:', 'Caption:']
    const firstNonHeader = lines.findIndex(l => !headerKeys.some(k => l.startsWith(k)) && l.trim() !== '')
    return lines.slice(firstNonHeader).join('\n').trim()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[85vh] bg-surface-1 border border-surface-3 rounded-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-surface-3">
          <div className="flex-1 min-w-0 pr-4">
            {loading ? (
              <div className="h-5 w-48 bg-surface-3 rounded animate-pulse" />
            ) : (
              <>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 inline-block"
                  style={{ background: `${color}33`, color }}
                >
                  {label}
                </span>
                <h2 className="text-base font-bold text-white leading-snug mt-1">{item?.title}</h2>
                {item?.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item && (
              <button
                onClick={() => { onAddToCanvas(item); onClose() }}
                className="text-slate-400 hover:text-accent p-1.5 rounded-lg transition-colors"
                title="Add to canvas"
              >
                <PlusSquare size={16} />
              </button>
            )}
            {item?.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
                title="Open source"
              >
                <ExternalLink size={16} />
              </a>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Summary */}
        {item?.summary && (
          <div className="px-5 py-3 border-b border-surface-3 bg-surface-2">
            <p className="text-xs text-slate-300 leading-relaxed italic">{item.summary}</p>
          </div>
        )}

        {/* Full content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 bg-surface-3 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
              ))}
            </div>
          ) : (
            <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {item ? cleanContent(item.content ?? '') : ''}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
