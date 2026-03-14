import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type NodePositionChange,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getSettings, getItemSimilarities, createConnection, listConnections, upsertSemanticConnection, dismissSemanticConnection } from '../api'
import { categoryLayout, similarityLayout } from './layout'
import { useBoard } from '../hooks/useBoard'
import type { Item, SourceNodeData, Connection as AppConnection, ConnectionType } from '../types'
import { ConnectionTypePicker } from './ConnectionTypePicker'
import { ManualEdge } from './edges/ManualEdge'
import { SemanticEdge } from './edges/SemanticEdge'
import { SourceChatEdge } from './edges/SourceChatEdge'
import { ChatNode } from './nodes/ChatNode'
import { PageNode } from './nodes/PageNode'
import { SourceNode } from './nodes/SourceNode'
import { Toolbar } from './Toolbar'
import { ThreeDMindMap } from '../components/ThreeDMindMap'

const NODE_TYPES = {
  source: SourceNode,
  chat: ChatNode,
  page: PageNode,
}

const EDGE_TYPES = {
  semantic: SemanticEdge,
  'source-chat': SourceChatEdge,
  manual: ManualEdge,
}

interface Props {
  isDark?: boolean
  themeId?: string
}

export function Board({ isDark = true }: Props) {
  const { board, saveState } = useBoard()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const organizeModeRef = useRef<string>('category')
  const semanticConnectionsRef = useRef<Map<string, number>>(new Map()) // "source-target" -> similarity
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.3)
  const [organizeLabel, setOrganizeLabel] = useState<'category' | 'similarity'>('category')
  const [threeDOpen, setThreeDOpen] = useState(false)
  const [pendingConnection, setPendingConnection] = useState<{
    connection: Connection  // React Flow's Connection type
    x: number
    y: number
  } | null>(null)
  const { fitView } = useReactFlow()

  // Load board state
  useEffect(() => {
    if (!board?.state) return

    const baseNodes = board.state.nodes as Node[] ?? []
    const baseEdges = board.state.edges ?? []
    setNodes(baseNodes)

    // Fetch user connections and merge as manual edges
    listConnections().then(conns => {
      // Build item_id → canvas node id lookup
      const itemToNodeId: Record<string, string> = {}
      for (const n of baseNodes) {
        const item = (n.data as SourceNodeData)?.item
        if (item) itemToNodeId[item.id] = n.id
      }

      // Separate semantic connections (non-dismissed) from manual connections
      const manualConns = conns.filter(c => !c.is_semantic)
      const semanticConns = conns.filter(c => c.is_semantic && !c.dismissed)

      // Store DISMISSED semantic connections for filtering similarity pairs
      semanticConnectionsRef.current = new Map()
      for (const sc of semanticConns.filter(c => c.dismissed)) {
        const key = `${sc.source_item_id}-${sc.target_item_id}`
        semanticConnectionsRef.current.set(key, sc.similarity ?? 0)
      }

      const manualEdges = manualConns
        .filter(c => itemToNodeId[c.source_item_id] && itemToNodeId[c.target_item_id])
        .map(c => ({
          id: `manual-${c.id}`,
          source: itemToNodeId[c.source_item_id],
          target: itemToNodeId[c.target_item_id],
          type: 'manual' as const,
          data: { conn_id: c.id, type: c.type, auto_generated: c.auto_generated },
        }))

      setEdges([...baseEdges, ...manualEdges])
    }).catch(() => setEdges(baseEdges))
  }, [board?.id])

  useEffect(() => {
    getSettings().then(s => {
      const mode = s.organize_mode as 'category' | 'similarity'
      organizeModeRef.current = mode
      setOrganizeLabel(mode)
      setSimilarityThreshold(s.similarity_threshold)
    })

    function onSettingsChanged(e: Event) {
      const detail = (e as CustomEvent<{ organize_mode: string; similarity_threshold: number }>).detail
      const mode = detail.organize_mode as 'category' | 'similarity'
      organizeModeRef.current = mode
      setOrganizeLabel(mode)
      setSimilarityThreshold(detail.similarity_threshold)
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  // Auto-save board state (debounced)
  function scheduleSave(ns = nodes, es = edges) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const persistEdges = es.filter(e => e.type !== 'manual' && e.type !== 'semantic')
      saveState({ nodes: ns as never[], edges: persistEdges })
    }, 1500)
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      const fromNode = nodes.find(n => n.id === connection.source)
      const toNode = nodes.find(n => n.id === connection.target)
      const isSourceToChat = fromNode?.type === 'source' && toNode?.type === 'chat'
      const isChatToSource = fromNode?.type === 'chat' && toNode?.type === 'source'

      if (isSourceToChat || isChatToSource) {
        const srcNode = isSourceToChat ? fromNode! : toNode!
        const chatNode = isSourceToChat ? toNode! : fromNode!
        const itemId = (srcNode.data as SourceNodeData).item.id

        // Skip if already linked
        const alreadyLinked = edges.some(
          e => e.type === 'source-chat' &&
            ((e.source === srcNode.id && e.target === chatNode.id) ||
             (e.source === chatNode.id && e.target === srcNode.id))
        )
        if (alreadyLinked) return

        const newEdge = { id: `sc-${srcNode.id}-${chatNode.id}`, source: srcNode.id, target: chatNode.id, type: 'source-chat' }
        const updatedEdges = [...edges, newEdge]
        setEdges(updatedEdges)
        setNodes(prev => {
          const updated = prev.map(n => {
            if (n.id !== chatNode.id) return n
            const ids = n.data.item_ids as string[]
            if (ids.includes(itemId)) return n
            return { ...n, data: { ...n.data, item_ids: [...ids, itemId] } }
          })
          scheduleSave(updated, updatedEdges)
          return updated
        })
      } else if (fromNode?.type === 'source' && toNode?.type === 'source') {
        // source-to-source: show type picker
        setPendingConnection({
          connection,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      }
    },
    [edges, nodes]
  )

  // Custom event listeners
  useEffect(() => {
    function onOpenChat(e: Event) {
      const { item_id } = (e as CustomEvent).detail
      const sourceNode = nodes.find(n => n.data?.item?.id === item_id)
      addChatNode([item_id], sourceNode?.id)
    }

    function onRemoveNode(e: Event) {
      const { item_id } = (e as CustomEvent).detail
      const removedNode = nodes.find(n => n.data?.item?.id === item_id)
      const updated = nodes.filter(n => n.data?.item?.id !== item_id)
      const updatedEdges = removedNode
        ? edges.filter(e => e.source !== removedNode.id && e.target !== removedNode.id)
        : edges
      setNodes(updated)
      setEdges(updatedEdges)
      scheduleSave(updated, updatedEdges)
    }

    function onRemoveChatNode(e: Event) {
      const { node_id } = (e as CustomEvent).detail
      const updated = nodes.filter(n => n.id !== node_id)
      const updatedEdges = edges.filter(e => e.source !== node_id && e.target !== node_id)
      setNodes(updated)
      setEdges(updatedEdges)
      scheduleSave(updated, updatedEdges)
    }

    function onRemoveSemanticEdge(e: Event) {
      const { edge_id, similarity } = (e as CustomEvent).detail
      // edge_id format: sem-${sourceItemId}-${targetItemId}
      const pair = edge_id.slice(4) // strip "sem-"
      const [source, target] = pair.split('-')
      // Add to local ref to filter immediately
      semanticConnectionsRef.current.set(`${source}-${target}`, -1)
      semanticConnectionsRef.current.set(`${target}-${source}`, -1)
      // Persist to DB
      dismissSemanticConnection(source, target, similarity ?? 0.5).catch(console.error)
      setEdges(prev => prev.filter(e => e.id !== edge_id))
    }

    function onRemoveSourceChatEdge(e: Event) {
      const { edge_id } = (e as CustomEvent).detail
      setEdges(prevEdges => {
        const edge = prevEdges.find(e => e.id === edge_id)
        const updatedEdges = prevEdges.filter(e => e.id !== edge_id)
        if (edge) {
          setNodes(prevNodes => {
            const sourceNode = prevNodes.find(n => n.id === edge.source)
            const itemId = (sourceNode?.data as SourceNodeData)?.item?.id
            if (!itemId) {
              scheduleSave(prevNodes, updatedEdges)
              return prevNodes
            }
            const updatedNodes = prevNodes.map(n => {
              if (n.id !== edge.target || n.type !== 'chat') return n
              return { ...n, data: { ...n.data, item_ids: (n.data.item_ids as string[]).filter(id => id !== itemId) } }
            })
            scheduleSave(updatedNodes, updatedEdges)
            return updatedNodes
          })
        }
        return updatedEdges
      })
    }

    function onSaveAsPage(e: Event) {
      const { node_id, title, content } = (e as CustomEvent).detail
      const chatNode = nodes.find(n => n.id === node_id)
      if (!chatNode) return
      const pageNodeId = `page-${board?.id}-${Date.now()}`
      const newNode: Node = {
        id: pageNodeId,
        type: 'page',
        position: { x: chatNode.position.x + 360, y: chatNode.position.y },
        data: { page_id: pageNodeId, title, content },
      }
      setNodes(ns => [...ns, newNode])
    }

    function onItemDeleted(e: Event) {
      const { item_id } = (e as CustomEvent).detail
      const removedNodeId = `source-${item_id}`
      setNodes(ns => ns
        .filter(n => n.data?.item?.id !== item_id)
        .map(n => {
          if (n.type === 'chat') {
            return { ...n, data: { ...n.data, item_ids: (n.data.item_ids as string[]).filter((id: string) => id !== item_id) } }
          }
          return n
        })
      )
      setEdges(es => es.filter(e => e.source !== removedNodeId && e.target !== removedNodeId))
    }

    function onRemoveManualEdge(e: Event) {
      const { edge_id } = (e as CustomEvent).detail
      setEdges(prev => prev.filter(e => e.id !== edge_id))
    }

    function onUpdateManualEdge(e: Event) {
      const { edge_id, type } = (e as CustomEvent).detail
      setEdges(prev => prev.map(e =>
        e.id === edge_id ? { ...e, data: { ...e.data, type } } : e
      ))
    }

    window.addEventListener('open-chat', onOpenChat)
    window.addEventListener('remove-node', onRemoveNode)
    window.addEventListener('remove-chat-node', onRemoveChatNode)
    window.addEventListener('save-as-page', onSaveAsPage)
    window.addEventListener('item-deleted', onItemDeleted)
    window.addEventListener('remove-semantic-edge', onRemoveSemanticEdge)
    window.addEventListener('remove-source-chat-edge', onRemoveSourceChatEdge)
    window.addEventListener('remove-manual-edge', onRemoveManualEdge)
    window.addEventListener('update-manual-edge', onUpdateManualEdge)

    return () => {
      window.removeEventListener('open-chat', onOpenChat)
      window.removeEventListener('remove-node', onRemoveNode)
      window.removeEventListener('remove-chat-node', onRemoveChatNode)
      window.removeEventListener('save-as-page', onSaveAsPage)
      window.removeEventListener('item-deleted', onItemDeleted)
      window.removeEventListener('remove-semantic-edge', onRemoveSemanticEdge)
      window.removeEventListener('remove-source-chat-edge', onRemoveSourceChatEdge)
      window.removeEventListener('remove-manual-edge', onRemoveManualEdge)
      window.removeEventListener('update-manual-edge', onUpdateManualEdge)
    }
  }, [nodes, edges, board?.id])

  // Public API for App to add items to canvas
  useEffect(() => {
    function onAddItem(e: Event) {
      const { item } = (e as CustomEvent).detail
      addSourceNode(item)
    }
    window.addEventListener('add-item-to-canvas', onAddItem)
    return () => window.removeEventListener('add-item-to-canvas', onAddItem)
  }, [nodes])

  useEffect(() => {
    const sourceNodes = nodes.filter(n => n.type === 'source')
    const itemIds = sourceNodes.map(n => (n.data as SourceNodeData).item.id)

    if (itemIds.length < 2) {
      // Remove any existing semantic edges if fewer than 2 source nodes
      setEdges(prev => prev.filter(e => e.type !== 'semantic'))
      return
    }

    getItemSimilarities(itemIds, similarityThreshold).then(pairs => {
      const dismissed = semanticConnectionsRef.current
      // Upsert all pairs to DB, then filter out dismissed ones
      Promise.all(pairs.map(p => upsertSemanticConnection(p.source, p.target, p.similarity))).then(() => {
        const semanticEdges = pairs.flatMap(p => {
          const keyA = `${p.source}-${p.target}`
          const keyB = `${p.target}-${p.source}`
          if (dismissed.has(keyA) || dismissed.has(keyB)) return []
          const sourceNode = sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.source)
          const targetNode = sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.target)
          if (!sourceNode || !targetNode) return []
          return [{ id: `sem-${p.source}-${p.target}`, source: sourceNode.id, target: targetNode.id, type: 'semantic', data: { similarity: p.similarity } }]
        })
        setEdges(prev => [
          ...prev.filter(e => e.type !== 'semantic'),
          ...semanticEdges,
        ])
      })
    })
  }, [nodes.filter(n => n.type === 'source').map(n => n.id).join(','), similarityThreshold])

  async function addSourceNode(item: Item) {
    const exists = nodes.some(n => n.data?.item?.id === item.id)
    if (exists) return

    const sourceNodes = nodes.filter(n => n.type === 'source')
    const position = await computePlacement(item, sourceNodes, organizeModeRef.current)

    const newNode: Node = {
      id: `source-${item.id}`,
      type: 'source',
      position,
      data: { item },
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    scheduleSave(updated, edges)
  }

  async function computePlacement(
    item: Item,
    sourceNodes: Node[],
    mode: string
  ): Promise<{ x: number; y: number }> {
    const NODE_W = 300
    const NODE_H = 220
    const PAD = 50
    const NODES_PER_ROW = 4

    if (sourceNodes.length === 0) {
      return { x: 200, y: 200 }
    }

    if (mode === 'similarity' && sourceNodes.length >= 1) {
      try {
        const existingIds = sourceNodes.map(n => (n.data as SourceNodeData).item.id)
        const pairs = await getItemSimilarities([item.id, ...existingIds], 0)
        const relevant = pairs.filter(p => p.source === item.id || p.target === item.id)
        if (relevant.length > 0) {
          const best = relevant.reduce((a, b) => a.similarity > b.similarity ? a : b)
          const neighborItemId = best.source === item.id ? best.target : best.source
          const neighborNode = sourceNodes.find(
            n => (n.data as SourceNodeData).item.id === neighborItemId
          )
          if (neighborNode) {
            return { x: neighborNode.position.x + NODE_W + PAD, y: neighborNode.position.y }
          }
        }
      } catch {
        // fall through to category placement
      }
    }

    // Category placement: grid layout within same-category group
    const category = item.category ?? ''
    const sameCategory = category
      ? sourceNodes.filter(n => (n.data as SourceNodeData).item.category === category)
      : []

    if (sameCategory.length > 0) {
      const col = sameCategory.length % NODES_PER_ROW
      const row = Math.floor(sameCategory.length / NODES_PER_ROW)
      const minX = Math.min(...sameCategory.map(n => n.position.x))
      const minY = Math.min(...sameCategory.map(n => n.position.y))
      return {
        x: minX + col * (NODE_W + PAD),
        y: minY + row * (NODE_H + PAD),
      }
    }

    // No same-category nodes: place to the right of all existing nodes
    const maxX = Math.max(...sourceNodes.map(n => n.position.x))
    return { x: maxX + NODE_W + PAD, y: 200 }
  }

  function addChatNode(item_ids: string[] = [], sourceNodeId?: string) {
    const id = `chat-${Date.now()}`
    const sourceNode = sourceNodeId ? nodes.find(n => n.id === sourceNodeId) : null
    const position = sourceNode
      ? { x: sourceNode.position.x + 360, y: sourceNode.position.y }
      : { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 }
    const newNode: Node = {
      id,
      type: 'chat',
      position,
      data: { item_ids, messages: [], title: 'Chat' },
    }
    const newEdges = sourceNodeId
      ? [...edges, { id: `sc-${sourceNodeId}-${id}`, source: sourceNodeId, target: id, type: 'source-chat' }]
      : edges
    const updatedNodes = [...nodes, newNode]
    setNodes(updatedNodes)
    setEdges(newEdges)
    scheduleSave(updatedNodes, newEdges)
  }

  async function handleOrganize() {
    const sourceNodes = nodes.filter(n => n.type === 'source')
    if (sourceNodes.length < 2) return

    let arranged: Node[]

    if (organizeModeRef.current === 'similarity') {
      const ids = sourceNodes.map(n => (n.data as SourceNodeData).item.id)
      const pairs = await getItemSimilarities(ids, 0)
      arranged = similarityLayout(sourceNodes, pairs)
    } else {
      arranged = categoryLayout(sourceNodes)
    }

    // Use applyNodeChanges so React Flow updates both `position` and `positionAbsolute`
    const changes: NodePositionChange[] = arranged.map(n => ({
      type: 'position',
      id: n.id,
      position: n.position,
      positionAbsolute: n.position,
      dragging: false,
    }))
    setNodes(prev => {
      const updated = applyNodeChanges(changes, prev) as Node[]
      scheduleSave(updated, edges)
      return updated
    })
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 100)
  }

  async function handlePickType(type: ConnectionType) {
    if (!pendingConnection) return
    const { connection } = pendingConnection
    setPendingConnection(null)

    const fromNode = nodes.find(n => n.id === connection.source)
    const toNode = nodes.find(n => n.id === connection.target)
    if (!fromNode || !toNode) return

    const sourceItemId = (fromNode.data as SourceNodeData).item.id
    const targetItemId = (toNode.data as SourceNodeData).item.id

    try {
      const conn = await createConnection(sourceItemId, targetItemId, type)
      const newEdge = {
        id: `manual-${conn.id}`,
        source: connection.source!,
        target: connection.target!,
        type: 'manual',
        data: { conn_id: conn.id, type: conn.type },
      }
      setEdges(prev => [...prev, newEdge])
    } catch (e) {
      console.error('Failed to create connection', e)
    }
  }

  function handleDismissConnection() {
    setPendingConnection(null)
  }

  const cssVar = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const accentColor   = cssVar('--color-accent')   || '#7c6af7'
  const surface3Color = cssVar('--color-surface-3') || '#2a2f47'
  const surfaceColor  = cssVar('--color-surface')   || '#0f1117'
  const isLightMode   = document.documentElement.getAttribute('data-theme') === 'light'

  function hexToRgba(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  return (
    <>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={changes => {
        onNodesChange(changes)
        scheduleSave()
      }}
      onEdgesChange={changes => {
        onEdgesChange(changes)
        scheduleSave()
      }}
      onConnect={onConnect}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      fitView
      minZoom={0.1}
      maxZoom={2}
      className="flex-1"
    >
      <Background variant={BackgroundVariant.Dots} color={surface3Color} gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={n => {
          if (n.type === 'source') return accentColor
          if (n.type === 'chat') return '#34d399'
          return '#475569'
        }}
        maskColor={isLightMode ? 'rgba(100, 116, 139, 0.35)' : hexToRgba(surfaceColor, 0.7)}
        pannable
        zoomable
        style={{ width: 200, height: 140 }}
        className="!border !border-surface-3 !rounded-xl"
      />
      {board && (
        <Toolbar
          boardId={board.id}
          onAddChat={() => addChatNode()}
          onOrganize={handleOrganize}
          organizeLabel={organizeLabel}
          on3DView={() => setThreeDOpen(true)}
        />
      )}
    </ReactFlow>
    {threeDOpen && <ThreeDMindMap onClose={() => setThreeDOpen(false)} />}
    {pendingConnection && (
      <ConnectionTypePicker
        x={pendingConnection.x}
        y={pendingConnection.y}
        onPick={handlePickType}
        onDismiss={handleDismissConnection}
      />
    )}
    </>
  )
}
