import { describe, expect, it } from 'vitest'
import type { ProviderRunId, SessionId, TurnRequest } from '@goodboy/types'
import { CodexAdapter } from './adapter'

const RUN = process.env['CODEX_INTEGRATION'] === '1'

describe.skipIf(!RUN)('CodexAdapter, integration', () => {
  it('detects codex binary', async () => {
    const adapter = new CodexAdapter()
    const result = await adapter.detect()
    expect(result.kind).toBe('available')
    if (result.kind === 'available') {
      expect(result.version.length).toBeGreaterThan(0)
    }
  })

  it('completes a minimal turn and emits done', async () => {
    const adapter = new CodexAdapter()
    const request: TurnRequest = {
      runId: 'run_integration' as ProviderRunId,
      sessionId: 'sess_integration' as SessionId,
      model: 'codex-latest',
      workingDir: '/tmp',
      systemPrompt: '',
      userMessage: 'reply with exactly: ok',
    }

    const events = []
    for await (const event of adapter.spawn(request)) {
      events.push(event)
    }

    expect(events.some((e) => e.kind === 'done')).toBe(true)
  })
})
