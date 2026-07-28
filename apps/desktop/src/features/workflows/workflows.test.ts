import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { SessionId } from '@goodboy/types';
import { invokeAgentList } from './workflows';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('workflow agent rows', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('maps the provider session owner returned by the Rust agent select', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        id: 'agent-1',
        sessionId: 'session-1',
        stepId: null,
        workflowRunId: null,
        parentAgentId: null,
        ordinal: 0,
        name: 'agent',
        status: 'pending',
        providerRunId: null,
        outputSummary: null,
        startedAt: null,
        completedAt: null,
        providerSessionId: 'codex-session',
        providerSessionProviderId: 'codex',
        lastFinishedAt: null,
        lastViewedAt: null,
        doneAt: null,
        kind: null,
        verbosity: null,
        effort: null,
        modelOverride: null,
        providerOverride: null,
        sourceThreadId: null,
        sourceThreadIds: null,
        sourceCommentUrl: null,
        sourceKind: null,
        domainsJson: null,
      },
    ]);

    const agents = await invokeAgentList('session-1' as SessionId);

    expect(agents[0]?.providerSessionId).toBe('codex-session');
    expect(agents[0]?.providerSessionProviderId).toBe('codex');
  });
});
