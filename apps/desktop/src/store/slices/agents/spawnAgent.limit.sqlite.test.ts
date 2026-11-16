// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { readRunLimit, type RunLimitChoice } from '../../runtime/runLimit/readRunLimit';
import { invokeAgentList } from '../../../features/workflows/workflows';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const ASK = 'Add the export to ledger-core';

type StoryState = ReturnType<StoryStore['getState']>;
type SendFn = StoryState['sendTurn'];

type Sent = {
  readonly content: string;
  readonly storedLimit: RunLimitChoice | null;
};

let useAppStore: StoryStore;
let sent: Sent[] = [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  sent = [];
  const sendTurn = vi.fn<SendFn>(async ({ agentId, content }) => {
    sent.push({
      content,
      storedLimit:
        agentId === undefined
          ? null
          : await readRunLimit({ db: storySqlite(), workspaceId: WORKSPACE, agentId }),
    });
    return { blockedOverBudget: false };
  });
  useAppStore.setState({
    sessions: [aSession({ id: AUTO_SEED_SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: await invokeAgentList(AUTO_SEED_SESSION) },
    agentTurnState: {},
    agentKindOverride: {},
    settings: {},
    sendTurn,
  });
});

type SpawnParams = {
  readonly limitUsd?: number | null;
};

const spawn = async ({ limitUsd }: SpawnParams): Promise<AgentId> => {
  const before = sent.length;
  const agentId = await useAppStore.getState().spawnAgent(AUTO_SEED_SESSION, {
    kindOverride: 'auto',
    initialPrompt: ASK,
    ...(limitUsd !== undefined && { limitUsd }),
  });
  await vi.waitFor(() => expect(sent.length).toBeGreaterThan(before));
  return agentId;
};

describe('spawnAgent with the limit of one run', () => {
  it('stores the limit under the new Lead before the kickoff goes out', async () => {
    const agentId = await spawn({ limitUsd: 3 });

    expect(sent[0]).toEqual({ content: ASK, storedLimit: { kind: 'capped', usd: 3 } });
    expect(await readRunLimit({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toEqual({
      kind: 'capped',
      usd: 3,
    });
  });

  it('stores nothing when the run keeps the default', async () => {
    const agentId = await spawn({});

    expect(sent[0]).toEqual({ content: ASK, storedLimit: { kind: 'inherited' } });
    expect(await readRunLimit({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toEqual({
      kind: 'inherited',
    });
  });

  it('stores no limit when the person chose none, before the kickoff goes out', async () => {
    const agentId = await spawn({ limitUsd: null });

    expect(sent[0]).toEqual({ content: ASK, storedLimit: { kind: 'uncapped' } });
    expect(await readRunLimit({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toEqual({
      kind: 'uncapped',
    });
  });

  it('leaves no agent behind when the limit cannot be saved, and Retry makes exactly one', async () => {
    const rowsBefore = await invokeAgentList(AUTO_SEED_SESSION);
    const db = storySqlite();
    const original = db.execute.bind(db);
    const execute = vi.spyOn(db, 'execute');
    execute.mockImplementation(async (sql, params) => {
      if (sql.includes('workspace_values')) {
        throw new Error('disk unavailable');
      }
      return original(sql, params);
    });

    await expect(spawn({ limitUsd: 3 })).rejects.toThrow('disk unavailable');
    execute.mockRestore();

    expect(await invokeAgentList(AUTO_SEED_SESSION)).toHaveLength(rowsBefore.length);
    expect(sent).toHaveLength(0);

    const agentId = await spawn({ limitUsd: 3 });

    expect(await invokeAgentList(AUTO_SEED_SESSION)).toHaveLength(rowsBefore.length + 1);
    expect(await readRunLimit({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toEqual({
      kind: 'capped',
      usd: 3,
    });
  });
});
