// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderRunId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  BLOCKED_MOUNT_AGENT_ID,
  BLOCKED_MOUNT_RUN_ID,
  BLOCKED_MOUNT_SESSION_ID,
} from '../u30/blockedMountStepSeed';
import { seedStoppedQuestions } from './stoppedQuestionsSeed';

const SPENT_RUN_ID = brandId<ProviderRunId>({ value: 'pr-spent' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

type SpendParams = {
  readonly usd: number;
};

const seedSpend = ({ usd }: SpendParams) => {
  const record: TelemetryRecord = {
    id: brandId<TelemetryRecordId>({ value: 'tel-spent' }),
    runId: SPENT_RUN_ID,
    sessionId: BLOCKED_MOUNT_SESSION_ID,
    kind: 'turn',
    provider: 'anthropic',
    model: 'sonnet-5-5',
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: usd,
    recordedAt: brandId<IsoDateTime>({ value: '2026-10-31T15:00:00.000Z' }),
  };
  useAppStore.setState((state) => ({
    sessionTelemetry: { ...state.sessionTelemetry, [BLOCKED_MOUNT_SESSION_ID]: [record] },
    agentRunHistory: { ...state.agentRunHistory, [BLOCKED_MOUNT_AGENT_ID]: [SPENT_RUN_ID] },
    loadSessionTelemetry: async () => undefined,
  }));
};

const stopKind = () =>
  useAppStore
    .getState()
    .sessions.find((session) => session.id === BLOCKED_MOUNT_SESSION_ID)
    ?.workflowRuns.find((run) => run.id === BLOCKED_MOUNT_RUN_ID)?.orchestrationStop?.kind;

describe('raising the run limit unlocks the stopped questions', () => {
  it('clears the budget stop once the new limit covers the spend', async () => {
    seedStoppedQuestions({ stop: { kind: 'budget', message: 'Paused at the $5 limit.' } });
    seedSpend({ usd: 5 });

    await useAppStore
      .getState()
      .setWorkflowRunSpendLimit(BLOCKED_MOUNT_SESSION_ID, BLOCKED_MOUNT_RUN_ID, 10, 'pause');

    expect(stopKind()).toBeUndefined();
  });

  it('keeps the budget stop while the new limit is still under the spend', async () => {
    seedStoppedQuestions({ stop: { kind: 'budget', message: 'Paused at the $5 limit.' } });
    seedSpend({ usd: 5 });

    await useAppStore
      .getState()
      .setWorkflowRunSpendLimit(BLOCKED_MOUNT_SESSION_ID, BLOCKED_MOUNT_RUN_ID, 5, 'pause');

    expect(stopKind()).toBe('budget');
  });

  it('does not start a step when it clears the stop', async () => {
    seedStoppedQuestions({ stop: { kind: 'budget', message: 'Paused at the $5 limit.' } });
    seedSpend({ usd: 5 });
    const orchestrateNextStep = vi.fn(async () => undefined);
    useAppStore.setState({ orchestrateNextStep });

    await useAppStore
      .getState()
      .setWorkflowRunSpendLimit(BLOCKED_MOUNT_SESSION_ID, BLOCKED_MOUNT_RUN_ID, 10, 'pause');

    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });

  it('leaves another stop kind alone', async () => {
    seedStoppedQuestions({ stop: { kind: 'paused', message: 'Paused by you' } });

    await useAppStore
      .getState()
      .setWorkflowRunSpendLimit(BLOCKED_MOUNT_SESSION_ID, BLOCKED_MOUNT_RUN_ID, 10, 'pause');

    expect(stopKind()).toBe('paused');
  });
});
