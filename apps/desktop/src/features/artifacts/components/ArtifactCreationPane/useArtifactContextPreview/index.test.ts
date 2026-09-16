// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { DesignEvidence } from '../../../../wireframes/collectDesignProfile';

const { state, collectDesignProfile, slotsBySession } = vi.hoisted(() => {
  const slotsBySession: Record<string, ReadonlyArray<Record<string, unknown>>> = {};
  return {
    slotsBySession,
    collectDesignProfile: vi.fn<() => Promise<DesignEvidence>>(async () => ({ source: 'none' })),
    state: {
      ensureSessionSlots: async (
        sessionId: string,
      ): Promise<ReadonlyArray<Record<string, unknown>>> => slotsBySession[sessionId] ?? [],
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
  };
});

vi.mock('../../../../../store', () => {
  const useAppStore = <T>(selector: (s: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return { EMPTY_ARRAY: [] as readonly never[], useAppStore };
});

vi.mock('../../../../wireframes/collectWireframeDesignProfile', () => ({
  collectWireframeDesignProfile: collectDesignProfile,
}));

import { useArtifactContextPreview } from './index';
import type { ArtifactAttachment } from '../../../artifactAttachments';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));
const SCREEN: ArtifactAttachment = {
  id: 'att-inbox',
  fileName: 'inbox.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/att-inbox-inbox.png',
};

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
  slotsBySession[SESSION_ID] = [];
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
        secondChoice: 'both',
        attachments: [],
      }),
    );
    expect(result.current.status).toBe('collecting');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const ids = result.current.inventory.map((row) => row.id);
    expect(ids).toEqual([
      'brief',
      'attachments',
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
        secondChoice: 'both',
        attachments: [],
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
        secondChoice: 'both',
        attachments: [],
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
        secondChoice: 'both',
        attachments: [],
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(collectDesignProfile).toHaveBeenCalled();
    expect(result.current.inventory.find((row) => row.id === 'theme')?.summary).toBe(
      'no repository is mounted, so no design file was read',
    );
  });

  it('previews the walked repository that yielded nothing exactly as the spawn packs it', async () => {
    collectDesignProfile.mockResolvedValueOnce({
      source: 'mount',
      profile: {
        themeName: 'generic',
        commitSha: 'abc1234',
        tailwind: null,
        tokens: [],
        variants: [],
        layoutExamples: [],
        notes: ['the walk found no tailwind config in this repository'],
      },
    });
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'wireframe',
        basedOn: { kind: 'session' },
        choice: 'high',
        secondChoice: 'both',
        attachments: [],
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    await act(async () => {
      await Promise.resolve();
    });
    const theme = result.current.inventory.find((row) => row.id === 'theme');
    expect(theme?.summary).toBe('the mounted repository was walked and no design file was found');
    expect(theme?.detail).toEqual(['the walk found no tailwind config in this repository']);
  });
});

describe('useArtifactContextPreview session goal', () => {
  const LONG_GOAL = [
    'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
    'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
  ].join('\n\n');

  it.each(['report', 'wireframe'] as const)(
    'previews the goal the user wrote for a %s',
    async (kind) => {
      slotsBySession[SESSION_ID] = [{ key: 'goal', value: LONG_GOAL, enabled: true }];
      const { result } = renderHook(() =>
        useArtifactContextPreview({
          sessionId: SESSION_ID,
          kind,
          basedOn: { kind: 'session' },
          choice: kind === 'report' ? 'session-summary' : 'low',
          secondChoice: 'both',
          attachments: [],
        }),
      );
      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });
      expect(result.current.inventory.find((row) => row.id === 'goal')?.detail).toEqual([
        `the goal you wrote, ${LONG_GOAL.length} characters`,
      ]);
    },
  );

  it.each(['report', 'wireframe'] as const)(
    'counts an attached screen in the %s preview and names it in the inventory',
    async (kind) => {
      const { result } = renderHook(() =>
        useArtifactContextPreview({
          sessionId: SESSION_ID,
          kind,
          basedOn: { kind: 'session' },
          choice: kind === 'report' ? 'session-summary' : 'low',
          secondChoice: 'both',
          attachments: [SCREEN],
        }),
      );
      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });
      const row = result.current.inventory.find((entry) => entry.id === 'attachments');
      expect(row?.state).toBe('included');
      expect(row?.detail).toEqual(['inbox.png']);
    },
  );

  it.each(['report', 'wireframe'] as const)(
    'grows the %s pack by the attached paths it will send',
    async (kind) => {
      const sizeFor = async (attachments: ReadonlyArray<ArtifactAttachment>) => {
        const { result } = renderHook(() =>
          useArtifactContextPreview({
            sessionId: SESSION_ID,
            kind,
            basedOn: { kind: 'session' },
            choice: kind === 'report' ? 'session-summary' : 'low',
            secondChoice: 'both',
            attachments,
          }),
        );
        await waitFor(() => {
          expect(result.current.status).toBe('ready');
        });
        return result.current.size;
      };
      const bare = await sizeFor([]);
      cleanup();
      const withScreen = await sizeFor([SCREEN]);
      expect(withScreen).toBeGreaterThan(bare);
    },
  );

  it('keeps the goal row bare when the slot only repeats the title', async () => {
    const { result } = renderHook(() =>
      useArtifactContextPreview({
        sessionId: SESSION_ID,
        kind: 'report',
        basedOn: { kind: 'session' },
        choice: 'session-summary',
        secondChoice: 'both',
        attachments: [],
      }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.inventory.find((row) => row.id === 'goal')?.detail).toEqual([]);
  });
});
