import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { SessionId } from '@goodboy/types';
import { invokeAgentList } from './workflows';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

type RawAgentParams = {
  readonly id: string;
  readonly status?: string;
};

const rawAgent = ({ id, status = 'pending' }: RawAgentParams) => ({
  id,
  sessionId: 'session-1',
  stepId: null,
  workflowRunId: null,
  parentAgentId: null,
  ordinal: 0,
  name: 'agent',
  status,
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
});

describe('workflow agent rows', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('maps the provider session owner returned by the Rust agent select', async () => {
    vi.mocked(invoke).mockResolvedValue([rawAgent({ id: 'agent-1' })]);

    const agents = await invokeAgentList('session-1' as SessionId);

    expect(agents[0]?.providerSessionId).toBe('codex-session');
    expect(agents[0]?.providerSessionProviderId).toBe('codex');
  });

  it('sequences refreshes for one session so an older snapshot settles first', async () => {
    let resolveFirst: (rows: ReadonlyArray<ReturnType<typeof rawAgent>>) => void = () => undefined;
    vi.mocked(invoke)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([rawAgent({ id: 'agent-1', status: 'completed' })]);

    const first = invokeAgentList('session-1' as SessionId);
    const second = invokeAgentList('session-1' as SessionId);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    resolveFirst([rawAgent({ id: 'agent-1', status: 'running' })]);

    await expect(first).resolves.toMatchObject([{ status: 'running' }]);
    await expect(second).resolves.toMatchObject([{ status: 'completed' }]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
