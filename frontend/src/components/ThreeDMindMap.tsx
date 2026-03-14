import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { X } from 'lucide-react'
import { useMindMap3D, type SimNode3D, type SimEdge3D } from '../hooks/useMindMap3D'
import { ItemDetailModal } from './ItemDetailModal'
import { CONTENT_TYPE_COLORS } from '../canvas/nodeUtils'
import type { Item, Connection, ConnectionType } from '../types'
import { CONNECTION_TYPE_CONFIG } from '../connectionConfig'

// ── Sub-components (must be inside Canvas for r3f hooks) ──────────────────

function CameraKeyboard() {
  const { camera } = useThree()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const speed = 25
      if (e.key === 'w' || e.key === 'W') camera.translateZ(-speed)
      if (e.key === 's' || e.key === 'S') camera.translateZ(speed)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camera])
  return null
}

function NodeSphere({
  node,
  onSelect,
  userConnections,
}: {
  node: SimNode3D
  onSelect: (itemId: string) => void
  userConnections: Connection[]
}) {
  const [hovered, setHovered] = useState(false)
  const color = (node.content_type ? CONTENT_TYPE_COLORS[node.content_type] : undefined) ?? '#7c6af7'
  const radius = Math.max(1, 1 + Math.min(node.degree, 5) * 0.35)
  const shortLabel = node.label.length > 28 ? node.label.slice(0, 28) + '…' : node.label
  const preview = (node.summary || node.snippet).slice(0, 90)

  const myConns = userConnections.filter(
    c => c.source_item_id === node.item_id || c.target_item_id === node.item_id
  )
  const connSummary = myConns.length > 0
    ? Object.entries(
        myConns.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] ?? 0) + 1
          return acc
        }, {} as Record<string, number>)
      ).map(([t, n]) => `${n} ${t.replace(/_/g, ' ')}`).join(' · ')
    : null

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        onClick={e => { e.stopPropagation(); onSelect(node.item_id) }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default' }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.55 : 0.25}
        />
      </mesh>

      {/* Always-visible title label */}
      <Html
        center
        position={[0, -(radius + 0.6), 0]}
        distanceFactor={90}
        style={{ pointerEvents: 'none' }}
      >
        <span style={{
          color: '#e2e8f0',
          fontSize: '11px',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          userSelect: 'none',
        }}>
          {shortLabel}
        </span>
      </Html>

      {/* Hover card */}
      {hovered && (
        <Html
          center
          position={[radius + 1, 0, 0]}
          distanceFactor={90}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(15,17,23,0.92)',
            border: `1px solid ${color}55`,
            borderRadius: '6px',
            padding: '6px 8px',
            maxWidth: '160px',
            userSelect: 'none',
          }}>
            <div style={{ color, fontSize: '10px', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {node.content_type}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.4' }}>
              {preview}{preview.length >= 90 ? '…' : ''}
            </div>
            {connSummary && (
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px', borderTop: '1px solid #ffffff11', paddingTop: '4px' }}>
                {connSummary}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

function CategorySphere({ node }: { node: SimNode3D }) {
  const radius = 3.5 + Math.min((node.member_count ?? 1) * 0.4, 4)
  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color="#94a3b8"
          emissive="#94a3b8"
          emissiveIntensity={0.1}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <Html
        center
        position={[0, -(radius + 1), 0]}
        distanceFactor={90}
        style={{ pointerEvents: 'none' }}
      >
        <span style={{
          color: '#cbd5e1',
          fontSize: '13px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.95)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}>
          {node.label}
        </span>
      </Html>
    </group>
  )
}

function Edges({
  simEdges,
  userConnections,
  nodeById,
  nodeByItemId,
  categoryNodes,
}: {
  simEdges: SimEdge3D[]
  userConnections: Connection[]
  nodeById: Record<string, SimNode3D>
  nodeByItemId: Record<string, SimNode3D>
  categoryNodes: SimNode3D[]
}) {
  // Similarity edges (purple, dim)
  const simPositions = useMemo(() => {
    const pts: number[] = []
    for (const edge of simEdges) {
      const src = nodeById[edge.source_id]
      const tgt = nodeById[edge.target_id]
      if (!src || !tgt) continue
      pts.push(src.x, src.y, src.z, tgt.x, tgt.y, tgt.z)
    }
    return new Float32Array(pts)
  }, [simEdges, nodeById])

  // User connections — split into manual (solid) and auto-generated (dashed), one buffer per type each
  const manualConnPositionsByType = useMemo(() => {
    const byType: Partial<Record<ConnectionType, number[]>> = {}
    for (const conn of userConnections) {
      if (conn.auto_generated) continue
      const srcNode = nodeByItemId[conn.source_item_id]
      const tgtNode = nodeByItemId[conn.target_item_id]
      if (!srcNode || !tgtNode) continue
      if (!byType[conn.type]) byType[conn.type] = []
      byType[conn.type]!.push(srcNode.x, srcNode.y, srcNode.z, tgtNode.x, tgtNode.y, tgtNode.z)
    }
    return Object.fromEntries(
      Object.entries(byType).map(([type, pts]) => [type, new Float32Array(pts!)])
    ) as Partial<Record<ConnectionType, Float32Array>>
  }, [userConnections, nodeByItemId])

  const autoConnPositionsByType = useMemo(() => {
    const byType: Partial<Record<ConnectionType, number[]>> = {}
    for (const conn of userConnections) {
      if (!conn.auto_generated) continue
      const srcNode = nodeByItemId[conn.source_item_id]
      const tgtNode = nodeByItemId[conn.target_item_id]
      if (!srcNode || !tgtNode) continue
      if (!byType[conn.type]) byType[conn.type] = []
      byType[conn.type]!.push(srcNode.x, srcNode.y, srcNode.z, tgtNode.x, tgtNode.y, tgtNode.z)
    }
    return Object.fromEntries(
      Object.entries(byType).map(([type, pts]) => [type, new Float32Array(pts!)])
    ) as Partial<Record<ConnectionType, Float32Array>>
  }, [userConnections, nodeByItemId])

  const dashedRefs = useRef<Record<string, THREE.LineSegments>>({})
  useEffect(() => {
    Object.values(dashedRefs.current).forEach(ls => ls?.computeLineDistances())
  }, [autoConnPositionsByType])

  const catPositions = useMemo(() => {
    if (categoryNodes.length === 0) return new Float32Array(0)
    const catByLabel: Record<string, SimNode3D> = {}
    categoryNodes.forEach(hub => { catByLabel[hub.label] = hub })

    const pts: number[] = []
    for (const itemNode of Object.values(nodeByItemId)) {
      const hub = catByLabel[itemNode.category]
      if (!hub) continue
      pts.push(itemNode.x, itemNode.y, itemNode.z, hub.x, hub.y, hub.z)
    }
    return new Float32Array(pts)
  }, [categoryNodes, nodeByItemId])

  return (
    <>
      {simPositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[simPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#7c6af7" opacity={0.35} transparent depthWrite={false} />
        </lineSegments>
      )}
      {catPositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[catPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#e2e8f0" opacity={0.12} transparent depthWrite={false} />
        </lineSegments>
      )}
      {(Object.entries(manualConnPositionsByType) as [ConnectionType, Float32Array][]).map(([type, arr]) => {
        const cfg = CONNECTION_TYPE_CONFIG[type]
        return (
          <lineSegments key={`manual-${type}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[arr, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={cfg.color} opacity={0.8} transparent depthWrite={false} />
          </lineSegments>
        )
      })}
      {(Object.entries(autoConnPositionsByType) as [ConnectionType, Float32Array][]).map(([type, arr]) => {
        const cfg = CONNECTION_TYPE_CONFIG[type]
        return (
          <lineSegments
            key={`auto-${type}`}
            ref={el => { if (el) dashedRefs.current[type] = el as THREE.LineSegments }}
          >
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[arr, 3]} />
            </bufferGeometry>
            <lineDashedMaterial color={cfg.color} opacity={0.45} transparent depthWrite={false} dashSize={1.5} gapSize={0.8} />
          </lineSegments>
        )
      })}
    </>
  )
}

function Scene({
  nodes,
  edges,
  userConnections,
  categoryNodes,
  onSelectItem,
}: {
  nodes: SimNode3D[]
  edges: SimEdge3D[]
  userConnections: Connection[]
  categoryNodes: SimNode3D[]
  onSelectItem: (itemId: string) => void
}) {
  const nodeById = useMemo(() => {
    const m: Record<string, SimNode3D> = {}
    nodes.forEach(n => { m[n.id] = n })
    return m
  }, [nodes])

  const nodeByItemId = useMemo(() => {
    const m: Record<string, SimNode3D> = {}
    nodes.forEach(n => { m[n.item_id] = n })
    return m
  }, [nodes])

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={1} />
      <OrbitControls makeDefault />
      <CameraKeyboard />
      <Edges
        simEdges={edges}
        userConnections={userConnections}
        nodeById={nodeById}
        nodeByItemId={nodeByItemId}
        categoryNodes={categoryNodes}
      />
      {categoryNodes.map(n => (
        <CategorySphere key={n.id} node={n} />
      ))}
      {nodes.map(n => (
        <NodeSphere key={n.id} node={n} onSelect={onSelectItem} userConnections={userConnections} />
      ))}
    </>
  )
}

// ── Main overlay component ─────────────────────────────────────────────────

export function ThreeDMindMap({ onClose }: { onClose: () => void }) {
  const { nodes, edges, userConnections, categoryNodes, loading, error } = useMindMap3D()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Escape closes the overlay (unless a modal is open)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !selectedItemId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, selectedItemId])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-surface-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">3D Knowledge Graph</span>
          {!loading && (
            <span className="text-xs text-slate-500">{nodes.length} items · {categoryNodes.length} categories</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Orbit: drag · Zoom: scroll · Fly: W/S · Open: click</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Building knowledge graph…</span>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {!loading && !error && nodes.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-slate-500">No items found — add some content first.</span>
        </div>
      )}

      {!loading && !error && nodes.length > 0 && (
        <div className="flex-1">
          <Canvas camera={{ position: [0, 0, 80], fov: 60 }}>
            <Scene nodes={nodes} edges={edges} userConnections={userConnections} categoryNodes={categoryNodes} onSelectItem={setSelectedItemId} />
          </Canvas>
        </div>
      )}

      {/* Item detail modal rendered over the 3D scene */}
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
    </div>
  )
}
