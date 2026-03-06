import { useState } from 'react'
import { Brain, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ReactFlowProvider } from 'reactflow'
import { Board } from './canvas/Board'
import { CaptureBar } from './sidebar/CaptureBar'
import { Library } from './sidebar/Library'
import type { Item } from './types'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  function handleIngested(item: Item) {
    setRefreshTrigger(t => t + 1)
    // Auto-add to canvas
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  function handleAddToCanvas(item: Item) {
    window.dispatchEvent(new CustomEvent('add-item-to-canvas', { detail: { item } }))
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-surface-3 bg-surface-1 transition-all duration-300 ${
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-3 shrink-0">
          <Brain size={20} className="text-accent" />
          <span className="text-sm font-bold text-white">Second Brain</span>
        </div>

        {/* Library */}
        <Library onAddToCanvas={handleAddToCanvas} refreshTrigger={refreshTrigger} />

        {/* Capture */}
        <CaptureBar onIngested={handleIngested} />
      </aside>

      {/* Main canvas area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="bg-surface-1 border border-surface-3 rounded-lg p-2 text-slate-400 hover:text-white transition-colors shadow"
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>

        <ReactFlowProvider>
          <Board />
        </ReactFlowProvider>
      </main>
    </div>
  )
}
