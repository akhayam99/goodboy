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
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type PlanArtifact,
  type Session,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
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

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-fix-flaky' });

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: base.workspaceId,
  name: 'Fix flaky tests',
  description: '',
  steps: [1, 2].map((ordinal) => ({
    id: brandId<StepId>({ value: `step-${ordinal}` }),
    workflowId: WORKFLOW_ID,
    ordinal: ordinal - 1,
    name: `Step ${ordinal}`,
    promptPrefix: '',
  })),
  createdAt: brandId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
  updatedAt: brandId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' }),
};

const seedRuns = (session: Session): void => {
  seedColumn({ store: useAppStore, sessions: [session], currentSessionId: sessionId });
  useAppStore.setState({ sessionWorkflows: { [sessionId]: [workflow] } });
};

const factsOf = (session: Session) =>
  renderHook(() => usePageCountFacts({ session })).result.current;

describe('usePageCountFacts', () => {
  it('counts nothing on a session with nothing to count', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });

    expect(factsOf(base)).toEqual({
      runs: 0,
      runningRuns: 0,
      waitingRuns: 0,
      orchestratedRuns: 0,
      runningOrchestratedRuns: 0,
      waitingOrchestratedRuns: 0,
      agents: 0,
      runningAgents: 0,
      autoAgents: 0,
      workingAutoAgents: 0,
      artifacts: 0,
      openQuestions: 0,
    });
  });

  it('counts an Auto agent under Auto agents, never under Agents', () => {
    seedColumn({ store: useAppStore, sessions: [base], currentSessionId: sessionId });
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({
            id: brandId<AgentId>({ value: 'agent-scout' }),
            sessionId,
            kind: 'scout',
            status: 'completed',
          }),
          anAgent({
            id: brandId<AgentId>({ value: 'agent-auto' }),
            sessionId,
            kind: 'auto',
            status: 'running',
          }),
        ],
      },
    });

    expect(factsOf(base)).toMatchObject({ agents: 1, autoAgents: 1, workingAutoAgents: 1 });
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
    const first = aWorkflowRun({ ordinal: 0, workflowId: WORKFLOW_ID });
    const second = aWorkflowRun({ ordinal: 1, workflowId: WORKFLOW_ID });
    const dropped = aWorkflowRun({
      ordinal: 2,
      workflowId: WORKFLOW_ID,
      discardedAt: '2026-10-05T09:00:00.000Z' as IsoDateTime,
    });
    const withRuns: Session = { ...base, workflowRuns: [first, second, dropped] };
    seedRuns(withRuns);
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

  it('counts orchestrated runs apart from preset runs', () => {
    const preset = aWorkflowRun({ ordinal: 0, workflowId: WORKFLOW_ID });
    const orchestrated = aWorkflowRun({
      ordinal: 1,
      workflowId: WORKFLOW_ID,
      executionMode: 'dynamic',
    });
    const withRuns: Session = { ...base, workflowRuns: [preset, orchestrated] };
    seedRuns(withRuns);
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({
            sessionId,
            status: 'running',
            workflowRunId: orchestrated.id as WorkflowRunId,
            stepId: 'step-1' as StepId,
          }),
        ],
      },
    });

    expect(factsOf(withRuns)).toMatchObject({
      runs: 1,
      runningRuns: 0,
      orchestratedRuns: 1,
      runningOrchestratedRuns: 1,
    });
  });

  it('counts a run that waits on you or failed apart from a running one, the same dot the Runs row draws', () => {
    const waiting = aWorkflowRun({ ordinal: 0, workflowId: WORKFLOW_ID });
    const running = aWorkflowRun({ ordinal: 1, workflowId: WORKFLOW_ID });
    const withRuns: Session = { ...base, workflowRuns: [waiting, running] };
    seedRuns(withRuns);
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({
            sessionId,
            status: 'failed',
            workflowRunId: waiting.id,
            stepId: brandId<StepId>({ value: 'step-1' }),
          }),
          anAgent({
            sessionId,
            status: 'running',
            workflowRunId: running.id,
            stepId: brandId<StepId>({ value: 'step-1' }),
          }),
        ],
      },
    });

    expect(factsOf(withRuns)).toMatchObject({ runs: 2, runningRuns: 1, waitingRuns: 1 });
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
