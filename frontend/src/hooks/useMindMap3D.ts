import { useEffect, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, type SimLink } from 'd3-force-3d'
import { getMindMap } from '../api'
import type { ContentType } from '../types'

export interface SimNode3D {
  id: string          // "mm-{item_id}" — matches backend node id
  item_id: string
  label: string
  content_type: ContentType
  snippet: string
  summary: string
  x: number
  y: number
  z: number
  degree: number
}

export interface SimEdge3D {
  source_id: string
  target_id: string
  similarity: number
}

interface MindMap3DState {
  nodes: SimNode3D[]
  edges: SimEdge3D[]
  loading: boolean
  error: string | null
}

export function useMindMap3D(): MindMap3DState {
  const [state, setState] = useState<MindMap3DState>({
    nodes: [],
    edges: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    getMindMap()
      .then(raw => {
        // Count degree per node
        const degreeMap: Record<string, number> = {}
        raw.nodes.forEach(n => { degreeMap[n.id] = 0 })
        raw.edges.forEach(e => {
          degreeMap[e.source] = (degreeMap[e.source] ?? 0) + 1
          degreeMap[e.target] = (degreeMap[e.target] ?? 0) + 1
        })

        // Build sim nodes with initial random 3D positions
        const simNodes: SimNode3D[] = raw.nodes.map(n => ({
          id: n.id,
          item_id: n.data.item_id,
          label: n.data.label,
          content_type: n.data.content_type as ContentType,
          snippet: n.data.snippet,
          summary: n.data.summary,
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
          degree: degreeMap[n.id] ?? 0,
        }))

        // Build id → node map for link resolution
        const nodeById: Record<string, SimNode3D> = {}
        simNodes.forEach(n => { nodeById[n.id] = n })

        // Build sim links (d3 will replace source/target strings with node objects)
        const simLinks: (SimLink<SimNode3D> & { similarity: number })[] = raw.edges
          .filter(e => nodeById[e.source] && nodeById[e.target])
          .map(e => ({
            source: e.source,
            target: e.target,
            similarity: e.data.similarity ?? 0.5,
          }))

        // Run 3D force simulation synchronously
        const sim = forceSimulation<SimNode3D>(simNodes, 3)
          .force(
            'link',
            forceLink<SimNode3D>(simLinks)
              .id((d: SimNode3D) => d.id)
              .strength((l: SimLink<SimNode3D> & { similarity: number }) => l.similarity * 0.4)
              .distance(80)
          )
          .force('charge', forceManyBody<SimNode3D>().strength(-250))
          .force('center', forceCenter<SimNode3D>(0, 0, 0))
          .stop()

        for (let i = 0; i < 300; i++) sim.tick()

        // After sim, d3 has mutated simNodes with final x/y/z.
        // Rebuild edges using node ids (source/target are now node objects).
        const settledEdges: SimEdge3D[] = simLinks.map(l => ({
          source_id: typeof l.source === 'string' ? l.source : (l.source as SimNode3D).id,
          target_id: typeof l.target === 'string' ? l.target : (l.target as SimNode3D).id,
          similarity: l.similarity,
        }))

        setState({ nodes: simNodes, edges: settledEdges, loading: false, error: null })
      })
      .catch(err => {
        setState(prev => ({ ...prev, loading: false, error: String(err) }))
      })
  }, [])

  return state
}
