import type { ProviderId } from '@goodboy/types'
import { getCheapModel, getDefaultBinary } from '../summarizer/client'

const GOAL_POLISH_SYSTEM_PROMPT = `You polish goal statements for AI coding workflows.

You receive a rough, hand-written goal. Rewrite it as a clear, specific objective for a team of coding agents.

Rules:
- Match the language of the input goal exactly. If the goal is written in Italian, write the polished goal in Italian; same for any other language.
- Preserve every concrete detail: file names, paths, feature names, constraints, do-not items.
- Imperative voice, one to three sentences.
- Do not invent requirements, scope, or constraints that are not in the input.
- Do not mention agents, workflows, or these instructions.

Output ONLY a single marker block, nothing before or after:
<<goal>>
the polished goal text
<</goal>>

Plain text inside the block. No markdown, no quotes, no trailing prose.`

export type GoalPolishDeps = {
  readonly providerId: ProviderId
  readonly binary?: string
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
}

type OneShotResult = {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

export const polishWorkflowGoal = async (
  deps: GoalPolishDeps,
  goal: string,
): Promise<string | null> => {
  const trimmed = goal.trim()
  if (trimmed.length === 0) {
    return null
  }

  const result = await deps.invokeFn<OneShotResult>('summarize_session', {
    args: {
      providerId: deps.providerId,
      model: getCheapModel(deps.providerId),
      binary: deps.binary ?? getDefaultBinary(deps.providerId),
      userMessage: `GOAL (rough draft):\n${trimmed}\n\nRewrite it as the single <<goal>> marker block.`,
      systemPrompt: GOAL_POLISH_SYSTEM_PROMPT,
    },
  })
  if ((result.exitCode ?? 0) !== 0) {
    return null
  }

  const text = extractText(deps.providerId, result.stdout)
  return parsePolishedGoal(text)
}

const GOAL_MARKER_OPEN = '<<goal>>'
const GOAL_MARKER_CLOSE = '<</goal>>'

export const parsePolishedGoal = (text: string): string | null => {
  let body: string | null = null
  let from = 0
  for (;;) {
    const open = text.indexOf(GOAL_MARKER_OPEN, from)
    if (open === -1) {
      break
    }
    const contentStart = open + GOAL_MARKER_OPEN.length
    const close = text.indexOf(GOAL_MARKER_CLOSE, contentStart)
    if (close === -1) {
      break
    }
    const inner = text.slice(contentStart, close).trim()
    if (inner.length > 0) {
      body = inner
    }
    from = close + GOAL_MARKER_CLOSE.length
  }
  if (body !== null) {
    return body
  }
  const fallback = text.trim()
  return fallback.length > 0 && !fallback.includes(GOAL_MARKER_OPEN) ? fallback : null
}

function extractText(providerId: ProviderId, stdout: string): string {
  const trimmed = stdout.trim()
  if (providerId === 'anthropic') {
    try {
      const parsed = JSON.parse(trimmed) as { result?: string }
      return (parsed.result ?? '').trim()
    } catch {
      return trimmed
    }
  }
  return trimmed
}
