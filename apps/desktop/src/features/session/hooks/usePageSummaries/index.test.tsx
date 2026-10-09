// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanArtifact,
  Session,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  ledgerCore,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import { usePageSummaries } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const base = sessionOf({ goal: 'Fix webhook retries' });
const sessionId = base.id as SessionId;

const planOf = (index: number): PlanArtifact => ({
  id: `artifact-${index}` as ArtifactId,
  sessionId,
  agentId: 'agent-planner' as AgentId,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: `Plan ${index}`,
  sourceFormat: 'markdown',
  sourceText: '# Plan',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: '2026-10-05T09:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-10-05T09:00:00.000Z' as IsoDateTime,
  openedAt: null,
});

describe('usePageSummaries', () => {
  it('says nothing about a session with nothing to count', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });

    expect(renderHook(() => usePageSummaries({ session: base })).result.current).toEqual({});
  });

  it('counts the artifacts with the noun last', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });
    useAppStore.setState({ sessionArtifacts: { [sessionId]: [planOf(1)] } });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.artifacts).toBe(
      '1 artifact',
    );

    useAppStore.setState({
      sessionArtifacts: { [sessionId]: [planOf(1), planOf(2), planOf(3), planOf(4)] },
    });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.artifacts).toBe(
      '4 artifacts',
    );
  });

  it('counts the open questions', () => {
    seedColumn({
      store: useAppStore,
      sessions: [base],
      currentSessionId: sessionId,
      questions: [base],
    });

    expect(renderHook(() => usePageSummaries({ session: base })).result.current.questions).toBe(
      '1 open',
    );
  });

  it('counts the branches only when the session has more than one mount', () => {
    seedColumn({
      store: useAppStore,
      sessions: [base],
      currentSessionId: sessionId,
      mounts: [[base, paymentsApi]],
    });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.branch).toBe(
      undefined,
    );

    useAppStore.setState({
      sessionProjectMounts: {
        [sessionId]: [
          mountOf({ session: base, project: paymentsApi }),
          mountOf({ session: base, project: ledgerCore }),
        ],
      },
    });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.branch).toBe(
      '2 branches',
    );
  });

  it('counts the runs, and the runs with a running agent', () => {
    const first = aWorkflowRun({ ordinal: 0 });
    const second = aWorkflowRun({ ordinal: 1 });
    const withRuns: Session = { ...base, workflowRuns: [first, second] };
    seedColumn({ store: useAppStore, sessions: [withRuns], currentSessionId: sessionId });
    expect(renderHook(() => usePageSummaries({ session: withRuns })).result.current.runs).toBe(
      '2 runs',
    );

    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({
            sessionId,
            status: 'running',
            workflowRunId: first.id as WorkflowRunId,
            stepId: 'step-1' as StepId,
          }),
        ],
      },
    });
    expect(renderHook(() => usePageSummaries({ session: withRuns })).result.current.runs).toBe(
      '1 running',
    );
  });

  it('counts the standalone agents, and the ones running', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({ sessionId, status: 'completed', ordinal: 0, name: 'Planner' }),
          anAgent({ sessionId, status: 'completed', ordinal: 1, name: 'Implementer' }),
        ],
      },
    });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.agents).toBe(
      '2 agents',
    );

    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({ sessionId, status: 'running', ordinal: 0, name: 'Planner' }),
          anAgent({ sessionId, status: 'completed', ordinal: 1, name: 'Implementer' }),
        ],
      },
    });
    expect(renderHook(() => usePageSummaries({ session: base })).result.current.agents).toBe(
      '1 running',
    );
  });
});
