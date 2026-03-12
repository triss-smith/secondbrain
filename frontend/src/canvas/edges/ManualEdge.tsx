import { useState } from 'react'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'
import type { ConnectionType } from '../../types'
import { deleteConnection, updateConnection } from '../../api'
import { CONNECTION_TYPES, CONNECTION_TYPE_CONFIG } from '../../connectionConfig'

export function ManualEdge({
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
  const [showMenu, setShowMenu] = useState(false)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  const connType = (data?.type as ConnectionType) ?? 'related'
  const connId = data?.conn_id as number
  const cfg = CONNECTION_TYPE_CONFIG[connType]
  const color = cfg.color

  function handleDelete() {
    if (!connId) return
    deleteConnection(connId).catch(() => {})
    window.dispatchEvent(new CustomEvent('remove-manual-edge', { detail: { edge_id: id } }))
  }

  function handleChangeType(newType: ConnectionType) {
    if (!connId) return
    updateConnection(connId, newType).catch(() => {})
    window.dispatchEvent(new CustomEvent('update-manual-edge', { detail: { edge_id: id, type: newType } }))
    setShowMenu(false)
  }

  return (
    <>
      <path
        d={edgePath}
        stroke={color}
        strokeOpacity={0.75}
        strokeWidth={2}
        fill="none"
      />
      {/* Wide invisible hit zone */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={e => { e.preventDefault(); setShowMenu(v => !v) }}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          className="absolute flex flex-col items-center gap-1"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Type badge */}
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full pointer-events-none font-medium"
            style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
          >
            {cfg.label}
          </span>

          {/* Hover actions */}
          {hovered && !showMenu && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMenu(true)}
                className="pointer-events-auto text-[9px] text-slate-400 hover:text-white bg-surface-1 border border-surface-3 rounded px-1"
              >
                change
              </button>
              <button
                onClick={handleDelete}
                className="pointer-events-auto w-4 h-4 bg-surface-1 border border-surface-3 rounded-full text-slate-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/20 text-[8px] flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* Change type menu */}
          {showMenu && (
            <div className="pointer-events-auto bg-surface-1 border border-surface-3 rounded-lg p-1.5 flex flex-col gap-1 shadow-xl">
              {CONNECTION_TYPES.map(t => {
                const tCfg = CONNECTION_TYPE_CONFIG[t]
                return (
                  <button
                    key={t}
                    onClick={() => handleChangeType(t)}
                    className="text-left text-[10px] px-2 py-1 rounded hover:bg-surface-2 transition-colors flex items-center gap-1.5"
                    style={{ color: tCfg.color }}
                  >
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tCfg.color }} />
                    {tCfg.label}
                  </button>
              )})}
              <button
                onClick={() => setShowMenu(false)}
                className="text-[9px] text-slate-500 hover:text-white text-center mt-0.5"
              >
                cancel
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
