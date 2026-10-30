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
import { readRunGuidance } from '../../runtime/runGuidance/readRunGuidance';
import { invokeAgentList } from '../../../features/workflows/workflows';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const GUIDANCE = 'Keep every change inside ledger-core.';
const ASK = 'Add the export to ledger-core';

type StoryState = ReturnType<StoryStore['getState']>;
type SendFn = StoryState['sendTurn'];

type Sent = {
  readonly content: string;
  readonly storedGuidance: string | null;
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
      storedGuidance:
        agentId === undefined
          ? null
          : await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId }),
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
  readonly guidance?: string | null;
  readonly kind?: 'implementer' | 'auto';
};

const spawn = async (args: SpawnParams): Promise<AgentId> => {
  const before = sent.length;
  const agentId = await useAppStore.getState().spawnAgent(AUTO_SEED_SESSION, {
    kindOverride: args.kind ?? 'implementer',
    initialPrompt: ASK,
    ...(args.guidance !== undefined && { guidance: args.guidance }),
  });
  await vi.waitFor(() => expect(sent.length).toBeGreaterThan(before));
  return agentId;
};

describe('spawnAgent with the guidance of one run', () => {
  it('opens the kickoff of an agent with the Guidance section and the ask after it', async () => {
    await spawn({ guidance: GUIDANCE });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.content).toBe(`**Guidance**\n${GUIDANCE}\n\n${ASK}`);
  });

  it('stores the guidance under the new agent before the kickoff goes out', async () => {
    const agentId = await spawn({ guidance: `  ${GUIDANCE}  ` });

    expect(sent[0]?.storedGuidance).toBe(GUIDANCE);
    expect(await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toBe(
      GUIDANCE,
    );
  });

  it('leaves the kickoff byte for byte the ask when no guidance is given', async () => {
    const agentId = await spawn({});

    expect(sent[0]?.content).toBe(ASK);
    expect(
      await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId }),
    ).toBeNull();
  });

  it('treats null and blank guidance as none and stores nothing', async () => {
    const first = await spawn({ guidance: null });
    const second = await spawn({ guidance: '  \n ' });

    expect(sent.map((entry) => entry.content)).toEqual([ASK, ASK]);
    for (const agentId of [first, second]) {
      expect(
        await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId }),
      ).toBeNull();
    }
  });

  it('keeps the guidance of the Auto agent out of its kickoff and in the store for its prompt', async () => {
    const agentId = await spawn({ kind: 'auto', guidance: GUIDANCE });

    expect(sent[0]?.content).toBe(ASK);
    expect(sent[0]?.storedGuidance).toBe(GUIDANCE);
    expect(await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toBe(
      GUIDANCE,
    );
  });

  it('keeps the guidance of two agents of the workspace apart', async () => {
    const first = await spawn({ guidance: GUIDANCE });
    const second = await spawn({ guidance: 'Reply in Italian.' });

    expect(
      await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId: first }),
    ).toBe(GUIDANCE);
    expect(
      await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId: second }),
    ).toBe('Reply in Italian.');
  });

  it('starts nothing and says why when the guidance cannot be saved', async () => {
    const db = storySqlite();
    const original = db.execute.bind(db);
    const execute = vi.spyOn(db, 'execute');
    execute.mockImplementation(async (sql, params) => {
      if (sql.includes('workspace_values')) {
        throw new Error('disk unavailable');
      }
      return original(sql, params);
    });

    await expect(spawn({ guidance: GUIDANCE })).rejects.toThrow('disk unavailable');
    execute.mockRestore();

    expect(sent).toHaveLength(0);
  });

  it('leaves no agent behind when the guidance cannot be saved, and Retry makes exactly one', async () => {
    const rowsBefore = await invokeAgentList(AUTO_SEED_SESSION);
    const publishedBefore = useAppStore.getState().sessionPhaseRuns[AUTO_SEED_SESSION] ?? [];
    const db = storySqlite();
    const original = db.execute.bind(db);
    const execute = vi.spyOn(db, 'execute');
    execute.mockImplementation(async (sql, params) => {
      if (sql.includes('workspace_values')) {
        throw new Error('disk unavailable');
      }
      return original(sql, params);
    });

    await expect(spawn({ guidance: GUIDANCE })).rejects.toThrow('disk unavailable');
    execute.mockRestore();

    expect(await invokeAgentList(AUTO_SEED_SESSION)).toHaveLength(rowsBefore.length);
    expect(useAppStore.getState().sessionPhaseRuns[AUTO_SEED_SESSION] ?? []).toHaveLength(
      publishedBefore.length,
    );
    expect(sent).toHaveLength(0);

    const agentId = await spawn({ guidance: GUIDANCE });

    expect(await invokeAgentList(AUTO_SEED_SESSION)).toHaveLength(rowsBefore.length + 1);
    expect(useAppStore.getState().sessionPhaseRuns[AUTO_SEED_SESSION] ?? []).toHaveLength(
      publishedBefore.length + 1,
    );
    expect(sent).toHaveLength(1);
    expect(await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId })).toBe(
      GUIDANCE,
    );
  });

  it('never leaks one agent guidance to the next agent that has none', async () => {
    await spawn({ guidance: GUIDANCE });
    const plain: AgentId = await spawn({});

    expect(sent[1]?.content).toBe(ASK);
    expect(
      await readRunGuidance({ db: storySqlite(), workspaceId: WORKSPACE, agentId: plain }),
    ).toBeNull();
  });
});
