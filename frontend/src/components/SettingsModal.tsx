import { useEffect, useState } from 'react'
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { getSettings, saveSettings, testConnection, type SettingsResponse } from '../api'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [organizeMode, setOrganizeMode] = useState('category')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(d => {
      setData(d)
      setProvider(d.provider)
      setModel(d.model)
      setOrganizeMode(d.organize_mode)
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const models = data?.providers[provider]?.models ?? []

  function handleProviderChange(p: string) {
    setProvider(p)
    setModel(data?.providers[p]?.models[0] ?? '')
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await saveSettings({ provider, model, api_key: apiKey, organize_mode: organizeMode })
      const result = await testConnection()
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, error: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({ provider, model, api_key: apiKey, organize_mode: organizeMode })
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: { organize_mode: organizeMode } }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!data ? (
            <div className="text-center py-8 text-slate-500 text-xs">Loading...</div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider</label>
                <select
                  value={provider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
                >
                  {Object.keys(data.providers).map(p => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
                >
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={data.api_key_set ? '••••••••••••••••' : 'Enter your API key...'}
                  className="w-full bg-surface-2 border border-surface-3 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder-slate-600"
                />
              </div>

              {/* Canvas */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Node placement</label>
                <div className="flex rounded-lg overflow-hidden border border-surface-3">
                  {(['category', 'similarity'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setOrganizeMode(mode)}
                      className={`flex-1 text-xs py-2 px-3 transition-colors ${
                        organizeMode === mode
                          ? 'bg-accent text-white font-semibold'
                          : 'bg-surface-2 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode === 'category' ? 'By category' : 'By similarity'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-600">
                  {organizeMode === 'category'
                    ? 'New nodes land near items in the same category. Auto-organize groups by category.'
                    : 'New nodes land near the most semantically similar item. Auto-organize uses a force-directed layout.'}
                </p>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testResult.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                  {testResult.ok
                    ? <><CheckCircle size={13} /> Connection successful</>
                    : <><XCircle size={13} /> {testResult.error ?? 'Connection failed'}</>
                  }
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pb-5">
          <button
            onClick={handleTest}
            disabled={testing || !data}
            className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-surface-3 hover:border-slate-500 transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {testing ? <><Loader2 size={12} className="animate-spin" /> Testing...</> : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !data}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
