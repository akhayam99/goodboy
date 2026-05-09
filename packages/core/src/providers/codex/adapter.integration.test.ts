import { describe, expect, it } from 'vitest';
import type { ProviderRunId, TaskId, TurnRequest } from '@kay-am/types';
import { CodexAdapter } from './adapter';

// Integration test — requires a real `codex` binary in PATH.
// Run with: CODEX_INTEGRATION=1 pnpm -w test
const RUN = process.env['CODEX_INTEGRATION'] === '1';

describe.skipIf(!RUN)('CodexAdapter — integration', () => {
  it('detects codex binary', async () => {
    const adapter = new CodexAdapter();
    const result = await adapter.detect();
    expect(result.kind).toBe('available');
    if (result.kind === 'available') {
      expect(result.version.length).toBeGreaterThan(0);
    }
  });

  it('completes a minimal turn and emits done', async () => {
    const adapter = new CodexAdapter();
    const request: TurnRequest = {
      runId: 'run_integration' as ProviderRunId,
      taskId: 'sess_integration' as TaskId,
      model: 'codex-latest',
      workingDir: '/tmp',
      systemPrompt: '',
      userMessage: 'reply with exactly: ok',
    };

    const events = [];
    for await (const event of adapter.spawn(request)) {
      events.push(event);
    }

    expect(events.some((e) => e.kind === 'done')).toBe(true);
  });
});
