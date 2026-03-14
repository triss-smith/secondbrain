import type { Item } from '../../types'
import { CONTENT_TYPE_COLORS, CONTENT_TYPE_ICONS } from '../../canvas/nodeUtils'
import { ItemBadge } from './ItemBadge'

interface ItemCardProps {
  item: Item
  compact?: boolean
  onClick?: () => void
  showThumbnail?: boolean
  categoryLabel?: string
}

export function ItemCard({ item, compact = false, onClick, showThumbnail = false, categoryLabel }: ItemCardProps) {
  const color = CONTENT_TYPE_COLORS[item.content_type] ?? '#7c6af7'
  const Icon = CONTENT_TYPE_ICONS[item.content_type]

  const summary = item.summary || item.snippet

  return (
    <div
      onClick={onClick}
      className={`flex ${compact ? 'items-start gap-3' : 'flex-col'} cursor-pointer`}
    >
      {showThumbnail && (
        <div
          className={`shrink-0 overflow-hidden rounded-lg flex items-center justify-center ${
            compact ? 'w-10 h-10' : 'w-full h-24'
          }`}
          style={{ background: `${color}22` }}
        >
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            Icon && <Icon size={compact ? 18 : 24} style={{ color }} />
          )}
        </div>
      )}

      <div className={compact ? 'flex-1 min-w-0' : 'mt-2'}>
        <div className="flex items-center gap-1 mb-1">
          <ItemBadge contentType={item.content_type} />
          {categoryLabel && (
            <span className="text-[9px] text-slate-600">· {categoryLabel}</span>
          )}
        </div>
        <p className={`font-medium text-white leading-snug ${compact ? 'text-xs truncate' : 'text-sm line-clamp-2'}`}>
          {item.title}
        </p>
        {summary && (
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500 line-clamp-2 mt-0.5`}>
            {summary}
          </p>
        )}
      </div>
    </div>
  )
}

