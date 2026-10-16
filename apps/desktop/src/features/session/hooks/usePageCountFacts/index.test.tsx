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
import { seedColumn, sessionOf } from '../../../workspace/testing/sessionColumn';
import { usePageCountFacts } from '.';

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

const factsOf = (session: Session) =>
  renderHook(() => usePageCountFacts({ session })).result.current;

describe('usePageCountFacts', () => {
  it('counts nothing on a session with nothing to count', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });

    expect(factsOf(base)).toEqual({
      runs: 0,
      runningRuns: 0,
      agents: 0,
      runningAgents: 0,
      artifacts: 0,
      openQuestions: 0,
    });
  });

  it('counts the artifacts', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });
    useAppStore.setState({ sessionArtifacts: { [sessionId]: [planOf(1)] } });
    expect(factsOf(base).artifacts).toBe(1);

    useAppStore.setState({
      sessionArtifacts: { [sessionId]: [planOf(1), planOf(2), planOf(3), planOf(4)] },
    });
    expect(factsOf(base).artifacts).toBe(4);
  });

  it('counts the open questions', () => {
    seedColumn({
      store: useAppStore,
      sessions: [base],
      currentSessionId: sessionId,
      questions: [base],
    });

    expect(factsOf(base).openQuestions).toBe(1);
  });

  it('counts every kept run, and the ones running', () => {
    const first = aWorkflowRun({ ordinal: 0 });
    const second = aWorkflowRun({ ordinal: 1 });
    const dropped = aWorkflowRun({
      ordinal: 2,
      discardedAt: '2026-10-05T09:00:00.000Z' as IsoDateTime,
    });
    const withRuns: Session = { ...base, workflowRuns: [first, second, dropped] };
    seedColumn({ store: useAppStore, sessions: [withRuns], currentSessionId: sessionId });
    expect(factsOf(withRuns)).toMatchObject({ runs: 2, runningRuns: 0 });

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
    expect(factsOf(withRuns)).toMatchObject({ runs: 2, runningRuns: 1 });
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
    expect(factsOf(base)).toMatchObject({ agents: 2, runningAgents: 0 });

    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({ sessionId, status: 'running', ordinal: 0, name: 'Planner' }),
          anAgent({ sessionId, status: 'completed', ordinal: 1, name: 'Implementer' }),
        ],
      },
    });
    expect(factsOf(base)).toMatchObject({ agents: 2, runningAgents: 1 });
  });
});
