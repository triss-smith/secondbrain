import { useEffect, useRef, useState } from 'react'
import { Search, PlusSquare, Trash2 } from 'lucide-react'
import { listItems, semanticSearch, deleteItem } from '../api'
import type { Item } from '../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from '../canvas/nodeUtils'
import { ItemDetailModal } from '../components/ItemDetailModal'

interface Props {
  onAddToCanvas: (item: Item) => void
  refreshTrigger?: number
}

export function Library({ onAddToCanvas, refreshTrigger }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
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
          <LibraryItem
            key={item.id}
            item={item}
            onAdd={onAddToCanvas}
            onClick={() => setSelectedItemId(item.id)}
            onDelete={() => {
              setItems(prev => prev.filter(i => i.id !== item.id))
              deleteItem(item.id)
              window.dispatchEvent(new CustomEvent('item-deleted', { detail: { item_id: item.id } }))
            }}
          />
        ))}
        {selectedItemId && (
          <ItemDetailModal
            itemId={selectedItemId}
            onClose={() => setSelectedItemId(null)}
            onAddToCanvas={item => { onAddToCanvas(item); setSelectedItemId(null) }}
          />
        )}
      </div>
    </div>
  )
}

function LibraryItem({ item, onAdd, onClick, onDelete }: { item: Item; onAdd: (item: Item) => void; onClick: () => void; onDelete: () => void }) {
  const color = CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7'
  const Icon = CONTENT_TYPE_ICONS[item.content_type]
  const label = CONTENT_TYPE_LABELS[item.content_type]

  return (
    <div onClick={onClick} className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors group border-b border-surface-3/50 cursor-pointer">
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
        {(item.summary || item.snippet) && (
          <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
            {item.summary || item.snippet}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={e => { e.stopPropagation(); onAdd(item) }}
          className="nodrag shrink-0 text-slate-400 hover:text-accent p-1 rounded transition-colors"
          title="Add to canvas"
        >
          <PlusSquare size={14} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="nodrag shrink-0 text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
