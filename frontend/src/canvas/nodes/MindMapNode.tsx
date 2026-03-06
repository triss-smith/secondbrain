import { type NodeProps } from 'reactflow'
import type { MindMapNodeData } from '../../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_LABELS } from '../nodeUtils'

export function MindMapNode({ data, selected }: NodeProps<MindMapNodeData>) {
  const { nodes, edges } = data

  // Simple SVG force-layout approximation using pre-computed positions from backend
  const WIDTH = 520
  const HEIGHT = 400
  const CX = WIDTH / 2
  const CY = HEIGHT / 2

  // Place nodes in a circle
  const placed = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1)
    const r = Math.min(CX, CY) - 60
    return { ...n, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  })

  const nodeById = Object.fromEntries(placed.map(n => [n.id, n]))

  return (
    <div
      className={`rounded-xl border bg-surface-1 overflow-hidden ${
        selected ? 'border-accent' : 'border-surface-3'
      }`}
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <div className="px-3 py-2 border-b border-surface-3 bg-surface-2">
        <p className="text-xs font-semibold text-white">Knowledge Mind Map</p>
        <p className="text-[10px] text-slate-500">{nodes.length} items · {edges.length} connections</p>
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
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={18} fill={`${color}33`} stroke={color} strokeWidth={1.5} />
              <text
                x={n.x}
                y={n.y + 5}
                textAnchor="middle"
                fontSize={8}
                fill={color}
                fontWeight="600"
              >
                {label.slice(0, 3).toUpperCase()}
              </text>
              <text
                x={n.x}
                y={n.y + 30}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
              >
                {n.label.slice(0, 20)}{n.label.length > 20 ? '…' : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
