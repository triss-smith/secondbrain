import {
  Youtube,
  Music2,
  FileText,
  Github,
  FileImage,
  Globe,
  Instagram,
  Linkedin,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { ContentType } from '../types'

export const CONTENT_TYPE_ICONS: Record<ContentType, LucideIcon> = {
  youtube: Youtube,
  tiktok: Music2,
  instagram: Instagram,
  podcast: Music2,
  article: Globe,
  pdf: FileText,
  github: Github,
  gdocs: FileImage,
  linkedin: Linkedin,
  note: StickyNote,
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  podcast: 'Podcast',
  article: 'Article',
  pdf: 'PDF',
  github: 'GitHub',
  gdocs: 'Google Doc',
  linkedin: 'LinkedIn',
  note: 'Note',
}

export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  youtube: '#ff4444',
  tiktok: '#69c9d0',
  instagram: '#e1306c',
  podcast: '#1db954',
  article: '#60a5fa',
  pdf: '#fb923c',
  github: '#a78bfa',
  gdocs: '#34d399',
  linkedin: '#0a66c2',
  note: '#facc15',
}
