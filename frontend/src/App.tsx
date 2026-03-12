import { useEffect, useState } from 'react'
import { Brain, PanelLeftClose, PanelLeftOpen, MessageSquare, Settings, Sun, Moon } from 'lucide-react'
import { ReactFlowProvider } from 'reactflow'
import { Board } from './canvas/Board'
import { CaptureBar } from './sidebar/CaptureBar'
import { Library } from './sidebar/Library'
import { GlobalChat } from './components/GlobalChat'
import { SettingsModal } from './components/SettingsModal'
import { UpdateBanner } from './components/UpdateBanner'
import { useTheme } from './hooks/useTheme'
import { ItemDetailModal } from './components/ItemDetailModal'
import type { Item } from './types'
import { Button } from './components/ui/Button'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(288)
  const [chatWidth, setChatWidth] = useState(320)
  const { isDark, themeId, setThemeId, toggleMode } = useTheme()

  // Hotkeys: Ctrl/Cmd+B = sidebar, Ctrl/Cmd+I = chat
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'b') { e.preventDefault(); setSidebarOpen(o => !o) }
      if (mod && e.key === 'i') { e.preventDefault(); setChatOpen(o => !o) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onOpenDetail(e: Event) {
      setDetailItemId((e as CustomEvent).detail.item_id)
    }
    window.addEventListener('open-item-detail', onOpenDetail)
    return () => window.removeEventListener('open-item-detail', onOpenDetail)
  }, [])

  function startSidebarResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(200, Math.min(600, startW + ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startChatResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = chatWidth
    const onMove = (ev: MouseEvent) => {
      setChatWidth(Math.max(260, Math.min(700, startW - (ev.clientX - startX))))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }


  function handleIngested(item: Item) {
    setRefreshTrigger(t => t + 1)
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  function handleAddToCanvas(item: Item) {
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <aside
        className={`flex flex-col border-r border-surface-3 bg-surface-1 shrink-0 relative ${
          sidebarOpen ? '' : 'w-0 overflow-hidden'
        }`}
        style={sidebarOpen ? { width: sidebarWidth } : undefined}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-3 shrink-0">
          <Brain size={20} className="text-accent" />
          <span className="text-sm font-bold text-white flex-1">Second Brain</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMode}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings size={14} />
          </Button>
        </div>
        <Library onAddToCanvas={handleAddToCanvas} refreshTrigger={refreshTrigger} />
        <CaptureBar onIngested={handleIngested} />
        {/* Sidebar resize handle */}
        <div
          onMouseDown={startSidebarResize}
          className="absolute right-0 top-0 h-full w-4 cursor-col-resize z-20 resize-handle-zone flex items-center justify-end"
        >
          <div className="resize-handle-line h-full w-px" />
        </div>
      </aside>

      {/* Main canvas area */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Top-left toggle */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="bg-surface-1 border border-surface-3 rounded-lg p-2 text-slate-400 hover:text-white transition-colors shadow"
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>

        {/* Top-right chat toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setChatOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors shadow text-sm font-medium ${
              chatOpen
                ? 'bg-accent border-accent text-white'
                : 'bg-surface-1 border-surface-3 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare size={15} />
            Ask Brain
          </button>
        </div>

        <ReactFlowProvider>
          <Board isDark={isDark} themeId={themeId} />
        </ReactFlowProvider>
      </main>

      {/* Right chat panel */}
      {chatOpen && (
        <div className="relative flex shrink-0" style={{ width: chatWidth }}>
          {/* Chat resize handle */}
          <div
            onMouseDown={startChatResize}
            className="absolute left-0 top-0 h-full w-4 cursor-col-resize z-20 resize-handle-zone flex items-center justify-start"
          >
            <div className="resize-handle-line h-full w-px" />
          </div>
          <GlobalChat onClose={() => setChatOpen(false)} />
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          themeId={themeId}
          onThemeChange={setThemeId}
        />
      )}

      {detailItemId && (
        <ItemDetailModal
          itemId={detailItemId}
          onClose={() => setDetailItemId(null)}
          onAddToCanvas={item => { handleAddToCanvas(item); setDetailItemId(null) }}
        />
      )}
      </div>
    </div>
  )
}
