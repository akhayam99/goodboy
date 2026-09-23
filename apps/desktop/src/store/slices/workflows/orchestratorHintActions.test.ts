import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  OrchestratorHint,
  Session,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';

const { updateHintsSpy } = vi.hoisted(() => ({
  updateHintsSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateWorkflowRunOrchestratorHints: updateHintsSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

const { cancelRunningStepsSpy } = vi.hoisted(() => ({
  cancelRunningStepsSpy: vi.fn(async () => true),
}));

vi.mock('./cancelRunningSteps', () => ({ cancelRunningSteps: cancelRunningStepsSpy }));

import { addWorkflowOrchestratorHint } from './addWorkflowOrchestratorHint';
import { decisionRestartMark } from './decisionRestart';
import { removeWorkflowOrchestratorHint } from './removeWorkflowOrchestratorHint';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-09-23T10:00:00.000Z' as IsoDateTime;

type State = Record<string, unknown>;

const QUEUED: OrchestratorHint = {
  id: 'hint-queued',
  text: 'run a reviewer before the PR',
  createdAt: NOW,
};

type StateParams = {
  readonly hints?: ReadonlyArray<OrchestratorHint>;
  readonly isDeciding?: boolean;
  readonly isStepRunning?: boolean;
};

const baseState = ({
  hints = [],
  isDeciding = false,
  isStepRunning = false,
}: StateParams): State => ({
  sessions: [
    {
      id: SESSION_ID,
      workflowRuns: [
        {
          id: RUN_ID,
          workflowId: 'workflow-1' as WorkflowId,
          ordinal: 0,
          currentStep: 0,
          autoRun: true,
          triggerMode: 'immediate',
          executionMode: 'dynamic',
          ...(hints.length > 0 && { orchestratorHints: hints }),
        },
      ],
    } as unknown as Session,
  ],
  orchestratingWorkflowRuns: { [RUN_ID]: isDeciding },
  sessionPhaseRuns: {
    [SESSION_ID]: isStepRunning
      ? [{ id: 'agent-1', workflowRunId: RUN_ID, status: 'running', ordinal: 0 }]
      : [],
  },
  orchestrateNextStep: vi.fn(async () => undefined),
  continueWorkflowRun: vi.fn(async () => undefined),
});

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  return { set: set as never, get: (() => state) as never };
};

const hintsOf = (state: State): ReadonlyArray<OrchestratorHint> =>
  (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!.orchestratorHints ?? [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('orchestrator hint actions', () => {
  it('queues a hint behind the ones already there and persists the whole log', async () => {
    const state = baseState({ hints: [QUEUED] });
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: '  no PR, commit locally  ',
      delivery: 'queue',
    });

    const hints = hintsOf(state);
    expect(hints.map((hint) => hint.text)).toEqual([
      'run a reviewer before the PR',
      'no PR, commit locally',
    ]);
    expect(hints[1]?.consumedAt).toBeUndefined();
    expect(updateHintsSpy).toHaveBeenCalledWith({}, RUN_ID, hints);
  });

  it('restarts the decision in flight when the hint is read now', async () => {
    const state = baseState({ isDeciding: true });
    const { set, get } = harness(state);
    const before = decisionRestartMark({ workflowRunId: RUN_ID });

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'no PR, commit locally',
      delivery: 'now',
    });

    expect(decisionRestartMark({ workflowRunId: RUN_ID })).toBe(before + 1);
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
    expect(cancelRunningStepsSpy).not.toHaveBeenCalled();
  });

  it('resolves after persisting before the restarted decision settles', async () => {
    const state = baseState({ isDeciding: true });
    const { set, get } = harness(state);
    let resolveDecision: (() => void) | undefined;
    const decision = new Promise<void>((resolve) => {
      resolveDecision = resolve;
    });
    state['orchestrateNextStep'] = vi.fn(() => decision);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'no PR, commit locally',
      delivery: 'now',
    });

    expect(updateHintsSpy).toHaveBeenCalledTimes(1);
    expect(resolveDecision).toBeDefined();
    resolveDecision?.();
    await decision;
  });

  it('stops the step in flight and decides again when the hint is read now', async () => {
    const state = baseState({ isStepRunning: true });
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'look at the payout domain first',
      delivery: 'now',
    });

    expect(cancelRunningStepsSpy).toHaveBeenCalledTimes(1);
    expect(state['continueWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('decides right away on an idle run when the hint is read now', async () => {
    const state = baseState({});
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'look at the payout domain first',
      delivery: 'now',
    });

    expect(cancelRunningStepsSpy).not.toHaveBeenCalled();
    expect(state['continueWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('interrupts nothing when the hint is queued', async () => {
    const state = baseState({ isDeciding: true, isStepRunning: true });
    const { set, get } = harness(state);
    const before = decisionRestartMark({ workflowRunId: RUN_ID });

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'no PR, commit locally',
      delivery: 'queue',
    });

    expect(decisionRestartMark({ workflowRunId: RUN_ID })).toBe(before);
    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
    expect(state['continueWorkflowRun']).not.toHaveBeenCalled();
    expect(cancelRunningStepsSpy).not.toHaveBeenCalled();
    expect(hintsOf(state)[0]?.consumedAt).toBeUndefined();
  });

  it('keeps both hints when two are sent at the same time', async () => {
    const state = baseState({});
    const { set, get } = harness(state);
    updateHintsSpy.mockImplementation(
      () => new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 5)),
    );

    await Promise.all([
      addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
        text: 'first',
        delivery: 'queue',
      }),
      addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
        text: 'second',
        delivery: 'queue',
      }),
    ]);

    expect(hintsOf(state).map((hint) => hint.text)).toEqual(['first', 'second']);
    updateHintsSpy.mockImplementation(async () => undefined);
  });

  it('ignores a blank hint', async () => {
    const state = baseState({});
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: '   ',
      delivery: 'queue',
    });

    expect(updateHintsSpy).not.toHaveBeenCalled();
  });

  it('removes a hint by id', async () => {
    const state = baseState({ hints: [QUEUED] });
    const { set, get } = harness(state);

    await removeWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, QUEUED.id);
    expect(hintsOf(state)).toEqual([]);
    expect(updateHintsSpy).toHaveBeenLastCalledWith({}, RUN_ID, []);
  });
});
