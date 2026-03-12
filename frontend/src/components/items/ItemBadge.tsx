import type { ContentType } from '../../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_LABELS } from '../../canvas/nodeUtils'

interface ItemBadgeProps {
  contentType: ContentType
}

export function ItemBadge({ contentType }: ItemBadgeProps) {
  const color = CONTENT_TYPE_COLORS[contentType] ?? '#7c6af7'
  const label = CONTENT_TYPE_LABELS[contentType]

  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
      style={{ background: `${color}33`, color }}
    >
      {label}
    </span>
  )
}

