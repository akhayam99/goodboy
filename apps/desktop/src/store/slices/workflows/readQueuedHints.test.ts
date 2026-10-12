// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

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
    updateWorkflowRunOrchestratorHints: async () => undefined,
  }),
);

const NOW = brandedId<IsoDateTime>({ value: '2026-10-12T09:00:00.000Z' });

const QUEUED: OrchestratorHint = {
  id: 'hint-queued',
  text: 'Rename the Northwind flag too',
  createdAt: NOW,
};

const SECOND: OrchestratorHint = {
  id: 'hint-second',
  text: 'Also run the Acme reviewer',
  createdAt: NOW,
};

const finished = aWorkflowRun({
  executionMode: 'dynamic',
  orchestrationOutcome: 'done',
  orchestratorHints: [QUEUED, SECOND],
});
const session = aSession({ workflowRuns: [finished] });

let useAppStore: StoryStore;
const orchestrateNextStep = vi.fn(async () => undefined);
const continueWorkflowRun = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [session],
    sessionWorktrees: { [session.id]: ['/repo/.worktrees/notify-relay'] },
    orchestrateNextStep,
    continueWorkflowRun,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

type SetRunParams = {
  readonly patch: Partial<typeof finished>;
};

const setRun = ({ patch }: SetRunParams) => {
  useAppStore.setState({
    sessions: [{ ...session, workflowRuns: [{ ...finished, ...patch }] }],
  });
};

type QueueParams = {
  readonly text: string;
};

const queue = ({ text }: QueueParams) =>
  useAppStore.getState().addWorkflowOrchestratorHint(session.id, finished.id, {
    text,
    delivery: 'queue',
  });

const readQueued = () =>
  useAppStore
    .getState()
    .readQueuedWorkflowHints({ sessionId: session.id, workflowRunId: finished.id });

describe('queued messages on a run', () => {
  it('stay queued on a finished run until you read them', async () => {
    await queue({ text: 'A third note for Northwind' });

    expect(continueWorkflowRun).not.toHaveBeenCalled();
    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });

  it('are not read by the sweep after a reload', async () => {
    await useAppStore.getState().sweepIdleRuns();

    expect(continueWorkflowRun).not.toHaveBeenCalled();
  });

  it('are all read in one new turn when you read them', async () => {
    await readQueued();

    expect(continueWorkflowRun).toHaveBeenCalledTimes(1);
    expect(continueWorkflowRun).toHaveBeenCalledWith(session.id, finished.id);
  });

  it('are not read while a step is running', async () => {
    setRun({ patch: { orchestrationOutcome: undefined } });

    await readQueued();

    expect(continueWorkflowRun).not.toHaveBeenCalled();
  });

  it('are not read while the run is deciding', async () => {
    useAppStore.setState({ orchestratingWorkflowRuns: { [finished.id]: true } });

    await readQueued();

    expect(continueWorkflowRun).not.toHaveBeenCalled();
  });

  it('are not read twice while the first read is in flight', async () => {
    useAppStore.setState({
      orchestratorReadingHints: { [finished.id]: [QUEUED.id, SECOND.id] },
    });

    await readQueued();

    expect(continueWorkflowRun).not.toHaveBeenCalled();
  });

  it('resume a stopped run with the queue kept', async () => {
    setRun({
      patch: { orchestrationStop: { kind: 'operator', message: 'You stopped this run.' } },
    });
    const retry = vi.spyOn(useAppStore.getState(), 'retryWorkflowOrchestration');
    useAppStore.setState({ retryWorkflowOrchestration: retry.mockResolvedValue(undefined) });

    await readQueued();

    expect(retry).toHaveBeenCalledWith(session.id, finished.id);
    expect(continueWorkflowRun).not.toHaveBeenCalled();
  });

  it('resume a stopped run once on a double click', async () => {
    setRun({
      patch: { orchestrationStop: { kind: 'operator', message: 'You stopped this run.' } },
    });
    let release: () => void = () => undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    useAppStore.setState({ retryWorkflowOrchestration: retry });

    const first = readQueued();
    const second = readQueued();
    release();
    await Promise.all([first, second]);

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('release the queue when the resume of a stopped run fails', async () => {
    setRun({
      patch: { orchestrationStop: { kind: 'operator', message: 'You stopped this run.' } },
    });
    const retry = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    useAppStore.setState({ retryWorkflowOrchestration: retry });

    await expect(readQueued()).rejects.toThrow('offline');
    await readQueued();

    expect(retry).toHaveBeenCalledTimes(2);
  });

  it('stay queued across a reload of a stopped run', async () => {
    setRun({
      patch: { orchestrationStop: { kind: 'operator', message: 'You stopped this run.' } },
    });

    await useAppStore.getState().sweepIdleRuns();

    expect(continueWorkflowRun).not.toHaveBeenCalled();
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.orchestratorHints).toHaveLength(2);
  });
});
