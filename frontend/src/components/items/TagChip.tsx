interface TagChipProps {
  label: string
  onRemove?: () => void
}

export function TagChip({ label, onRemove }: TagChipProps) {
  return (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-slate-400 group">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity text-[9px]"
        >
          ×
        </button>
      )}
    </span>
  )
}

