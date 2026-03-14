import type { ConnectionType } from './types'

export interface ConnectionTypeConfig {
  label: string
  color: string
}

export const CONNECTION_TYPES: ConnectionType[] = [
  'related',
  'source',
  'inspired_by',
  'contradicts',
  'supports',
  'duplicate',
]

export const CONNECTION_TYPE_CONFIG: Record<ConnectionType, ConnectionTypeConfig> = {
  related: {
    label: 'Related',
    color: '#60a5fa',
  },
  source: {
    label: 'Source',
    color: '#34d399',
  },
  inspired_by: {
    label: 'Inspired by',
    color: '#f59e0b',
  },
  contradicts: {
    label: 'Contradicts',
    color: '#f87171',
  },
  supports: {
    label: 'Supports',
    color: '#a78bfa',
  },
  duplicate: {
    label: 'Duplicate',
    color: '#94a3b8',
  },
}

