// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrchestratorHint, WorkflowRun } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const { savedHints, outcomeWrites, outcomeFailures } = vi.hoisted(() => {
  const hints: Array<ReadonlyArray<OrchestratorHint>> = [];
  const writes: Array<string | null> = [];
  const failures: Array<Error> = [];
  return { savedHints: hints, outcomeWrites: writes, outcomeFailures: failures };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    updateWorkflowRunOrchestratorHints: async (
      _db: unknown,
      _runId: string,
      hints: ReadonlyArray<OrchestratorHint>,
    ) => {
      savedHints.push(hints);
    },
    updateWorkflowRunOrchestrationOutcome: async (
      _db: unknown,
      _runId: string,
      outcome: string | null,
    ) => {
      const failure = outcomeFailures.shift();
      if (failure !== undefined) {
        throw failure;
      }
      outcomeWrites.push(outcome);
    },
    updateWorkflowRunOrchestrationStop: async () => undefined,
  }),
);

const HINT_TEXT = 'Also cover the ledger-core refund path';

const doneRun = aWorkflowRun({
  executionMode: 'dynamic',
  orchestrationOutcome: 'done',
  orchestrationReason: 'The guard and its test are in.',
});
const session = aSession({ workflowRuns: [doneRun] });

let useAppStore: StoryStore;
const orchestrateNextStep = vi.fn(async () => undefined);

type SeedParams = {
  readonly run: WorkflowRun;
};

const seed = ({ run }: SeedParams): void => {
  useAppStore.setState({
    sessions: [{ ...session, workflowRuns: [run] }],
    orchestrateNextStep,
  });
};

const runNow = (): WorkflowRun | undefined =>
  useAppStore.getState().sessions.find((entry) => entry.id === session.id)?.workflowRuns[0];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  savedHints.length = 0;
  outcomeWrites.length = 0;
  outcomeFailures.length = 0;
  seed({ run: doneRun });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('continueWithHint', () => {
  it('queues the hint, reopens the complete run, then lets the orchestrator decide', async () => {
    await useAppStore.getState().continueWithHint(session.id, doneRun.id, { text: HINT_TEXT });

    expect(runNow()?.orchestratorHints?.map((hint) => hint.text)).toEqual([HINT_TEXT]);
    expect(runNow()?.orchestratorHints?.[0]?.consumedAt).toBeUndefined();
    expect(outcomeWrites).toEqual([null]);
    expect(runNow()?.orchestrationOutcome).toBeUndefined();
    expect(orchestrateNextStep).toHaveBeenCalledWith(session.id, doneRun.id);
  });

  it('takes the hint back and keeps the run complete when the reopen fails', async () => {
    outcomeFailures.push(new Error('database is locked'));

    await expect(
      useAppStore.getState().continueWithHint(session.id, doneRun.id, { text: HINT_TEXT }),
    ).rejects.toThrow('database is locked');

    expect(runNow()?.orchestratorHints ?? []).toEqual([]);
    expect(savedHints.at(-1)).toEqual([]);
    expect(runNow()?.orchestrationOutcome).toBe('done');
    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });

  it('reopens on a retry after a failed reopen, with one hint', async () => {
    outcomeFailures.push(new Error('database is locked'));
    const send = () =>
      useAppStore.getState().continueWithHint(session.id, doneRun.id, { text: HINT_TEXT });

    await expect(send()).rejects.toThrow('database is locked');
    await send();

    expect(runNow()?.orchestratorHints?.map((hint) => hint.text)).toEqual([HINT_TEXT]);
    expect(runNow()?.orchestrationOutcome).toBeUndefined();
    expect(orchestrateNextStep).toHaveBeenCalledTimes(1);
  });

  it('queues the hint on a run another window already reopened, and decides nothing twice', async () => {
    seed({ run: aWorkflowRun({ id: doneRun.id, executionMode: 'dynamic' }) });

    await useAppStore.getState().continueWithHint(session.id, doneRun.id, { text: HINT_TEXT });

    expect(runNow()?.orchestratorHints?.map((hint) => hint.text)).toEqual([HINT_TEXT]);
    expect(outcomeWrites).toEqual([]);
    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });

  it('leaves a complete preset run alone', async () => {
    seed({
      run: aWorkflowRun({ id: doneRun.id, executionMode: 'static', orchestrationOutcome: 'done' }),
    });

    await useAppStore.getState().continueWithHint(session.id, doneRun.id, { text: HINT_TEXT });

    expect(savedHints).toEqual([]);
    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });
});
