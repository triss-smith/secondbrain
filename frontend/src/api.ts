import axios from 'axios'
import type { Board, BoardState, Connection, ConnectionType, Item, Page, SearchResult } from './types'

const api = axios.create({ baseURL: '/api' })

// Items
export const listItems = (params?: { q?: string; content_type?: string }) =>
  api.get<Item[]>('/items', { params }).then(r => r.data)

export const listItemsGrouped = () =>
  api.get<{ label: string; items: Item[] }[]>('/items/grouped').then(r => r.data)

export const getItem = (id: string) =>
  api.get<Item>(`/items/${id}`).then(r => r.data)

export const ingestUrl = (url: string, title?: string) =>
  api.post<Item>('/items/ingest/url', { url, title }).then(r => r.data)

export const ingestText = (content: string, title?: string) =>
  api.post<Item>('/items/ingest/text', { content, title }).then(r => r.data)

export const ingestFile = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<Item>('/items/ingest/file', form).then(r => r.data)
}

export const updateItem = (id: string, data: { title?: string; tags?: string[]; summary?: string }) =>
  api.patch<Item>(`/items/${id}`, data).then(r => r.data)

export const deleteItem = (id: string) =>
  api.delete(`/items/${id}`).then(r => r.data)

export const resummarizeItem = (id: string) =>
  api.post<Item>(`/items/${id}/resummarize`).then(r => r.data)

export const getItemSimilarities = (item_ids: string[], threshold = 0.55) =>
  api.post<{ source: string; target: string; similarity: number }[]>(
    '/items/similarities',
    { item_ids, threshold }
  ).then(r => r.data)

// Boards
export const listBoards = () =>
  api.get<Board[]>('/boards').then(r => r.data)

export const createBoard = (name?: string) =>
  api.post<Board>('/boards', { name: name ?? 'My Brain' }).then(r => r.data)

export const getBoard = (id: string) =>
  api.get<Board>(`/boards/${id}`).then(r => r.data)

export const saveBoardState = (id: string, state: BoardState) =>
  api.put(`/boards/${id}/state`, { state }).then(r => r.data)

// Pages
export const listPages = (boardId: string) =>
  api.get<Page[]>(`/boards/${boardId}/pages`).then(r => r.data)

export const createPage = (boardId: string, title?: string, content?: string) =>
  api.post<Page>(`/boards/${boardId}/pages`, { title, content }).then(r => r.data)

export const updatePage = (boardId: string, pageId: string, data: { title?: string; content?: string }) =>
  api.put<Page>(`/boards/${boardId}/pages/${pageId}`, data).then(r => r.data)

export const deletePage = (boardId: string, pageId: string) =>
  api.delete(`/boards/${boardId}/pages/${pageId}`).then(r => r.data)

// Search
export const semanticSearch = (q: string, item_ids?: string[], n?: number) =>
  api.get<SearchResult[]>('/search', { params: { q, item_ids, n } }).then(r => r.data)

// Settings
export interface ProviderInfo {
  base_url: string
  sdk: string
  models: string[]
}

export interface SettingsResponse {
  provider: string
  model: string
  api_key_set: boolean
  organize_mode: string
  similarity_threshold: number
  enable_thinking: boolean
  providers: Record<string, ProviderInfo>
}

export const getSettings = () =>
  api.get<SettingsResponse>('/settings').then(r => r.data)

export const saveSettings = (data: { provider: string; model: string; api_key: string; organize_mode: string; similarity_threshold: number; enable_thinking: boolean }) =>
  api.put<{ provider: string; model: string; api_key_set: boolean; organize_mode: string; similarity_threshold: number; enable_thinking: boolean }>('/settings', data).then(r => r.data)

export const testConnection = () =>
  api.post<{ ok: boolean; error?: string }>('/settings/test').then(r => r.data)

// WebSocket chat
export const WS_CHAT_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat`

// Mind Map
export interface MindMapNodeData {
  item_id: string
  label: string
  content_type: string
  thumbnail: string | null
  summary: string
  snippet: string
}

export interface RawMindMapNode {
  id: string
  data: MindMapNodeData
}

export interface RawMindMapEdge {
  id: string
  source: string
  target: string
  data: { similarity: number }
}

export interface RawMindMapResponse {
  nodes: RawMindMapNode[]
  edges: RawMindMapEdge[]
}

export const getMindMap = () =>
  api.get<RawMindMapResponse>('/mind-map').then(r => r.data)

// Connections
export const listConnections = () =>
  api.get<Connection[]>('/connections').then(r => r.data)

export const createConnection = (source_item_id: string, target_item_id: string, type: ConnectionType) =>
  api.post<Connection>('/connections', { source_item_id, target_item_id, type }).then(r => r.data)

export const updateConnection = (id: number, type: ConnectionType) =>
  api.patch<Connection>(`/connections/${id}`, { type }).then(r => r.data)

export const deleteConnection = (id: number) =>
  api.delete(`/connections/${id}`).then(r => r.data)
