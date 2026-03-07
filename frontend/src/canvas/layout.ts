import type { Node } from 'reactflow'
import type { SourceNodeData } from '../types'

const NODE_W = 300
const NODE_H = 220
const GAP_X = 50
const GAP_Y = 70
const GROUP_PAD = 140   // space between clusters
const NODES_PER_ROW = 4 // max nodes per row within a cluster

/**
 * Category layout: groups source nodes by item.category, arranges each
 * group in a wrapped grid, then arranges the groups themselves in a grid.
 */
export function categoryLayout(sourceNodes: Node[]): Node[] {
  if (sourceNodes.length === 0) return sourceNodes

  // Group by category
  const groups = new Map<string, Node[]>()
  for (const node of sourceNodes) {
    const cat = (node.data as SourceNodeData).item.category || 'Uncategorized'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(node)
  }

  // Sort groups largest first
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  // Arrange groups in a grid (roughly square)
  const GROUPS_PER_ROW = Math.ceil(Math.sqrt(sorted.length))

  // Compute per-group block heights, then derive the max height per grid row
  // so that groups in the same row never overlap vertically.
  const blockHeights = sorted.map(([, nodes]) =>
    Math.ceil(nodes.length / NODES_PER_ROW) * (NODE_H + GAP_Y) + 36
  )
  const rowHeights: number[] = []
  sorted.forEach((_, gi) => {
    const gr = Math.floor(gi / GROUPS_PER_ROW)
    rowHeights[gr] = Math.max(rowHeights[gr] ?? 0, blockHeights[gi])
  })
  const rowOriginY = rowHeights.reduce<number[]>((acc, h, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + h + GROUP_PAD)
    return acc
  }, [])

  const blockW = NODES_PER_ROW * (NODE_W + GAP_X)
  const result: Node[] = []

  sorted.forEach(([, nodes], gi) => {
    const groupCol = gi % GROUPS_PER_ROW
    const groupRow = Math.floor(gi / GROUPS_PER_ROW)
    const originX = groupCol * (blockW + GROUP_PAD)
    const originY = rowOriginY[groupRow]

    nodes.forEach((node, i) => {
      const col = i % NODES_PER_ROW
      const row = Math.floor(i / NODES_PER_ROW)
      result.push({
        ...node,
        position: {
          x: originX + col * (NODE_W + GAP_X),
          y: originY + 36 + row * (NODE_H + GAP_Y),
        },
      })
    })
  })

  return result
}

export interface SimilarityPair {
  source: string
  target: string
  similarity: number
}

/**
 * Force-directed layout: nodes with high similarity attract each other,
 * all nodes repel each other. Runs a fixed number of iterations with cooling.
 * `pairs` should use item IDs (not node IDs).
 */
export function similarityLayout(
  sourceNodes: Node[],
  pairs: SimilarityPair[]
): Node[] {
  if (sourceNodes.length < 2) return sourceNodes

  // Build item-id → node map
  const idToNode = new Map(
    sourceNodes.map(n => [(n.data as SourceNodeData).item.id, n])
  )

  // Build similarity lookup keyed by node-id pairs
  const simMap = new Map<string, number>()
  for (const p of pairs) {
    const na = idToNode.get(p.source)
    const nb = idToNode.get(p.target)
    if (!na || !nb) continue
    simMap.set(`${na.id}|${nb.id}`, p.similarity)
    simMap.set(`${nb.id}|${na.id}`, p.similarity)
  }

  // Initialize positions in a rough grid to avoid singularities
  const cols = Math.ceil(Math.sqrt(sourceNodes.length))
  let pos = sourceNodes.map((n, i) => ({
    id: n.id,
    x: (i % cols) * 400 + (Math.random() - 0.5) * 60,
    y: Math.floor(i / cols) * 350 + (Math.random() - 0.5) * 60,
  }))

  const ITERATIONS = 280
  const REPULSION = 90_000
  const IDEAL_DIST = 520  // natural spring length for unrelated nodes

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS
    const maxStep = 100 * cooling + 8

    const forces = pos.map(() => ({ fx: 0, fy: 0 }))

    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x
        const dy = pos[j].y - pos[i].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const nx = dx / dist
        const ny = dy / dist

        // Repulsion (all pairs)
        const rep = REPULSION / (dist * dist)
        forces[i].fx -= rep * nx
        forces[i].fy -= rep * ny
        forces[j].fx += rep * nx
        forces[j].fy += rep * ny

        // Attraction (similar pairs only)
        const sim = simMap.get(`${pos[i].id}|${pos[j].id}`) ?? 0
        if (sim > 0) {
          // Spring: shorter ideal distance for more similar pairs
          const idealForPair = IDEAL_DIST * (1 - sim * 0.7)
          const attr = 1.8 * sim * (dist - idealForPair)
          forces[i].fx += attr * nx
          forces[i].fy += attr * ny
          forces[j].fx -= attr * nx
          forces[j].fy -= attr * ny
        }
      }
    }

    pos = pos.map((p, i) => ({
      ...p,
      x: p.x + Math.max(-maxStep, Math.min(maxStep, forces[i].fx)),
      y: p.y + Math.max(-maxStep, Math.min(maxStep, forces[i].fy)),
    }))
  }

  // Re-center around a sensible canvas origin
  const cx = pos.reduce((s, p) => s + p.x, 0) / pos.length
  const cy = pos.reduce((s, p) => s + p.y, 0) / pos.length
  const posById = new Map(pos.map(p => [p.id, p]))

  return sourceNodes.map(node => {
    const p = posById.get(node.id)!
    return { ...node, position: { x: p.x - cx + 800, y: p.y - cy + 500 } }
  })
}
