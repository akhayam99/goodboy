import { describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const invokeSpy = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';

const SESSION_ID = 'ses-1' as SessionId;

describe('loadPhaseRunsForSession', () => {
  it('preserves a spawned agent provider, model and effort after a refresh', async () => {
    invokeSpy.mockResolvedValueOnce([
      {
        id: 'agent-new',
        sessionId: SESSION_ID,
        stepId: null,
        workflowRunId: null,
        parentAgentId: null,
        ordinal: 0,
        name: 'scout',
        status: 'pending',
        providerRunId: null,
        outputSummary: null,
        startedAt: null,
        completedAt: null,
        providerSessionId: null,
        lastFinishedAt: null,
        lastViewedAt: null,
        doneAt: null,
        kind: 'scout',
        verbosity: null,
        effort: 'high',
        modelOverride: 'claude-opus-5',
        providerOverride: 'anthropic',
        sourceThreadId: null,
        sourceThreadIds: null,
        sourceCommentUrl: null,
        sourceKind: null,
        domainsJson: null,
      },
    ]);

    let state: Partial<AppStore> = { sessionPhaseRuns: {} };
    const set: SetFn = (update) => {
      const patch = typeof update === 'function' ? update(state as AppStore) : update;
      state = { ...state, ...patch };
    };

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(state.sessionPhaseRuns?.[SESSION_ID]?.[0]).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'claude-opus-5',
      effort: 'high',
    });
  });
});
