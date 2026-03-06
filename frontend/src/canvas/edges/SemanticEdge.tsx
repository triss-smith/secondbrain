import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'

export function SemanticEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const similarity = data?.similarity as number | undefined

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: '#7c6af7',
          strokeOpacity: similarity ? 0.2 + similarity * 0.6 : 0.3,
          strokeDasharray: '4 3',
          strokeWidth: 1.5,
        }}
      />
      {similarity && similarity > 0.75 && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute text-[9px] text-slate-500 bg-surface-1 px-1 rounded pointer-events-none"
          >
            {Math.round(similarity * 100)}%
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
