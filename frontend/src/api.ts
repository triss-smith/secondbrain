import axios from 'axios'
import type { Board, BoardState, Item, Page, SearchResult } from './types'

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

// WebSocket chat
export const WS_CHAT_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat`
