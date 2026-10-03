vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const session = aSession({ goal: 'Refund the duplicate payout' });
const SESSION_ID: SessionId = session.id;

type Resumed = { readonly sessionId: SessionId; readonly permissionOnceAllow?: string };

let useAppStore: StoryStore;
let resumed: Resumed[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resumed = [];
  useAppStore.setState({
    sessions: [session],
    sendTurn: async (input) => {
      resumed.push({ sessionId: input.sessionId, permissionOnceAllow: input.permissionOnceAllow });
      return { blockedOverBudget: false };
    },
  });
});

const decisionsOf = (): ReadonlyArray<Extract<TurnEvent, { kind: 'permission_decision' }>> =>
  (useAppStore.getState().transcripts[AGENT_ID] ?? []).filter(
    (event): event is Extract<TurnEvent, { kind: 'permission_decision' }> =>
      event.kind === 'permission_decision',
  );

describe('allowAndContinue', () => {
  it('grants exactly the requested call and resumes the turn with the exact-command pattern', async () => {
    await useAppStore.getState().allowAndContinue({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-1',
      toolName: 'Bash',
      input: { command: 'pnpm test --filter ledger-core' },
      runId: RUN_ID,
    });

    expect(useAppStore.getState().volatilePermissionAllows.has('tu-1')).toBe(true);
    expect(useAppStore.getState().volatilePermissionAllows.size).toBe(1);
    expect(resumed).toEqual([
      { sessionId: SESSION_ID, permissionOnceAllow: 'Bash(pnpm test --filter ledger-core)' },
    ]);
  });

  it('records a once decision in the transcript before resuming', async () => {
    await useAppStore.getState().allowAndContinue({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-2',
      toolName: 'Edit',
      input: { file_path: '/repo/src/refund.ts' },
      runId: RUN_ID,
    });

    expect(
      decisionsOf().map(({ toolUseId, decision, scope }) => ({ toolUseId, decision, scope })),
    ).toEqual([{ toolUseId: 'tu-2', decision: 'allow', scope: 'once' }]);
    expect(resumed).toHaveLength(1);
  });
});
