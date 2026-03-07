import { useState } from 'react'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'

export function SourceChatEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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

  function handleDelete() {
    window.dispatchEvent(new CustomEvent('remove-source-chat-edge', { detail: { edge_id: id } }))
  }

  return (
    <>
      <path
        d={edgePath}
        stroke="#34d399"
        strokeWidth={1.5}
        strokeOpacity={0.6}
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
          className="absolute"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
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
