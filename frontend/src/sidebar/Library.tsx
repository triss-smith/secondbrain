import { useEffect, useRef, useState } from 'react'
import { Search, PlusSquare } from 'lucide-react'
import { listItems, semanticSearch } from '../api'
import type { Item } from '../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from '../canvas/nodeUtils'

interface Props {
  onAddToCanvas: (item: Item) => void
  refreshTrigger?: number
}

export function Library({ onAddToCanvas, refreshTrigger }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchItems()
  }, [refreshTrigger])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        fetchItems()
        return
      }
      setLoading(true)
      try {
        const results = await semanticSearch(query, [], 20)
        setItems(results.map(r => r.item as Item))
      } catch {
        fetchItems()
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [query])

  async function fetchItems() {
    setLoading(true)
    try {
      const data = await listItems()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-surface-3">
        <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
          <Search size={13} className="text-slate-500 shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            placeholder="Semantic search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">Loading...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">
            Nothing saved yet. Add something above.
          </div>
        )}
        {items.map(item => (
          <LibraryItem key={item.id} item={item} onAdd={onAddToCanvas} />
        ))}
      </div>
    </div>
  )
}

function LibraryItem({ item, onAdd }: { item: Item; onAdd: (item: Item) => void }) {
  const color = CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7'
  const Icon = CONTENT_TYPE_ICONS[item.content_type]
  const label = CONTENT_TYPE_LABELS[item.content_type]

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors group border-b border-surface-3/50">
      {/* Thumbnail or icon */}
      <div
        className="shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: `${color}22` }}
      >
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon size={18} style={{ color }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[9px] font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
        <p className="text-xs font-medium text-white leading-snug truncate">{item.title}</p>
        {item.summary && (
          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.summary}</p>
        )}
      </div>

      <button
        onClick={() => onAdd(item)}
        className="nodrag shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-accent p-1 rounded transition-all"
        title="Add to canvas"
      >
        <PlusSquare size={14} />
      </button>
    </div>
  )
}
