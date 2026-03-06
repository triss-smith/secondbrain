import { useState } from 'react'
import { type NodeProps } from 'reactflow'
import { X } from 'lucide-react'
import type { MindMapNodeData } from '../../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_LABELS } from '../nodeUtils'
import { ItemDetailModal } from '../../components/ItemDetailModal'
import type { Item } from '../../types'

export function MindMapNode({ data, selected, id }: NodeProps<MindMapNodeData>) {
  const { nodes, edges } = data
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const WIDTH = 560
  const HEIGHT = 440
  const CX = WIDTH / 2
  const CY = (HEIGHT - 36) / 2

  const placed = nodes.map((n, i) => {
    if (nodes.length === 1) return { ...n, x: CX, y: CY }
    const angle = (2 * Math.PI * i) / nodes.length
    const r = Math.min(CX, CY) - 70
    return { ...n, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  })

  const nodeById = Object.fromEntries(placed.map(n => [n.id, n]))

  return (
    <>
      <div
        className={`rounded-xl border bg-surface-1 overflow-hidden ${
          selected ? 'border-accent' : 'border-surface-3'
        }`}
        style={{ width: WIDTH, height: HEIGHT }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-3 bg-surface-2">
          <div>
            <p className="text-xs font-semibold text-white">Knowledge Mind Map</p>
            <p className="text-[10px] text-slate-500">{nodes.length} items · {edges.length} connections · click a node to view</p>
          </div>
          <button
            className="nodrag text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('remove-page-node', { detail: { node_id: id } }))}
            title="Remove mind map"
          >
            <X size={13} />
          </button>
        </div>

        <svg width={WIDTH} height={HEIGHT - 36} viewBox={`0 0 ${WIDTH} ${HEIGHT - 36}`}>
          {/* Edges */}
          {edges.map(edge => {
            const src = nodeById[edge.source]
            const tgt = nodeById[edge.target]
            if (!src || !tgt) return null
            return (
              <line
                key={edge.id}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#7c6af7"
                strokeOpacity={0.3 + edge.similarity * 0.5}
                strokeWidth={1}
              />
            )
          })}

          {/* Nodes */}
          {placed.map(n => {
            const color = CONTENT_TYPE_COLORS[n.content_type] ?? '#7c6af7'
            const label = CONTENT_TYPE_LABELS[n.content_type]
            const preview = ((n as {summary?: string; snippet?: string}).summary || (n as {snippet?: string}).snippet || '').slice(0, 40)

            return (
              <g
                key={n.id}
                onClick={() => setSelectedItemId(n.item_id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover target (larger invisible circle) */}
                <circle cx={n.x} cy={n.y} r={28} fill="transparent" />

                {/* Visible circle */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={22}
                  fill={`${color}33`}
                  stroke={color}
                  strokeWidth={1.5}
                />

                {/* Type label */}
                <text x={n.x} y={n.y - 5} textAnchor="middle" fontSize={6} fill={color} fontWeight="700">
                  {label.toUpperCase()}
                </text>

                {/* Title */}
                <text x={n.x} y={n.y + 7} textAnchor="middle" fontSize={7} fill="#e2e8f0" fontWeight="500">
                  {n.label.slice(0, 18)}{n.label.length > 18 ? '…' : ''}
                </text>

                {/* Snippet preview */}
                {preview && (
                  <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize={6} fill="#64748b">
                    {preview}{preview.length >= 40 ? '…' : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {selectedItemId && (
        <ItemDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onAddToCanvas={(item: Item) => {
            window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
            setSelectedItemId(null)
          }}
        />
      )}
    </>
  )
}
