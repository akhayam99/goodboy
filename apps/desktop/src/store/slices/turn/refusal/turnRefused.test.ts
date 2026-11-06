vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../storyHarness')).permissionsModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type ProviderRunId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import type { SendTurnResult } from '../types';
import { TurnRefused } from './TurnRefused';
import { throwIfRefused } from './throwIfRefused';

const LIMIT = 'Every provider is over its limit. Change a limit or wait for the next period.';
const FOLDER = 'Another agent is writing in this folder. Try again in a moment.';
const RUN_ID = brandId<ProviderRunId>({ value: 'run-ledger-1' });
const session = aSession({ goal: 'Reconcile the Harborline ledger export' });
const blockedStep = anAgent({ sessionId: session.id, name: 'Implementer', status: 'blocked' });
const stuckStep = anAgent({
  sessionId: session.id,
  name: 'Tester',
  status: 'skipped',
  outputSummary: 'Ran out of turns before the replay finished',
});
const runningStep = anAgent({ sessionId: session.id, name: 'Planner', status: 'running' });

let useAppStore: StoryStore;
let sends: number;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RefuseParams = {
  readonly result: SendTurnResult;
};

const refuseWith = ({ result }: RefuseParams) => {
  useAppStore.setState({
    sendTurn: async () => {
      sends += 1;
      return result;
    },
  });
};

beforeEach(async () => {
  await resetStoryStore();
  sends = 0;
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [blockedStep, stuckStep, runningStep] },
  });
  refuseWith({ result: { blockedOverBudget: true } });
});

describe('throwIfRefused', () => {
  it('raises the provider limit with the one wording', () => {
    expect(() => throwIfRefused({ result: { blockedOverBudget: true } })).toThrow(LIMIT);
  });

  it('raises a busy folder with the one wording', () => {
    expect(() =>
      throwIfRefused({ result: { blockedOverBudget: false, isWriterLeaseDenied: true } }),
    ).toThrow(FOLDER);
  });

  it('passes a landed or queued send through', () => {
    const queued: SendTurnResult = { blockedOverBudget: false, isLaneQueued: true };
    expect(throwIfRefused({ result: queued })).toBe(queued);
  });

  it('names the refusal on the error', () => {
    const error = new TurnRefused({ refusal: 'folder_busy' });
    expect(error.refusal).toBe('folder_busy');
    expect(error.name).toBe('TurnRefused');
  });
});

describe('a press whose send is refused ends in a result', () => {
  it('Allow and continue throws the refusal', async () => {
    await expect(
      useAppStore.getState().allowAndContinue({
        sessionId: session.id,
        agentId: blockedStep.id,
        toolUseId: 'tu-1',
        toolName: 'Bash',
        input: { command: 'pnpm test --filter ledger-core' },
        runId: RUN_ID,
      }),
    ).rejects.toThrow(LIMIT);
    expect(sends).toBe(1);
  });

  it('Deny with a reason throws the refusal', async () => {
    await expect(
      useAppStore.getState().denyWithReason({
        sessionId: session.id,
        agentId: blockedStep.id,
        toolUseId: 'tu-2',
        toolName: 'Bash',
        runId: RUN_ID,
        reason: 'this would touch production data',
      }),
    ).rejects.toThrow(LIMIT);
  });

  it('Retry tool throws the refusal', async () => {
    refuseWith({ result: { blockedOverBudget: false, isWriterLeaseDenied: true } });
    await expect(
      useAppStore
        .getState()
        .retryBlockedTool({ sessionId: session.id, agentId: blockedStep.id, toolName: 'Edit' }),
    ).rejects.toThrow(FOLDER);
  });

  it('Continue throws the refusal', async () => {
    await expect(
      useAppStore.getState().continueStoppedAgent({ sessionId: session.id, agentId: stuckStep.id }),
    ).rejects.toThrow(LIMIT);
  });

  it('Keep working throws the refusal', async () => {
    await expect(
      useAppStore.getState().keepWorkingOnStep({ sessionId: session.id, agentId: stuckStep.id }),
    ).rejects.toThrow(LIMIT);
  });

  it('Answer on a blocked step throws the refusal', async () => {
    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedStep.id, text: 'Alias it' }),
    ).rejects.toThrow(LIMIT);
  });

  it('Ask to continue says why in a notice', async () => {
    await useAppStore
      .getState()
      .askAgentToContinue({ sessionId: session.id, agentId: runningStep.id });

    expect(
      useAppStore.getState().notifications.map((entry) => [entry.title, entry.body]),
    ).toContainEqual([
      "Couldn't ask the agent to continue",
      `${LIMIT} You can still skip this step.`,
    ]);
  });
});
