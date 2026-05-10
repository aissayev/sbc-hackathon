// Brand-RAG. Tiny keyword-overlap retriever over the canonical brand-rules
// markdown so the agent can ground brand-voice / naming / visual decisions
// in a single source of truth instead of memorizing it. The brand file is
// small (~100 lines), so loading it once and scoring sections by token
// overlap is more than enough — no embeddings, no external deps.
//
// Surfaced to the agent as the `brand_lookup` tool on the local MCP server
// (the role allowlists in src/agent/allowlists.ts already grant access to
// concierge, kitchen, marketing, and owner roles).
//
// Reads docs/agent-context/brand-rules.md. That file is committed to the
// repo so the tool is reproducible from a fresh clone. If it goes missing
// the tool returns a structured error rather than throwing.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

export const brandLookupSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'What to look up — e.g. "cake naming", "voice rules", "halal", "logo on dark", "tagline".',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(5)
    .optional()
    .describe('Max sections to return. Default 3.'),
})

interface Section {
  heading: string
  level: number
  tokens: Set<string>
  body: string
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'about',
  'we', 'our', 'us', 'you', 'your', 'they', 'them', 'their',
  'this', 'that', 'these', 'those', 'it', 'its',
  'so', 'if', 'than', 'then', 'too', 'very',
  'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'should', 'would',
])

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

let cachedSections: Section[] | null = null

const BRAND_RULES_REL_PATH = ['docs', 'agent-context', 'brand-rules.md']

function loadBrandRules(): Section[] {
  if (cachedSections) return cachedSections
  // Resolve relative to this file so the MCP works no matter where
  // claude -p is launched from. Repo root is three levels up
  // (src/agent/mcp/brand-rag.ts → src/agent → src → repo root).
  const path = resolve(import.meta.dir, '..', '..', '..', ...BRAND_RULES_REL_PATH)
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    cachedSections = []
    return cachedSections
  }

  // Split on `## ` or `### ` so each section gets its own snippet. Deeper
  // headings stay nested inside their parent's body.
  const sections: Section[] = []
  const lines = text.split('\n')
  let buf: string[] = []
  let heading = 'Preface'
  let level = 1
  const flush = () => {
    if (!buf.length) return
    const body = buf.join('\n').trim()
    if (!body) return
    sections.push({
      heading,
      level,
      tokens: new Set([...tokenize(heading), ...tokenize(body)]),
      body,
    })
  }
  for (const line of lines) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line)
    if (m) {
      flush()
      buf = []
      level = m[1].length
      heading = m[2].trim()
      continue
    }
    buf.push(line)
  }
  flush()
  cachedSections = sections
  return sections
}

export function brandLookup(args: z.infer<typeof brandLookupSchema>) {
  const sections = loadBrandRules()
  if (!sections.length) {
    return {
      ok: false,
      reason: `brand-rules.md not found at ${BRAND_RULES_REL_PATH.join('/')}`,
    }
  }
  const queryTokens = tokenize(args.query)
  if (!queryTokens.length) {
    return { ok: false, reason: 'query had no usable tokens (try keywords ≥ 3 chars)' }
  }

  const scored = sections.map((s) => {
    let hits = 0
    for (const t of queryTokens) if (s.tokens.has(t)) hits++
    // Heading match is worth more — it usually means the section is about
    // exactly that topic.
    const headingTokens = new Set(tokenize(s.heading))
    let headingHits = 0
    for (const t of queryTokens) if (headingTokens.has(t)) headingHits++
    return { section: s, score: hits + headingHits * 3 }
  })

  const top = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 3)

  if (!top.length) {
    return {
      ok: true,
      query: args.query,
      matches: [],
      note: 'No sections matched. Try broader keywords.',
    }
  }
  return {
    ok: true,
    query: args.query,
    matches: top.map((x) => ({
      heading: x.section.heading,
      level: x.section.level,
      score: x.score,
      // Cap each excerpt so a single large section doesn't drown the response.
      excerpt: x.section.body.slice(0, 1200),
      truncated: x.section.body.length > 1200,
    })),
  }
}
