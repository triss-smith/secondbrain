import { useState } from 'react'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'

export function SemanticEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const similarity = data?.similarity as number | undefined

  function handleDelete() {
    window.dispatchEvent(new CustomEvent('remove-semantic-edge', { detail: { edge_id: id, similarity } }))
  }

  return (
    <>
      <path
        d={edgePath}
        stroke="#7c6af7"
        strokeOpacity={similarity ? 0.2 + similarity * 0.6 : 0.3}
        strokeDasharray="4 3"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          className="absolute flex items-center gap-1"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {similarity && similarity > 0.75 && (
            <span className="text-[9px] text-slate-500 bg-surface-1 px-1 rounded pointer-events-none">
              {Math.round(similarity * 100)}%
            </span>
          )}
          {hovered && (
            <button
              onClick={handleDelete}
              className="pointer-events-auto w-4 h-4 bg-surface-1 border border-surface-3 rounded-full text-slate-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/20 text-[8px] flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
