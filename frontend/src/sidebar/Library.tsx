import { useEffect, useRef, useState } from 'react'
import { Search, PlusSquare, Trash2, RefreshCw, ChevronRight } from 'lucide-react'

function formatLabel(label: string): string {
  return label.split(' ').map(w => w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ')
}
import { listItemsGrouped, semanticSearch, deleteItem, resummarizeItem } from '../api'
import type { Item } from '../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from '../canvas/nodeUtils'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { ItemCard } from '../components/items/ItemCard'
import { TextInput } from '../components/ui/TextInput'

interface Props {
  onAddToCanvas: (item: Item) => void
  refreshTrigger?: number
}

interface Group {
  label: string
  items: Item[]
}

export function Library({ onAddToCanvas, refreshTrigger }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [searchResults, setSearchResults] = useState<(Item & { category: string })[] | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [refreshTrigger])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setSearchResults(null)
        return
      }
      setLoading(true)
      try {
        const results = await semanticSearch(query, [], 20)
        // Attach category from groups
        const groupMap: Record<string, string> = {}
        groups.forEach(g => g.items.forEach(i => { groupMap[i.id] = g.label }))
        setSearchResults(results.map(r => ({ ...(r.item as Item), category: groupMap[r.item.id] ?? 'uncategorized' })))
      } catch {
        setSearchResults(null)
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [query, groups])

  async function fetchGroups() {
    setLoading(true)
    try {
      const data = await listItemsGrouped()
      setGroups(data)
      setCollapsed(prev => {
        const next: Record<string, boolean> = {}
        data.forEach(g => {
          // Preserve existing state; default new groups to collapsed
          next[g.label] = g.label in prev ? prev[g.label] : true
        })
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  function removeItem(itemId: string) {
    setGroups(prev => prev
      .map(g => ({ ...g, items: g.items.filter(i => i.id !== itemId) }))
      .filter(g => g.items.length > 0)
    )
    setSearchResults(prev => prev ? prev.filter(i => i.id !== itemId) : null)
    deleteItem(itemId)
    window.dispatchEvent(new CustomEvent('item-deleted', { detail: { item_id: itemId } }))
  }


  const totalItems = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-surface-3">
        <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
          <Search size={13} className="text-slate-500 shrink-0" />
          <TextInput
            className="flex-1 bg-transparent border-none px-0 py-0"
            placeholder="Semantic search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && totalItems === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">Loading...</div>
        )}
        {!loading && totalItems === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">Nothing saved yet. Add something above.</div>
        )}

        {/* Flat search results */}
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No results found.</div>
          ) : (
            searchResults.map(item => (
              <LibraryItem
                key={item.id}
                item={item}
                category={item.category}
                onAdd={onAddToCanvas}
                onClick={() => setSelectedItemId(item.id)}
                onDelete={() => removeItem(item.id)}
                onResummarize={fetchGroups}
              />
            ))
          )
        ) : (
          /* Grouped view */
          groups.map(group => (
            <div key={group.label}>
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors border-b border-surface-3/50"
              >
                <ChevronRight
                  size={12}
                  className={`text-slate-500 transition-transform shrink-0 ${collapsed[group.label] ? '' : 'rotate-90'}`}
                />
                <span className="text-[11px] font-semibold text-slate-300 flex-1 text-left">{formatLabel(group.label)}</span>
                <span className="text-[10px] text-slate-500">{group.items.length}</span>
              </button>
              {!collapsed[group.label] && group.items.map(item => (
                <LibraryItem
                  key={item.id}
                  item={item}
                  category={group.label}
                  onAdd={onAddToCanvas}
                  onClick={() => setSelectedItemId(item.id)}
                  onDelete={() => removeItem(item.id)}
                  onResummarize={fetchGroups}
                />
              ))}
            </div>
          ))
        )}

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

function LibraryItem({
  item, category, onAdd, onClick, onDelete, onResummarize
}: {
  item: Item
  category?: string
  onAdd: (item: Item) => void
  onClick: () => void
  onDelete: () => void
  onResummarize: () => void
}) {
  const color = CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7'
  const Icon = CONTENT_TYPE_ICONS[item.content_type]
  const label = CONTENT_TYPE_LABELS[item.content_type]
  const [summary, setSummary] = useState(item.summary)
  const [resummarizing, setResummarizing] = useState(false)
  const categoryLabel = category ? formatLabel(category) : undefined

  return (
    <div onClick={onClick} className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors group border-b border-surface-3/50 cursor-pointer">
      <div className="flex-1 min-w-0 overflow-hidden">
        <ItemCard
          item={{ ...item, summary: summary ?? item.summary }}
          compact
          showThumbnail
          onClick={onClick}
          categoryLabel={categoryLabel}
        />
      </div>

      <div className={`flex flex-col gap-1 shrink-0 transition-all ${resummarizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={e => { e.stopPropagation(); onAdd(item) }}
          className="nodrag shrink-0 text-slate-400 hover:text-accent p-1 rounded transition-colors"
          title="Add to canvas"
        >
          <PlusSquare size={14} />
        </button>
        <button
          onClick={async e => {
            e.stopPropagation()
            setResummarizing(true)
            try {
              const updated = await resummarizeItem(item.id)
              setSummary(updated.summary)
              onResummarize()
            } finally {
              setResummarizing(false)
            }
          }}
          disabled={resummarizing}
          className={`nodrag shrink-0 p-1 rounded transition-colors ${resummarizing ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-accent'}`}
          title="Regenerate summary & tags"
        >
          <RefreshCw size={14} className={resummarizing ? 'animate-spin' : ''} />
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
