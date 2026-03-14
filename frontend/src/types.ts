export type ContentType =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'podcast'
  | 'article'
  | 'pdf'
  | 'github'
  | 'gdocs'
  | 'linkedin'
  | 'note'

export interface Item {
  id: string
  title: string
  source_url: string | null
  content_type: ContentType
  summary: string | null
  snippet: string
  thumbnail: string | null
  tags: string[]
  meta: Record<string, unknown>
  created_at: string
  content?: string
  formatted_content?: string | null
  category?: string
}

export interface Board {
  id: string
  name: string
  state: BoardState
  created_at: string
  updated_at: string
}

export interface BoardState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface CanvasNode {
  id: string
  type: 'source' | 'chat' | 'page'
  position: { x: number; y: number }
  data: SourceNodeData | ChatNodeData | PageNodeData
}

export interface SourceNodeData {
  item: Item
}

export interface ChatNodeData {
  item_ids: string[]
  messages: ChatMessage[]
  title: string
}

export interface PageNodeData {
  page_id: string
  title: string
  content: string
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  type?: string
  data?: Record<string, unknown>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type ConnectionType = 'related' | 'source' | 'inspired_by' | 'contradicts' | 'supports' | 'duplicate'

export interface Connection {
  id: number
  source_item_id: string
  target_item_id: string
  type: ConnectionType
  auto_generated: boolean
  created_at: string
}

export interface Page {
  id: string
  title: string
  content: string
  board_id: string | null
  created_at: string
  updated_at: string
}

export interface SearchResult {
  item: Pick<Item, 'id' | 'title' | 'content_type' | 'thumbnail' | 'source_url' | 'tags'>
  chunk: string
  score: number
}
