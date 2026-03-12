interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative ml-4 shrink-0 w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

