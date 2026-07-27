import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, Session, SessionId, Workflow, WorkspaceId } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  agentHasUnread: () => false,
  useAppStore: Object.assign((selector: (s: StoreState) => unknown) => selector(store.state), {
    getState: () => store.state,
  }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T>(selector: T) => selector,
}));

vi.mock('../../../../store/slices/session-view', () => ({
  deriveSessionStage: () => ({ stage: 'running', reason: 'agent running' }),
  isPrReviewSession: () => false,
}));

import { useWorkspaceRuns } from './index';

const WS = 'ws-1' as WorkspaceId;
const SID = 'sess-1' as SessionId;

const makeAgent = (over: Record<string, unknown>): Agent =>
  ({
    id: 'a',
    sessionId: SID,
    ordinal: 0,
    name: 'agent',
    status: 'completed',
    ...over,
  }) as unknown as Agent;

const workflow: Workflow = {
  id: 'wf-1',
  workspaceId: WS,
  name: 'Ship it',
  description: '',
  steps: [
    { id: 'step-scout', workflowId: 'wf-1', ordinal: 0, name: 'Scout the area', promptPrefix: '' },
    {
      id: 'step-impl',
      workflowId: 'wf-1',
      ordinal: 1,
      name: 'Implement feature',
      promptPrefix: '',
    },
    { id: 'step-review', workflowId: 'wf-1', ordinal: 2, name: 'Review diff', promptPrefix: '' },
  ],
  createdAt: '2026-01-01T00:00:00Z' as Session['createdAt'],
  updatedAt: '2026-01-01T00:00:00Z' as Session['updatedAt'],
} as unknown as Workflow;

const session: Session = {
  id: SID,
  workspaceId: WS,
  goal: 'do the thing',
  state: { kind: 'idle' },
  contextSlots: [],
  workflowRuns: [
    {
      id: 'run-1',
      workflowId: 'wf-1',
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
    },
  ],
  autoRun: false,
} as unknown as Session;

const baseState = (over: Partial<StoreState> = {}): StoreState => ({
  sessionPhaseRuns: {},
  sessionTelemetry: {},
  agentRunHistory: {},
  agentKindOverride: {},
  selectedAgentId: {},
  phaseTemplates: { [WS]: [workflow] },
  sessionGithub: {},
  sessionBranches: {},
  sessionOpenQuestions: {},
  currentSessionId: null,
  ...over,
});

function reset() {
  store.state = baseState();
}

describe('useWorkspaceRuns', () => {
  beforeEach(reset);
  afterEach(reset);

  it('groups spawned agents under their run step and renders ghost steps for unspawned template steps', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'scout-1',
            name: 'scout',
            workflowRunId: 'run-1',
            stepId: 'step-scout',
            runId: 'r-scout',
            status: 'completed',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.lanes).toHaveLength(1);
    const lane = result.current.lanes[0]!;
    expect(lane.runId).toBe('run-1');
    expect(lane.workflowName).toBe('Ship it');
    expect(lane.autoRun).toBe(true);
    expect(lane.steps).toHaveLength(3);
    const scoutStep = lane.steps[0]!;
    expect(scoutStep.status).toBe('done');
    expect(scoutStep.rootAgentId).toBe('scout-1');
    expect(scoutStep.children).toHaveLength(1);
    const implStep = lane.steps[1]!;
    expect(implStep.status).toBe('planned');
    expect(implStep.rootAgentId).toBeNull();
    expect(implStep.children).toHaveLength(0);
    const reviewStep = lane.steps[2]!;
    expect(reviewStep.status).toBe('planned');
  });

  it('sums cost per agent matching the telemetry rollup and rolls children into the parent', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'scout-1',
            name: 'scout',
            workflowRunId: 'run-1',
            stepId: 'step-scout',
            runId: 'r-scout',
          }),
          makeAgent({
            id: 'child-1',
            name: 'sub-scout',
            parentAgentId: 'scout-1',
            runId: 'r-child',
          }),
        ],
      },
      sessionTelemetry: {
        [SID]: [
          {
            runId: 'r-scout',
            kind: 'turn',
            recordedAt: 1,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0.1,
          },
          {
            runId: 'r-child',
            kind: 'turn',
            recordedAt: 1,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0.25,
          },
          {
            runId: 'r-summ',
            kind: 'summarizer',
            recordedAt: 1,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 5,
          },
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    const lane = result.current.lanes[0]!;
    expect(lane.costUsd).toBeCloseTo(0.35, 5);
    expect(result.current.aggregate.spendUsd).toBeCloseTo(0.35, 5);
    const scoutNode = lane.steps[0]!.children[0]!;
    expect(scoutNode.costUsd).toBeCloseTo(0.35, 5);
  });

  it('routes resolver agents to resolveQueue and standalone agents to freeAgents', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({ id: 'free-1', name: 'explore', status: 'running' }),
          makeAgent({
            id: 'resolve-1',
            name: 'resolve comment',
            status: 'running',
            sourceThreadId: 'thread-9',
            sourceCommentUrl: 'https://x/y',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.freeAgents.map((n) => n.id)).toEqual(['free-1']);
    expect(result.current.resolveQueue.map((n) => n.id)).toEqual(['resolve-1']);
    expect(result.current.aggregate.runningCount).toBe(2);
    expect(result.current.aggregate.agentCount).toBe(2);
  });

  it('places a fully-done lane in completedLanes, not in lanes', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'scout-1',
            name: 'scout',
            workflowRunId: 'run-1',
            stepId: 'step-scout',
            runId: 'r-scout',
            status: 'completed',
          }),
          makeAgent({
            id: 'impl-1',
            name: 'impl',
            workflowRunId: 'run-1',
            stepId: 'step-impl',
            runId: 'r-impl',
            status: 'completed',
          }),
          makeAgent({
            id: 'review-1',
            name: 'review',
            workflowRunId: 'run-1',
            stepId: 'step-review',
            runId: 'r-review',
            status: 'completed',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.lanes).toHaveLength(0);
    expect(result.current.completedLanes).toHaveLength(1);
    expect(result.current.completedLanes![0]!.runId).toBe('run-1');
  });

  it('keeps a mixed-status lane (some done, some running) in lanes and NOT in completedLanes', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'scout-1',
            name: 'scout',
            workflowRunId: 'run-1',
            stepId: 'step-scout',
            runId: 'r-scout',
            status: 'completed',
          }),
          makeAgent({
            id: 'impl-1',
            name: 'impl',
            workflowRunId: 'run-1',
            stepId: 'step-impl',
            runId: 'r-impl',
            status: 'running',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.lanes).toHaveLength(1);
    expect(result.current.lanes[0]!.runId).toBe('run-1');
    expect(result.current.completedLanes).toHaveLength(0);
  });

  it('places a done freeAgent in completedFreeAgents and a running one in freeAgents', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({ id: 'running-1', name: 'explore', status: 'running' }),
          makeAgent({ id: 'done-1', name: 'finished', status: 'completed' }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.freeAgents.map((n) => n.id)).toEqual(['running-1']);
    expect(result.current.completedFreeAgents!.map((n) => n.id)).toEqual(['done-1']);
  });

  it('places a fully-stalled lane (all steps failed) in completedLanes, not in lanes', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'scout-fail',
            name: 'scout',
            workflowRunId: 'run-1',
            stepId: 'step-scout',
            runId: 'r-scout',
            status: 'failed',
          }),
          makeAgent({
            id: 'impl-fail',
            name: 'impl',
            workflowRunId: 'run-1',
            stepId: 'step-impl',
            runId: 'r-impl',
            status: 'failed',
          }),
          makeAgent({
            id: 'review-fail',
            name: 'review',
            workflowRunId: 'run-1',
            stepId: 'step-review',
            runId: 'r-review',
            status: 'failed',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.lanes).toHaveLength(0);
    expect(result.current.completedLanes).toHaveLength(1);
    expect(result.current.completedLanes![0]!.runId).toBe('run-1');
  });

  it('places a done resolver in completedResolveQueue and a running one in resolveQueue', () => {
    store.state = baseState({
      sessionPhaseRuns: {
        [SID]: [
          makeAgent({
            id: 'r-running',
            name: 'resolve-active',
            status: 'running',
            sourceThreadId: 'thread-a',
          }),
          makeAgent({
            id: 'r-done',
            name: 'resolve-done',
            status: 'completed',
            sourceThreadId: 'thread-b',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useWorkspaceRuns(WS, [session]));
    expect(result.current.resolveQueue.map((n) => n.id)).toEqual(['r-running']);
    expect(result.current.completedResolveQueue!.map((n) => n.id)).toEqual(['r-done']);
  });
});
