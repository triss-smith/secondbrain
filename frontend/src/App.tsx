import { useState } from 'react'
import { Brain, PanelLeftClose, PanelLeftOpen, MessageSquare, Settings, Sun, Moon } from 'lucide-react'
import { ReactFlowProvider } from 'reactflow'
import { Board } from './canvas/Board'
import { CaptureBar } from './sidebar/CaptureBar'
import { Library } from './sidebar/Library'
import { GlobalChat } from './components/GlobalChat'
import { SettingsModal } from './components/SettingsModal'
import { useTheme } from './hooks/useTheme'
import type { Item } from './types'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { isDark, themeId, setThemeId, toggleMode } = useTheme()

  function handleIngested(item: Item) {
    setRefreshTrigger(t => t + 1)
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  function handleAddToCanvas(item: Item) {
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      {/* Left sidebar */}
      <aside
        className={`flex flex-col border-r border-surface-3 bg-surface-1 transition-all duration-300 shrink-0 ${
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-3 shrink-0">
          <Brain size={20} className="text-accent" />
          <span className="text-sm font-bold text-white flex-1">Second Brain</span>
          <button
            onClick={toggleMode}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg"
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
        <Library onAddToCanvas={handleAddToCanvas} refreshTrigger={refreshTrigger} />
        <CaptureBar onIngested={handleIngested} />
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
      {chatOpen && <GlobalChat onClose={() => setChatOpen(false)} />}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          themeId={themeId}
          onThemeChange={setThemeId}
        />
      )}
    </div>
  )
}
