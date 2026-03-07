import { MessageSquarePlus, ZoomIn, ZoomOut, Maximize2, LayoutGrid } from 'lucide-react'
import { useReactFlow } from 'reactflow'

interface Props {
  boardId: string
  onAddChat: () => void
  onOrganize: () => void
  organizeLabel: 'category' | 'similarity'
}

export function Toolbar({ onAddChat, onOrganize, organizeLabel }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-1 border border-surface-3 rounded-xl px-2 py-1.5 shadow-xl">
      <ToolButton onClick={onAddChat} title="New chat node">
        <MessageSquarePlus size={15} />
        <span className="text-[11px]">Chat</span>
      </ToolButton>

      <div className="w-px h-5 bg-surface-3 mx-1" />

      <ToolButton onClick={onOrganize} title={`Auto-organize (${organizeLabel === 'category' ? 'by category' : 'by similarity'})`}>
        <LayoutGrid size={15} />
        <span className="text-[11px]">Organize</span>
      </ToolButton>

      <div className="w-px h-5 bg-surface-3 mx-1" />

      <ToolButton onClick={() => zoomIn()} title="Zoom in">
        <ZoomIn size={15} />
      </ToolButton>
      <ToolButton onClick={() => zoomOut()} title="Zoom out">
        <ZoomOut size={15} />
      </ToolButton>
      <ToolButton onClick={() => fitView({ padding: 0.2 })} title="Fit view">
        <Maximize2 size={15} />
      </ToolButton>
    </div>
  )
}

function ToolButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-2 transition-colors"
    >
      {children}
    </button>
  )
}
