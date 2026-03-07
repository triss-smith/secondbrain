import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getSettings, getItemSimilarities } from '../api'
import { categoryLayout, similarityLayout } from './layout'
import { useBoard } from '../hooks/useBoard'
import type { Item, SourceNodeData } from '../types'
import { SemanticEdge } from './edges/SemanticEdge'
import { ChatNode } from './nodes/ChatNode'
import { PageNode } from './nodes/PageNode'
import { SourceNode } from './nodes/SourceNode'
import { Toolbar } from './Toolbar'

const NODE_TYPES = {
  source: SourceNode,
  chat: ChatNode,
  page: PageNode,
}

const EDGE_TYPES = {
  semantic: SemanticEdge,
}

interface Props {
  onItemDrop?: (item: Item) => void
}

export function Board({ }: Props) {
  const { board, saveState } = useBoard()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const organizeModeRef = useRef<string>('category')
  const [organizeLabel, setOrganizeLabel] = useState<'category' | 'similarity'>('category')
  const { fitView } = useReactFlow()

  // Load board state
  useEffect(() => {
    if (board?.state) {
      setNodes(board.state.nodes as Node[] ?? [])
      setEdges(board.state.edges ?? [])
    }
  }, [board?.id])

  useEffect(() => {
    getSettings().then(s => {
      const mode = s.organize_mode as 'category' | 'similarity'
      organizeModeRef.current = mode
      setOrganizeLabel(mode)
    })

    function onSettingsChanged(e: Event) {
      const mode = (e as CustomEvent<{ organize_mode: string }>).detail.organize_mode as 'category' | 'similarity'
      organizeModeRef.current = mode
      setOrganizeLabel(mode)
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  // Auto-save board state (debounced)
  function scheduleSave(ns = nodes, es = edges) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveState({ nodes: ns as never[], edges: es })
    }, 1500)
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      const updated = addEdge({ ...connection, type: 'semantic' }, edges)
      setEdges(updated)
      scheduleSave(nodes, updated)
    },
    [edges, nodes]
  )

  // Custom event listeners
  useEffect(() => {
    function onOpenChat(e: Event) {
      const { item_id } = (e as CustomEvent).detail
      addChatNode([item_id])
    }

    function onRemoveNode(e: Event) {
      const { item_id } = (e as CustomEvent).detail
      const updated = nodes.filter(n => n.data?.item?.id !== item_id)
      setNodes(updated)
      scheduleSave(updated, edges)
    }

    function onRemoveChatNode(e: Event) {
      const { node_id } = (e as CustomEvent).detail
      const updated = nodes.filter(n => n.id !== node_id)
      setNodes(updated)
      scheduleSave(updated, edges)
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
      // Remove source nodes for this item and update chat nodes
      setNodes(ns => ns
        .filter(n => n.data?.item?.id !== item_id)
        .map(n => {
          if (n.type === 'chat') {
            return { ...n, data: { ...n.data, item_ids: (n.data.item_ids as string[]).filter((id: string) => id !== item_id) } }
          }
          return n
        })
      )
    }

    window.addEventListener('open-chat', onOpenChat)
    window.addEventListener('remove-node', onRemoveNode)
    window.addEventListener('remove-chat-node', onRemoveChatNode)
    window.addEventListener('save-as-page', onSaveAsPage)
    window.addEventListener('item-deleted', onItemDeleted)

    return () => {
      window.removeEventListener('open-chat', onOpenChat)
      window.removeEventListener('remove-node', onRemoveNode)
      window.removeEventListener('remove-chat-node', onRemoveChatNode)
      window.removeEventListener('save-as-page', onSaveAsPage)
      window.removeEventListener('item-deleted', onItemDeleted)
    }
  }, [nodes, board?.id])

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

    getItemSimilarities(itemIds).then(pairs => {
      const semanticEdges = pairs.flatMap(p => {
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
  }, [nodes.filter(n => n.type === 'source').map(n => n.id).join(',')])

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

    // Category placement (default + similarity fallback)
    const category = item.category ?? ''
    const sameCategory = category
      ? sourceNodes.filter(n => (n.data as SourceNodeData).item.category === category)
      : []
    const group = sameCategory.length > 0 ? sameCategory : sourceNodes

    const cx = group.reduce((s, n) => s + n.position.x, 0) / group.length
    const cy = group.reduce((s, n) => s + n.position.y, 0) / group.length

    const offset = (sourceNodes.length % 3) * (NODE_W + PAD)
    return { x: cx + NODE_W + PAD + offset, y: cy + (sourceNodes.length % 2) * (NODE_H + PAD) }
  }

  function addChatNode(item_ids: string[] = []) {
    const id = `chat-${Date.now()}`
    const newNode: Node = {
      id,
      type: 'chat',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: { item_ids, messages: [], title: 'Chat' },
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    scheduleSave(updated, edges)
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

    const nonSource = nodes.filter(n => n.type !== 'source')
    const updated = [...nonSource, ...arranged]
    setNodes(updated)
    scheduleSave(updated, edges)
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 50)
  }

  return (
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
      <Background variant={BackgroundVariant.Dots} color="#2a2f47" gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={n => {
          if (n.type === 'source') return '#7c6af7'
          if (n.type === 'chat') return '#34d399'
          return '#475569'
        }}
        maskColor="rgba(15,17,23,0.7)"
      />
      <Panel position="top-center">
        <button
          onClick={handleOrganize}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-1 border border-surface-3 text-slate-400 hover:text-white hover:border-slate-500 rounded-lg shadow transition-colors"
          title={`Auto-organize (${organizeLabel === 'category' ? 'by category' : 'by similarity'})`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="3" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="21" cy="12" r="1"/>
            <circle cx="12" cy="21" r="1"/><circle cx="5.6" cy="5.6" r="1"/><circle cx="18.4" cy="5.6" r="1"/>
            <circle cx="5.6" cy="18.4" r="1"/><circle cx="18.4" cy="18.4" r="1"/>
            <line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
          Organize
        </button>
      </Panel>
      {board && (
        <Toolbar
          boardId={board.id}
          onAddChat={() => addChatNode()}
        />
      )}
    </ReactFlow>
  )
}
