import { describe, expect, it } from 'vitest';
import type { ProviderRunId, SessionId, TurnRequest } from '@goodboy/types';
import { CursorAdapter } from './adapter';

const enabled = process.env['CURSOR_INTEGRATION'] === '1';

describe.skipIf(!enabled)('CursorAdapter, integration (requires cursor-agent + auth)', () => {
  it('detect() reports cursor-agent as available', async () => {
    const adapter = new CursorAdapter();
    const result = await adapter.detect();
    expect(result.kind).toBe('available');
    console.info('[cursor integration] version:', (result as { version?: string }).version);
  });

  it('streams at least one assistant_text from a real prompt', async () => {
    const adapter = new CursorAdapter();
    const request: TurnRequest = {
      runId: 'run_integration' as ProviderRunId,
      sessionId: 'sess_integration' as SessionId,
      model: 'composer-2',
      workingDir: '/tmp',
      systemPrompt: 'You are a test assistant. Be brief.',
      userMessage: 'Reply with only: "integration ok"',
    };

    const events = [];
    for await (const event of adapter.spawn(request)) {
      events.push(event);
      if (event.kind === 'done' || event.kind === 'error') {
        break;
      }
    }

    const textEvents = events.filter((e) => e.kind === 'assistant_text');
    expect(textEvents.length).toBeGreaterThan(0);
  });
});
