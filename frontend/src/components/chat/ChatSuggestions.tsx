interface ChatSuggestionProps {
  suggestion: string
  onSelect: (value: string) => void
}

export function ChatSuggestion({ suggestion, onSelect }: ChatSuggestionProps) {
  return (
    <button
      onClick={() => onSelect(suggestion)}
      className="w-full text-left text-xs text-slate-400 hover:text-white bg-surface-2 hover:bg-surface-3 px-3 py-2 rounded-lg transition-colors"
    >
      {suggestion}
    </button>
  )
}

interface ChatSuggestionsProps {
  suggestions: string[]
  onSelect: (value: string) => void
}

export function ChatSuggestions({ suggestions, onSelect }: ChatSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2 pt-2">
      {suggestions.map(suggestion => (
        <ChatSuggestion
          key={suggestion}
          suggestion={suggestion}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

