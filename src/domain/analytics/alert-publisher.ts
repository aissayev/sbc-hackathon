// Proactive nudges — diff today's snapshot against yesterday's and push any
// NEW high-severity alert to the owner TG unprompted. Wired into the
// snapshot scheduler so the owner doesn't have to remember to /stats.
//
// "New" means the alert code wasn't present in the previous snapshot. This
// avoids pinging the owner every hour for the same backlog. When the alert
// resolves and reappears later, we ping again — which is the right behaviour.
//
// Severity gating: only `high` codes ping. `warn` and `info` show up in
// /stats but stay silent — they're not worth interrupting the operator.

import { sendTelegram } from '../../channels/telegram.ts'
import { config } from '../../config.ts'
import type { SnapshotRepository } from './repository.ts'
import type { DigitalPresenceSnapshot, AlertSignal } from './metrics.ts'

interface NudgeChannel {
  send: (text: string, keyboard?: Array<Array<{ text: string; data: string }>>) => Promise<void>
}

function defaultChannel(): NudgeChannel | null {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return null
  return {
    async send(text, keyboard) {
      try {
        await sendTelegram(token, chatId, text, keyboard)
      } catch {
        // best-effort; the alert is still in the snapshot for /stats
      }
    },
  }
}

/** Compare `current` against the previous saved snapshot. Returns the alert
 *  codes that are new (present now, absent before). */
export function diffNewHighAlerts(
  current: DigitalPresenceSnapshot,
  previous: DigitalPresenceSnapshot | null,
): AlertSignal[] {
  const currHigh = current.alerts.filter((a) => a.severity === 'high')
  if (!previous) return currHigh
  const prevCodes = new Set(previous.alerts.map((a) => a.code))
  return currHigh.filter((a) => !prevCodes.has(a.code))
}

/** Render one alert as a TG card. Inline keyboard offers the deeplink + an
 *  "open /stats" shortcut. */
function renderAlertCard(a: AlertSignal): {
  text: string
  keyboard: Array<Array<{ text: string; data: string }>>
} {
  const lines: string[] = [
    `🚨 ${a.msg}`,
    '',
    `code: ${a.code}`,
  ]
  const keyboard: Array<Array<{ text: string; data: string }>> = []
  if (a.cta) {
    keyboard.push([{ text: `Open ${a.cta}`, data: a.cta }])
  }
  keyboard.push([{ text: '📊 /stats', data: '/stats' }])
  return { text: lines.join('\n'), keyboard }
}

/** Find the snapshot that was current BEFORE this build, so we can diff
 *  against it. We use the same iso_date row's previous payload — but since
 *  save() overwrites in-place, we need a separate seed. The simplest signal:
 *  walk yesterday's snapshot. Good enough for the daily-cycle alert behaviour. */
export function findPriorSnapshot(
  repo: SnapshotRepository,
  current: DigitalPresenceSnapshot,
): DigitalPresenceSnapshot | null {
  const today = repo.get(current.iso_date)
  if (today && today.built_at < current.built_at) return today
  // Otherwise step back one day. ISO arithmetic.
  const d = new Date(current.iso_date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  const yesterday = d.toISOString().slice(0, 10)
  return repo.get(yesterday)
}

/** Top-level: given a freshly-built snapshot, push any NEW high-severity
 *  alerts to the owner via the configured channel. Returns the count of
 *  pushes for telemetry. */
export async function publishNewHighAlerts(
  current: DigitalPresenceSnapshot,
  repo: SnapshotRepository,
  channel: NudgeChannel | null = defaultChannel(),
): Promise<number> {
  if (!channel) return 0
  const previous = findPriorSnapshot(repo, current)
  const fresh = diffNewHighAlerts(current, previous)
  for (const a of fresh) {
    const card = renderAlertCard(a)
    await channel.send(card.text, card.keyboard)
  }
  return fresh.length
}
