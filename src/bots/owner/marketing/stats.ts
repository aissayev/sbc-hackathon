// /stats — one-screen digital-presence dashboard.
//
// Reads the cached SnapshotRepository if a row exists for today; otherwise
// builds a fresh snapshot synchronously. Either way the call is fast (cached
// path is a single SQLite read).

import {
  buildSnapshot,
  SqliteSnapshotRepository,
  type DigitalPresenceSnapshot,
  attributionPct,
  fmtUsd,
  isoDateOf,
  postingShortfall,
  spendBurnPct,
} from '../../../domain/analytics/index.ts'

export interface BotReply {
  text: string
  keyboard?: Array<Array<{ text: string; data: string }>>
}

const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour cache

export async function handleStatsCommand(): Promise<BotReply> {
  const repo = new SqliteSnapshotRepository()
  const today = isoDateOf(Date.now())
  const cached = repo.get(today)
  let snapshot: DigitalPresenceSnapshot
  if (cached && Date.now() - cached.built_at < MAX_AGE_MS) {
    snapshot = cached
  } else {
    snapshot = await buildSnapshot()
    repo.save(snapshot)
  }
  return { text: render(snapshot), keyboard: keyboardFor(snapshot) }
}

function render(s: DigitalPresenceSnapshot): string {
  const minutesAgo = Math.max(0, Math.round((Date.now() - s.built_at) / 60_000))
  const cadenceArrow =
    s.posts.posts_7d >= s.posts.cadence_target ? '✓' : '↓'
  const ratingDisplay = s.reviews.avg_rating > 0 ? s.reviews.avg_rating.toFixed(1) : '—'
  const burn = spendBurnPct(s.budget)
  const shortfall = postingShortfall(s.posts)
  const attribPct = attributionPct(s.attribution)

  const lines: string[] = [
    `📊 Digital presence — ${s.iso_date} (refreshed ${minutesAgo}m ago)`,
    '',
    'Posting:',
    `  ${cadenceArrow} ${s.posts.posts_7d}/${s.posts.cadence_target} posts in last 7d` +
      (shortfall > 0 ? ` · need ${shortfall} more` : ''),
    `  ${s.posts.scheduled_7d} scheduled · ${s.posts.pending_review} awaiting approval`,
    '',
    'Engagement:',
    `  ${s.engagement.inbox_open} open DM thread${s.engagement.inbox_open === 1 ? '' : 's'} · ` +
      `💚 ${s.engagement.sentiment_split.positive} ⚠️ ${s.engagement.sentiment_split.negative} 🚨 ${s.engagement.sentiment_split.risk}`,
    s.engagement.unhandled_risk > 0
      ? `  🚨 ${s.engagement.unhandled_risk} unhandled risk item${s.engagement.unhandled_risk === 1 ? '' : 's'}`
      : '  ✓ no unhandled risk items',
    '',
    'Reviews:',
    `  ${s.reviews.total_visible} visible · ⭐ ${ratingDisplay} avg · ${s.reviews.unanswered} unanswered`,
    s.reviews.negative_velocity_48h > 0
      ? `  ⚠ ${s.reviews.negative_velocity_48h} negative in last 48h`
      : '  ✓ no negative reviews in last 48h',
    '',
    'Budget MTD:',
    `  ${fmtUsd(s.budget.mtd_spend_cents)} of ${fmtUsd(s.budget.monthly_cap_cents)} (${burn}%)`,
    `  ${s.budget.active_campaigns} active campaign${s.budget.active_campaigns === 1 ? '' : 's'} · ${s.budget.mtd_leads} leads`,
    '',
    'Attribution MTD:',
    s.attribution.total_orders === 0
      ? '  no MTD orders yet'
      : `  ${s.attribution.attributed_orders}/${s.attribution.total_orders} orders attributed (${attribPct}%)`,
  ]

  if (s.attribution.top_sources.length > 0) {
    lines.push('  Top sources:')
    for (const t of s.attribution.top_sources) {
      lines.push(`    ${t.source.padEnd(12)} ${t.orders}× ${fmtUsd(t.revenue_cents)}`)
    }
  }

  if (s.alerts.length > 0) {
    lines.push('', 'Alerts:')
    for (const a of s.alerts) {
      const glyph = a.severity === 'high' ? '🚨' : a.severity === 'warn' ? '⚠' : 'ℹ'
      lines.push(`  ${glyph} ${a.msg}` + (a.cta ? ` (${a.cta})` : ''))
    }
  }

  return lines.join('\n')
}

function keyboardFor(s: DigitalPresenceSnapshot): Array<Array<{ text: string; data: string }>> {
  const buttons: Array<Array<{ text: string; data: string }>> = []
  // Surface deeplinks for any high-severity alert.
  for (const a of s.alerts) {
    if (a.severity !== 'high' || !a.cta) continue
    buttons.push([{ text: `🚨 ${a.cta}`, data: a.cta }])
  }
  buttons.push([
    { text: '📋 Drafts', data: '/drafts' },
    { text: '📅 Plan', data: '/content' },
  ])
  buttons.push([
    { text: '📥 Comments', data: '/comments' },
    { text: '⭐ Reviews', data: '/reviews' },
  ])
  buttons.push([
    { text: '💰 Spend', data: '/spend' },
    { text: '📣 Campaigns', data: '/campaigns' },
  ])
  buttons.push([{ text: '🔄 Rebuild now', data: 'cs_stats_rebuild' }])
  return buttons
}
