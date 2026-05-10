// Single source of truth for channel icon/colour/labels in the cockpit UI.
// Used by the channels grid, per-channel page, and the inbox row chips.

import type { LucideIcon } from 'lucide-react'
import { Phone, Instagram, Globe, Send, MapPin } from 'lucide-react'
import type { ChannelId } from '@/lib/api'

export interface ChannelMeta {
  label: string
  short: string
  icon: LucideIcon
  iconBg: string
  chip: string
  hex: string
  description: string
}

export const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  whatsapp: {
    label: 'WhatsApp',
    short: 'WA',
    icon: Phone,
    iconBg: 'bg-emerald-100 text-emerald-700',
    chip: 'bg-emerald-100 text-emerald-800',
    hex: '#25D366',
    description: 'Customers DM the bakery number — agent answers, escalates if unsure.',
  },
  instagram: {
    label: 'Instagram',
    short: 'IG',
    icon: Instagram,
    iconBg: 'bg-pink-100 text-pink-700',
    chip: 'bg-pink-100 text-pink-800',
    hex: '#E1306C',
    description: 'DMs + comments on the @happycake.us page. Agent replies, owner approves posts.',
  },
  web: {
    label: 'Website chat',
    short: 'Web',
    icon: Globe,
    iconBg: 'bg-sky/15 text-sky-700',
    chip: 'bg-sky/15 text-sky-800',
    hex: '#62B5E5',
    description: 'In-page widget on happycake.us — drives most order intake.',
  },
  telegram: {
    label: 'Telegram bot',
    short: 'TG',
    icon: Send,
    iconBg: 'bg-blue-100 text-blue-700',
    chip: 'bg-blue-100 text-blue-800',
    hex: '#229ED9',
    description: 'Owner cockpit — approvals, escalations, async commands.',
  },
  gbp: {
    label: 'Google Business',
    short: 'GBP',
    icon: MapPin,
    iconBg: 'bg-amber-100 text-amber-700',
    chip: 'bg-amber-100 text-amber-800',
    hex: '#4285F4',
    description: 'Reviews, posts, and Q&A on the bakery\'s Google profile.',
  },
}

export function modeLabel(mode: 'live' | 'sandbox' | 'local' | 'down'): string {
  if (mode === 'live') return 'Live'
  if (mode === 'sandbox') return 'Sandbox'
  if (mode === 'local') return 'Local'
  return 'Offline'
}

export function modeDot(mode: 'live' | 'sandbox' | 'local' | 'down'): string {
  if (mode === 'live') return 'bg-emerald-500'
  if (mode === 'sandbox') return 'bg-amber-500'
  if (mode === 'local') return 'bg-sky'
  return 'bg-cocoa-700/40'
}
