// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const { state, collectDesignProfile } = vi.hoisted(() => ({
  collectDesignProfile: vi.fn(async () => null),
  state: {
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
    scriptRuns: {} as Record<string, Record<string, unknown>>,
    transcripts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionActiveMount: {},
    sessionActiveProject: {},
  },
}));

vi.mock('../../../../../store', () => {
  const useAppStore = <T>(selector: (s: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return { EMPTY_ARRAY: [] as readonly never[], useAppStore };
});

vi.mock('../../../../wireframes/collectWireframeDesignProfile', () => ({
  collectWireframeDesignProfile: collectDesignProfile,
}));

import { useArtifactContextPreview } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));

beforeEach(() => {
  vi.clearAllMocks();
  state.sessions = [
    JSON.parse(
      JSON.stringify({
        id: SESSION_ID,
        workspaceId: 'workspace-harborline',
        goal: 'Fix the rounding drift in ledger-core postings',
        workflowRuns: [],
      }),
    ),
  ];
  state.sessionPhaseRuns = {
    [SESSION_ID]: [
      { id: 'agent-1', sessionId: SESSION_ID, ordinal: 0, name: 'scout', status: 'completed' },
    ],
  };
  state.sessionArtifacts = {};
  state.sessionEvents = {};
  state.scriptRuns = {};
  state.transcripts = {};
  state.sessionMounts = {};
  state.sessionProjectMounts = {};
});

afterEach(cleanup);

describe('useArtifactContextPreview', () => {
  it('builds the report inventory from the same collector the spawn uses', async () => {
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'report',
        basedOn: { kind: 'session' },
        choice: 'session-summary',
      }),
    );
    expect(result.current.status).toBe('collecting');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const ids = result.current.inventory.map((row) => row.id);
    expect(ids).toEqual([
      'brief',
      'goal',
      'agents',
      'artifacts',
      'diff',
      'checks',
      'events',
      'excluded',
      'size',
    ]);
    expect(result.current.inventory.find((row) => row.id === 'diff')?.summary).toBe(
      'no mounted project',
    );
  });

  it('does not count a pending agent that has produced nothing', async () => {
    state.sessionPhaseRuns = {
      [SESSION_ID]: [
        { id: 'agent-1', sessionId: SESSION_ID, ordinal: 0, name: 'scout', status: 'completed' },
        { id: 'agent-2', sessionId: SESSION_ID, ordinal: 1, name: 'reviewer', status: 'pending' },
      ],
    };
    state.transcripts = {
      'agent-1': [
        { kind: 'assistant_text', runId: 'turn-1', at: '2026-09-16T10:00:00.000Z', delta: 'found' },
      ],
    };
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'report',
        basedOn: { kind: 'session' },
        choice: 'session-summary',
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const agents = result.current.inventory.find((row) => row.id === 'agents');
    expect(agents?.summary).toContain('1 of 1 agents');
    expect(agents?.detail).toEqual([]);
  });

  it('reads no design profile for a low fidelity wireframe', async () => {
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'wireframe',
        basedOn: { kind: 'session' },
        choice: 'low',
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(collectDesignProfile).not.toHaveBeenCalled();
    expect(result.current.inventory.find((row) => row.id === 'theme')?.summary).toBe(
      'plain wireframe, no design files read',
    );
  });

  it('collects the design profile once a high fidelity wireframe is picked', async () => {
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'wireframe',
        basedOn: { kind: 'session' },
        choice: 'high',
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(collectDesignProfile).toHaveBeenCalled();
  });
});
