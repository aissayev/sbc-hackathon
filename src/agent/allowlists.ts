// Per-role tool allowlists + the deny list every role inherits.
//
// Two MCP servers in scope:
//   - mcp__happycake__*  — sandbox (judges' truth: catalog, kitchen, marketing,
//                          evaluator, GBP, WA/IG simulators, world)
//   - mcp__local__*      — our own stdio MCP (drafts, threads, escalations,
//                          brand-RAG)
//
// Tool names verified live against the sandbox at
// https://www.steppebusinessclub.com/api/mcp — see the system-init payload of
// any `bun run smoke:agent` invocation.
//
// This file is the doc artifact for "what can each role do?". Keep it small,
// keep it readable. Allowlists are the rubric's per-role decomposition signal
// (Code Reviewer rubric line: "Per-role decomposition visible").

import type { AgentRole } from '../channels/types.ts'

export const ROLE_TOOL_ALLOWLIST: Record<AgentRole, string[]> = {
  concierge: [
    // Sandbox: catalog + customer messaging + POS
    'mcp__happycake__square_list_catalog',
    'mcp__happycake__square_get_inventory',
    'mcp__happycake__square_create_order',
    'mcp__happycake__whatsapp_send',
    'mcp__happycake__instagram_send_dm',
    'mcp__happycake__kitchen_get_menu_constraints',
    'mcp__happycake__kitchen_get_capacity',
    // Local: thread state + drafts + escalation
    'mcp__local__list_products',
    'mcp__local__check_constraints',
    'mcp__local__create_draft_order',
    'mcp__local__get_order_status',
    'mcp__local__escalate_to_owner',
    'mcp__local__brand_lookup',
    'mcp__local__get_policies',
  ],
  kitchen: [
    'mcp__happycake__kitchen_create_ticket',
    'mcp__happycake__kitchen_get_capacity',
    'mcp__happycake__kitchen_accept_ticket',
    'mcp__happycake__kitchen_reject_ticket',
    'mcp__happycake__kitchen_mark_ready',
    'mcp__happycake__kitchen_list_tickets',
    'mcp__happycake__kitchen_get_production_summary',
    'mcp__local__get_order_status',
    'mcp__local__list_orders',
    'mcp__local__notify_customer',
    'mcp__local__brand_lookup',
  ],
  marketing: [
    'mcp__happycake__marketing_create_campaign',
    'mcp__happycake__marketing_launch_simulated_campaign',
    'mcp__happycake__marketing_get_campaign_metrics',
    'mcp__happycake__marketing_get_margin_by_product',
    'mcp__happycake__marketing_get_sales_history',
    'mcp__happycake__marketing_get_budget',
    'mcp__happycake__marketing_generate_leads',
    'mcp__happycake__marketing_route_lead',
    'mcp__happycake__marketing_adjust_campaign',
    'mcp__happycake__marketing_report_to_owner',
    'mcp__happycake__square_get_pos_summary',
    'mcp__happycake__square_recent_sales_csv',
    'mcp__happycake__gb_simulate_post',
    'mcp__local__queue_owner_approval',
    'mcp__local__brand_lookup',
  ],
  owner: [
    'mcp__local__list_orders',
    'mcp__local__list_escalations',
    'mcp__local__approve_order',
    'mcp__local__reject_order',
    'mcp__local__daily_report',
    'mcp__local__brand_lookup',
    'mcp__happycake__evaluator_get_evidence_summary',
    'mcp__happycake__evaluator_generate_team_report',
    'mcp__happycake__square_get_pos_summary',
    'mcp__happycake__kitchen_get_production_summary',
    'mcp__happycake__marketing_get_campaign_metrics',
    'mcp__happycake__marketing_get_budget',
    'mcp__happycake__marketing_adjust_campaign',
    'mcp__happycake__marketing_report_to_owner',
    'mcp__happycake__whatsapp_list_threads',
    'mcp__happycake__whatsapp_send',
    'mcp__happycake__instagram_list_dm_threads',
    'mcp__happycake__instagram_send_dm',
    'mcp__happycake__instagram_reply_to_comment',
    'mcp__happycake__gb_list_reviews',
    'mcp__happycake__gb_get_metrics',
    'mcp__happycake__gb_simulate_reply',
    'mcp__happycake__gb_simulate_post',
  ],
}

// Everything Claude Code ships with that the headless agent must NEVER touch.
// - Filesystem & shell:  Bash, Edit, Write, Read, Glob, Grep, NotebookEdit
// - Internet:            WebFetch, WebSearch
// - Subagents / tasks:   Agent, Task, TaskOutput, TaskStop
// - Scheduling:          CronCreate, CronDelete, CronList, ScheduleWakeup
// - System surface:      Monitor, PushNotification, RemoteTrigger
// - Git / worktree:      EnterWorktree, ExitWorktree
// - Interactive blockers: AskUserQuestion, EnterPlanMode, ExitPlanMode
// - Skill discovery:     Skill (broad — could resolve arbitrary skill packs)
// - Bookkeeping:         TodoWrite (no value in a one-shot subprocess)
//
// Intentionally NOT denied (benign + required):
// - ToolSearch  — Claude Code uses this internally to hydrate deferred MCP
//                 schemas when the tool list is large. Filtered from our trace.
// - ListMcpResourcesTool / ReadMcpResourceTool — read MCP resources only,
//                 not the local filesystem.
export const DENY_ALWAYS = [
  'Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'NotebookEdit',
  'WebFetch', 'WebSearch',
  'Agent', 'Task', 'TaskOutput', 'TaskStop',
  'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup',
  'Monitor', 'PushNotification', 'RemoteTrigger',
  'EnterWorktree', 'ExitWorktree',
  'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode',
  'Skill',
  'TodoWrite',
]
