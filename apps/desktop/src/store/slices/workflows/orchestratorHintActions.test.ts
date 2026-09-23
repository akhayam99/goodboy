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

import { addWorkflowOrchestratorHint } from './addWorkflowOrchestratorHint';
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
};

const baseState = ({ hints = [], isDeciding = false }: StateParams): State => ({
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
  orchestrateNextStep: vi.fn(async () => undefined),
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
    });

    const hints = hintsOf(state);
    expect(hints.map((hint) => hint.text)).toEqual([
      'run a reviewer before the PR',
      'no PR, commit locally',
    ]);
    expect(hints[1]?.consumedAt).toBeUndefined();
    expect(updateHintsSpy).toHaveBeenCalledWith({}, RUN_ID, hints);
  });

  it('asks for a new decision when the hint lands while one is in flight', async () => {
    const state = baseState({ isDeciding: true });
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'no PR, commit locally',
    });

    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('leaves the next decision to the run when nothing is deciding', async () => {
    const state = baseState({});
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: 'no PR, commit locally',
    });

    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
    expect(hintsOf(state)[0]?.consumedAt).toBeUndefined();
  });

  it('ignores a blank hint', async () => {
    const state = baseState({});
    const { set, get } = harness(state);

    await addWorkflowOrchestratorHint(set, get)(SESSION_ID, RUN_ID, {
      text: '   ',
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
