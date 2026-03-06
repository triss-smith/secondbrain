import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Pencil, Trash2, Check } from 'lucide-react'
import type { PageNodeData } from '../../types'
import { updatePage } from '../../api'

export function PageNode({ data, id, selected }: NodeProps<PageNodeData>) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(data.title)
  const [content, setContent] = useState(data.content)

  async function save() {
    setEditing(false)
    // Extract board_id from node id convention: page-{boardId}-{pageId}
    const parts = id.split('-')
    const boardId = parts[1]
    const pageId = parts[2]
    try {
      await updatePage(boardId, pageId, { title, content })
    } catch (e) {
      console.error('Failed to save page', e)
    }
  }

  return (
    <div
      className={`w-64 rounded-xl border transition-all bg-surface-1 ${
        selected ? 'border-accent' : 'border-surface-3'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent !border-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-accent !border-0 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-3 bg-surface-2 rounded-t-xl">
        {editing ? (
          <input
            className="nodrag flex-1 bg-transparent text-xs font-semibold text-white outline-none"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        ) : (
          <p className="text-xs font-semibold text-white truncate flex-1">{title}</p>
        )}
        <div className="flex gap-1 ml-2">
          {editing ? (
            <button className="nodrag text-accent p-1" onClick={save}>
              <Check size={12} />
            </button>
          ) : (
            <button
              className="nodrag text-slate-400 hover:text-white p-1 transition-colors"
              onClick={() => setEditing(true)}
            >
              <Pencil size={12} />
            </button>
          )}
          <button
            className="nodrag text-slate-500 hover:text-red-400 p-1 transition-colors"
            onClick={() => {
              const event = new CustomEvent('remove-page-node', { detail: { node_id: id } })
              window.dispatchEvent(event)
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {editing ? (
          <textarea
            className="nodrag w-full bg-surface-2 text-xs text-slate-300 rounded-lg p-2 outline-none resize-none"
            rows={6}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-8">
            {content || <span className="italic text-slate-600">Empty page</span>}
          </p>
        )}
      </div>
    </div>
  )
}
