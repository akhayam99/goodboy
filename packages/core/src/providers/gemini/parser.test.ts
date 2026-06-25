import { describe, expect, it } from 'vitest'
import type { IsoDateTime, ProviderRunId } from '@goodboy/types'
import { parseJsonLine, type ParseContext } from './parser'

const at = '2026-05-28T00:00:00.000Z' as IsoDateTime
const ctx: ParseContext = {
  runId: 'run_1' as ProviderRunId,
  now: () => at,
}

function parse(line: string) {
  return parseJsonLine(line, ctx)
}

describe('parseJsonLine (gemini v0.x)', () => {
  it('returns [] for empty / blank lines', () => {
    expect(parse('')).toEqual([])
    expect(parse('   ')).toEqual([])
  })

  it('treats plain text as an assistant_text delta with trailing newline', () => {
    const events = parse('Hello, world!')
    expect(events).toEqual([
      {
        kind: 'assistant_text',
        runId: ctx.runId,
        delta: 'Hello, world!\n',
        at,
      },
    ])
  })

  it('parses response.delta when CLI emits structured json', () => {
    const events = parse(JSON.stringify({ type: 'response.delta', text: 'hi' }))
    expect(events).toEqual([{ kind: 'assistant_text', runId: ctx.runId, delta: 'hi', at }])
  })

  it('skips response.completed (no event needed before done)', () => {
    expect(parse(JSON.stringify({ type: 'response.completed' }))).toEqual([])
  })

  it('extracts usage when emitted', () => {
    const events = parse(
      JSON.stringify({
        type: 'usage',
        usage: { input_tokens: 100, output_tokens: 50, cached_input_tokens: 10 },
      }),
    )
    expect(events).toEqual([
      {
        kind: 'usage',
        runId: ctx.runId,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cachedInputTokens: 10,
          estimatedCostUsd: 0,
        },
        at,
      },
    ])
  })

  it('surfaces error payloads', () => {
    const events = parse(JSON.stringify({ type: 'error', message: 'oops' }))
    expect(events).toEqual([{ kind: 'error', runId: ctx.runId, message: 'oops', at }])
  })
})
