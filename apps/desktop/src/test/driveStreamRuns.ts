import type { AgentId, ProviderRunId } from '@goodboy/types';
import { TEST_NOW, nextAgentId, nextProviderRunId, nextSessionId } from '@goodboy/types/testing';
import { runTurn } from '../features/chat/turn';
import { flushTurnEvents } from '../store/slices/transcripts/buffer';
import type { StoryStore } from '../store/storyHarness';
import { streamRunScript } from './streamRunScript';
import { turnEventBus } from './turnEventBus';

type DriveParams = {
  readonly runCount: number;
  readonly textDeltas: number;
  readonly store: StoryStore;
};

type ConsumeParams = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
  readonly store: StoryStore;
};

type WaitParams = {
  readonly count: number;
};

export type DriveResult = {
  readonly runCount: number;
  readonly envelopesPerRun: number;
  readonly eventsAppended: number;
  readonly listenerCalls: number;
  readonly peakListeners: number;
  readonly copiedRows: number;
  readonly dispatchMs: number;
  readonly totalMs: number;
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly runIds: ReadonlyArray<ProviderRunId>;
};

const SESSION_ID = nextSessionId();

const nextMacrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const consume = async ({ runId, agentId, store }: ConsumeParams): Promise<number> => {
  let appended = 0;
  const stream = runTurn(
    {
      runId,
      provider: 'anthropic',
      model: 'default',
      workingDir: '/work/payments-api',
      writableRoots: [],
      prompt: 'Reconcile the ledger-core export',
    },
    () => TEST_NOW,
  );
  for await (const event of stream) {
    store.getState().appendTurnEvent(agentId, SESSION_ID, event);
    appended += 1;
  }
  return appended;
};

const waitForListeners = async ({ count }: WaitParams): Promise<void> => {
  while (turnEventBus.listenerCount() < count) {
    await nextMacrotask();
  }
  await nextMacrotask();
};

export const driveStreamRuns = async ({
  runCount,
  textDeltas,
  store,
}: DriveParams): Promise<DriveResult> => {
  const lines = streamRunScript({ textDeltas });
  const runIds = Array.from({ length: runCount }, () => nextProviderRunId());
  const agentIds = runIds.map(() => nextAgentId());

  let copiedRows = 0;
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.transcripts === previous.transcripts) {
      return;
    }
    for (const agentId of agentIds) {
      if (state.transcripts[agentId] !== previous.transcripts[agentId]) {
        copiedRows += state.transcripts[agentId]?.length ?? 0;
      }
    }
  });

  const consumers = runIds.map((runId, index) =>
    consume({ runId, agentId: agentIds[index]!, store }),
  );
  await waitForListeners({ count: 1 });
  await nextMacrotask();
  const peakListeners = turnEventBus.listenerCount();

  const callsBefore = turnEventBus.callCount();
  let dispatchMs = 0;
  const startedAt = performance.now();
  for (const [lineIndex, line] of lines.entries()) {
    for (const runId of runIds) {
      const before = performance.now();
      turnEventBus.emit({ payload: { runId, seq: lineIndex + 1, type: 'line', line } });
      dispatchMs += performance.now() - before;
    }
    await nextMacrotask();
  }
  for (const runId of runIds) {
    const before = performance.now();
    turnEventBus.emit({
      payload: { runId, seq: lines.length + 1, type: 'end', exit_code: 0, stderr: '' },
    });
    dispatchMs += performance.now() - before;
  }
  const counts = await Promise.all(consumers);
  flushTurnEvents();
  const totalMs = performance.now() - startedAt;
  unsubscribe();

  return {
    runCount,
    envelopesPerRun: lines.length + 1,
    eventsAppended: counts.reduce((sum, count) => sum + count, 0),
    listenerCalls: turnEventBus.callCount() - callsBefore,
    peakListeners,
    copiedRows,
    dispatchMs,
    totalMs,
    agentIds,
    runIds,
  };
};
