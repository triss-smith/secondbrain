import { useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getItemSimilarities } from '../api'
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

  // Load board state
  useEffect(() => {
    if (board?.state) {
      setNodes(board.state.nodes as Node[] ?? [])
      setEdges(board.state.edges ?? [])
    }
  }, [board?.id])

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
      const semanticEdges = pairs.map(p => ({
        id: `sem-${p.source}-${p.target}`,
        source: sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.source)!.id,
        target: sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.target)!.id,
        type: 'semantic',
        data: { similarity: p.similarity },
      }))
      setEdges(prev => [
        ...prev.filter(e => e.type !== 'semantic'),
        ...semanticEdges,
      ])
    })
  }, [nodes.filter(n => n.type === 'source').map(n => n.id).join(',')])

  function addSourceNode(item: Item) {
    const exists = nodes.some(n => n.data?.item?.id === item.id)
    if (exists) return
    const newNode: Node = {
      id: `source-${item.id}`,
      type: 'source',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { item },
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    scheduleSave(updated, edges)
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
      {board && (
        <Toolbar
          boardId={board.id}
          onAddChat={() => addChatNode()}
        />
      )}
    </ReactFlow>
  )
}
