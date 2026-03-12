import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { ExternalLink, Trash2, MessageSquarePlus, RefreshCw } from 'lucide-react'
import type { SourceNodeData } from '../../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from '../nodeUtils'
import { resummarizeItem } from '../../api'

export function SourceNode({ data, selected }: NodeProps<SourceNodeData>) {
  const { item } = data
  const [summary, setSummary] = useState(item.summary)
  const [tags, setTags] = useState(item.tags)
  const [resummarizing, setResummarizing] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const color = CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7'
  const Icon = CONTENT_TYPE_ICONS[item.content_type]
  const label = CONTENT_TYPE_LABELS[item.content_type]

  return (
    <div
      className={`w-56 rounded-xl overflow-hidden border transition-all cursor-pointer ${
        selected ? 'border-accent shadow-lg shadow-accent/20' : 'border-surface-3'
      } bg-surface-1`}
      onClick={() => window.dispatchEvent(new CustomEvent('open-item-detail', { detail: { item_id: item.id } }))}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent !border-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-accent !border-0 !w-2 !h-2" />

      {/* Thumbnail */}
      {item.thumbnail && !thumbnailError ? (
        <img
          src={item.thumbnail}
          alt=""
          className="w-full h-32 object-cover"
          onError={() => setThumbnailError(true)}
        />
      ) : (
        <div className="w-full h-20 flex items-center justify-center" style={{ background: `${color}22` }}>
          {Icon && <Icon size={32} style={{ color }} />}
        </div>
      )}

      <div className="p-3">
        {/* Type badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${color}33`, color }}
          >
            {label}
          </span>
          {tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-slate-400">
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1">{item.title}</p>

        {/* Summary or snippet */}
        {(summary || item.snippet) && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-2">{summary || item.snippet}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-3" onClick={e => e.stopPropagation()}>
          <button
            className="nodrag text-slate-400 hover:text-accent transition-colors p-1 rounded disabled:opacity-40"
            title="Regenerate summary & tags"
            disabled={resummarizing}
            onClick={async () => {
              setResummarizing(true)
              try {
                const updated = await resummarizeItem(item.id)
                setSummary(updated.summary)
                setTags(updated.tags)
              } finally {
                setResummarizing(false)
              }
            }}
          >
            <RefreshCw size={13} className={resummarizing ? 'animate-spin' : ''} />
          </button>
          <button
            className="nodrag text-slate-400 hover:text-accent transition-colors p-1 rounded"
            title="Chat with this item"
            onClick={() => {
              // Dispatch custom event — Board listens and opens a ChatNode
              const event = new CustomEvent('open-chat', { detail: { item_id: item.id } })
              window.dispatchEvent(event)
            }}
          >
            <MessageSquarePlus size={13} />
          </button>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="nodrag text-slate-400 hover:text-white transition-colors p-1 rounded"
              title="Open source"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            className="nodrag ml-auto text-slate-500 hover:text-red-400 transition-colors p-1 rounded"
            title="Remove from canvas"
            onClick={() => {
              const event = new CustomEvent('remove-node', { detail: { item_id: item.id } })
              window.dispatchEvent(event)
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>

  )
}
