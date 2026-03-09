import { useEffect, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, type SimLink } from 'd3-force-3d'
import { getMindMap, listConnections } from '../api'
import type { ContentType, Connection } from '../types'

export interface SimNode3D {
  id: string
  item_id: string        // "" for category hubs
  label: string
  content_type: ContentType | ''
  snippet: string
  summary: string
  x: number
  y: number
  z: number
  degree: number
  node_type: 'item' | 'category'
  category: string       // category name for hubs, item's category for items (leave '' for now — Task 3 will fill it)
  member_count?: number  // only on category hubs
}

export interface SimEdge3D {
  source_id: string
  target_id: string
  similarity: number
}

interface MindMap3DState {
  nodes: SimNode3D[]         // item nodes only
  categoryNodes: SimNode3D[] // hub nodes only
  edges: SimEdge3D[]
  userConnections: Connection[]
  loading: boolean
  error: string | null
}

export function useMindMap3D(): MindMap3DState {
  const [state, setState] = useState<MindMap3DState>({
    nodes: [],
    categoryNodes: [],
    edges: [],
    userConnections: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    Promise.all([getMindMap(), listConnections()])
      .then(([raw, conns]) => {
        // Count degree per node
        const degreeMap: Record<string, number> = {}
        raw.nodes.forEach(n => { degreeMap[n.id] = 0 })
        raw.edges.forEach(e => {
          degreeMap[e.source] = (degreeMap[e.source] ?? 0) + 1
          degreeMap[e.target] = (degreeMap[e.target] ?? 0) + 1
        })

        const allSimNodes: SimNode3D[] = raw.nodes.map(n => {
          const isCategory = n.type === 'categoryHub'
          return {
            id: n.id,
            item_id: isCategory ? '' : n.data.item_id,
            label: n.data.label,
            content_type: isCategory ? '' : (n.data.content_type as ContentType),
            snippet: isCategory ? '' : (n.data.snippet ?? ''),
            summary: isCategory ? '' : (n.data.summary ?? ''),
            x: (Math.random() - 0.5) * 40,
            y: (Math.random() - 0.5) * 40,
            z: (Math.random() - 0.5) * 40,
            degree: degreeMap[n.id] ?? 0,
            node_type: isCategory ? 'category' : 'item',
            category: isCategory ? n.data.label : (n.data.category ?? ''),
            member_count: isCategory ? ((n.data as any).member_count as number | undefined) : undefined,
          } as SimNode3D
        })

        const nodeById: Record<string, SimNode3D> = {}
        allSimNodes.forEach(n => { nodeById[n.id] = n })

        const simLinks: (SimLink<SimNode3D> & { similarity: number })[] = raw.edges
          .filter(e => nodeById[e.source] && nodeById[e.target])
          .map(e => ({
            source: e.source,
            target: e.target,
            similarity: e.data.similarity ?? 0.5,
          }))

        const sim = forceSimulation<SimNode3D>(allSimNodes, 3)
          .force(
            'link',
            forceLink<SimNode3D>(simLinks)
              .id((d: SimNode3D) => d.id)
              .strength((l: SimLink<SimNode3D>) => {
                const src = l.source as SimNode3D
                const tgt = l.target as SimNode3D
                if (src.node_type === 'category' || tgt.node_type === 'category') return 0.5
                return (((l as unknown) as { similarity: number }).similarity ?? 0.5) * 0.4
              })
              .distance((l: SimLink<SimNode3D>) => {
                const src = l.source as SimNode3D
                const tgt = l.target as SimNode3D
                if (src.node_type === 'category' || tgt.node_type === 'category') return 18
                return 12
              })
          )
          .force('charge', forceManyBody<SimNode3D>().strength((n: SimNode3D) =>
            n.node_type === 'category' ? -120 : -15
          ))
          .force('center', forceCenter<SimNode3D>(0, 0, 0))
          .stop()

        for (let i = 0; i < 300; i++) sim.tick()

        const settledEdges: SimEdge3D[] = simLinks
          .filter(l => {
            const src = l.source as SimNode3D
            const tgt = l.target as SimNode3D
            return src.node_type === 'item' && tgt.node_type === 'item'
          })
          .map(l => ({
            source_id: (l.source as SimNode3D).id,
            target_id: (l.target as SimNode3D).id,
            similarity: l.similarity,
          }))

        const itemNodes = allSimNodes.filter(n => n.node_type === 'item')
        const categoryNodes = allSimNodes.filter(n => n.node_type === 'category')

        setState({
          nodes: itemNodes,
          categoryNodes,
          edges: settledEdges,
          userConnections: conns,
          loading: false,
          error: null,
        })
      })
      .catch(err => {
        setState(prev => ({ ...prev, loading: false, error: String(err) }))
      })
  }, [])

  return state
}
