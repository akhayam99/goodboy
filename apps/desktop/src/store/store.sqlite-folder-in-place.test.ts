import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { aProject, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type MountId,
  type Project,
  type ProviderRunId,
  type SessionId,
  type SessionProjectMount,
  type TurnEvent,
} from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { inPlaceSnapshot } from './slices/turn/inPlaceSnapshot';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Acme notes',
  slug: 'acme-notes',
});
const NOTES = '/tmp/Documents/acme-notes';
const RESEARCH = '/tmp/Documents/acme-research';
const SCRATCH = '/tmp/goodboy-root/scratch/acme-notes';

const notes: Project = aProject({
  workspaceId: workspace.id,
  name: 'acme-notes',
  rootPath: NOTES,
  kind: 'folder',
});
const research: Project = aProject({
  workspaceId: workspace.id,
  name: 'acme-research',
  rootPath: RESEARCH,
  kind: 'folder',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = {
  readonly runId: ProviderRunId;
  readonly sessionId: SessionId;
  readonly workingDir: string;
  readonly writableRoots?: ReadonlyArray<string>;
  readonly systemPrompt?: string;
  readonly confinedRole?: string;
  readonly writeSetLease?: {
    readonly holder: string;
    readonly entries: ReadonlyArray<{ path: string }>;
  };
};

const spawnOf = (sessionId: SessionId): RunArgs => {
  const spawn = storySpies.runTurn.mock.calls
    .map((call) => call[0])
    .find((args) => args?.sessionId === sessionId);
  if (spawn === undefined) {
    throw new Error(`no spawn for ${sessionId}`);
  }
  return spawn;
};

const spawnAt = (index: number): RunArgs => {
  const spawn = storySpies.runTurn.mock.calls[index]?.[0];
  if (spawn === undefined) {
    throw new Error(`no spawn at ${index}`);
  }
  return spawn;
};

const gate = () => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

const heldStream = ({
  runId,
  hold,
}: {
  readonly runId: ProviderRunId;
  readonly hold: Promise<void>;
}) =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'Tightening the intro', at: TEST_NOW };
    await hold;
  })();

const startAgent = async ({
  kind,
  goal,
}: {
  readonly kind: 'generic' | 'scout';
  readonly goal: string;
}) => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal,
    firstAgentKind: kind,
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  if (kind !== 'generic') {
    await vi.waitFor(() =>
      expect(storySpies.runTurn.mock.calls.some((call) => call[0]?.sessionId === session.id)).toBe(
        true,
      ),
    );
  }
  await vi.waitFor(() =>
    expect(['running', 'starting']).not.toContain(
      useAppStore.getState().agentTurnState[agent.id]?.kind,
    ),
  );
  return { sessionId: session.id, agentId: agent.id };
};

const send = ({
  sessionId,
  agentId,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}) =>
  useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Fix the typos in launch-memo.md',
    origin: 'operator',
  });

const waitOf = (agentId: AgentId) => useAppStore.getState().agentWriterWait[agentId];

const fakeRegistry = () => {
  const holders = new Map<string, string>();
  storySpies.acquireWriteSet.mockImplementation(async ({ paths, holder }) => {
    const blockedPath = paths.find((path: string) => {
      const current = holders.get(path);
      return current !== undefined && current !== holder;
    });
    if (blockedPath !== undefined) {
      return {
        isGranted: false,
        entries: [],
        blockedPath,
        blockedBy: holders.get(blockedPath) ?? null,
      };
    }
    for (const path of paths) {
      holders.set(path, holder);
    }
    return {
      isGranted: true,
      entries: paths.map((path: string) => ({ path, token: `token:${holder}` })),
      blockedPath: null,
      blockedBy: null,
    };
  });
  storySpies.releaseWriteSet.mockImplementation(async ({ entries, holder }) => {
    const released: Array<string> = [];
    for (const entry of entries) {
      if (holders.get(entry.path) === holder) {
        holders.delete(entry.path);
        released.push(entry.path);
      }
    }
    return released;
  });
  return holders;
};

const userMessages = () =>
  rowsOf<{ content: string }>({ sql: "SELECT content FROM messages WHERE role = 'user'" });

beforeEach(async () => {
  await resetStoryStore();
  inPlaceSnapshot.reset();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project: notes });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [notes],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

afterEach(async () => {
  inPlaceSnapshot.reset();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('a writing turn in a plain folder works in the folder itself', () => {
  it('starts in the folder, writes nowhere else, and makes no session folder', async () => {
    fakeRegistry();
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();

    await send(writer);

    const spawn = spawnAt(0);
    expect(spawn.workingDir).toBe(NOTES);
    expect(spawn.writableRoots).toEqual([]);
    expect(spawn.writeSetLease?.entries.map((entry) => entry.path)).toEqual([NOTES]);
    expect(storySpies.tauriInvoke).not.toHaveBeenCalledWith(
      'session_dir_create',
      expect.anything(),
    );
    expect(useAppStore.getState().sessionProjectMounts[writer.sessionId]).toEqual([]);
    expect(useAppStore.getState().agentTurnDestination[writer.agentId]).toEqual({
      kind: 'root',
      projectId: notes.id,
      projectName: 'acme-notes',
      path: NOTES,
      branch: null,
    });
  });

  it('tells the agent every write, shell commands included, stays inside the folder', async () => {
    fakeRegistry();
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();

    await send(writer);

    const prompt = spawnAt(0).systemPrompt ?? '';
    expect(prompt).toContain('[folder-scope]');
    expect(prompt).toContain(
      'every shell command that creates, changes, moves, renames or deletes a file',
    );
    expect(prompt).toContain('NEVER write outside it');
    expect(prompt).toContain('Do not run git init');
    expect(prompt).not.toContain('NEVER write to a project root');
    expect(prompt).not.toContain('[session-directory-scope]');
  });

  it('reads the Documents face at send time and keeps Office and PDF files read only', async () => {
    fakeRegistry();
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    await useAppStore.getState().setFolderPurpose({ projectId: notes.id, purpose: 'documents' });
    storySpies.runTurn.mockClear();

    await send(writer);

    const prompt = spawnAt(0).systemPrompt ?? '';
    expect(prompt).toContain('acme-notes holds documents');
    expect(prompt).toContain(
      'Word, PDF, Pages, Keynote, Numbers, Excel and PowerPoint files are read only',
    );
  });

  it('leases every folder of the workspace and lets the agent write in each one', async () => {
    fakeRegistry();
    useAppStore.setState({ projects: [notes, research] });
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();

    await send(writer);

    const spawn = spawnAt(0);
    expect(spawn.workingDir).toBe(NOTES);
    expect(spawn.writableRoots).toEqual([RESEARCH]);
    expect(storySpies.acquireWriteSet).toHaveBeenLastCalledWith({
      paths: [NOTES, RESEARCH],
      holder: writer.agentId,
    });
  });
});

describe('one session writes in a folder at a time', () => {
  it('second writer waits and starts on release', async () => {
    const holders = fakeRegistry();
    const first = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    const second = await startAgent({ kind: 'generic', goal: 'Summarize interview notes' });
    storySpies.runTurn.mockClear();
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );

    const firstTurn = send(first);
    await vi.waitFor(() => expect(holders.get(NOTES)).toBe(first.agentId));
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());
    const secondTurn = send(second);
    await vi.waitFor(() => expect(waitOf(second.agentId)).toBeDefined());

    expect(waitOf(second.agentId)).toEqual(
      expect.objectContaining({ blockedPath: NOTES, blockedBy: first.agentId }),
    );
    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(await userMessages()).toHaveLength(1);

    hold.open();
    await firstTurn;
    await secondTurn;

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect(spawnAt(1).workingDir).toBe(NOTES);
    expect(waitOf(second.agentId)).toBeUndefined();
    expect(holders.size).toBe(0);
  });

  it('reader never waits', async () => {
    const holders = fakeRegistry();
    const first = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    const reader = await startAgent({ kind: 'scout', goal: 'What did people complain about' });
    storySpies.runTurn.mockClear();
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );

    const firstTurn = send(first);
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());
    storySpies.acquireWriteSet.mockClear();
    const readerTurn = send(reader);
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));

    expect(storySpies.acquireWriteSet).not.toHaveBeenCalled();
    expect(waitOf(reader.agentId)).toBeUndefined();
    const readerSpawn = spawnOf(reader.sessionId);
    expect(readerSpawn.workingDir).toBe(NOTES);
    expect(readerSpawn.writeSetLease).toBeUndefined();
    expect(readerSpawn.systemPrompt ?? '').toContain('do not change, create or delete any file');

    hold.open();
    await firstTurn;
    await readerTurn;
  });

  it('cancel drops the grant: nothing starts, nothing is recorded, the lease stays with the writer', async () => {
    const holders = fakeRegistry();
    const first = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    const second = await startAgent({ kind: 'generic', goal: 'Summarize interview notes' });
    storySpies.runTurn.mockClear();
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );
    const firstTurn = send(first);
    await vi.waitFor(() => expect(holders.get(NOTES)).toBe(first.agentId));
    const secondTurn = send(second);
    await vi.waitFor(() => expect(waitOf(second.agentId)).toBeDefined());

    expect(useAppStore.getState().cancelWriterWait({ agentId: second.agentId })).toBe(true);
    await secondTurn;

    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(waitOf(second.agentId)).toBeUndefined();
    expect(holders.get(NOTES)).toBe(first.agentId);
    expect(await userMessages()).toHaveLength(1);

    hold.open();
    await firstTurn;
    expect(holders.size).toBe(0);
  });

  it('Answer without editing starts the waiting turn read only, without the lease', async () => {
    const holders = fakeRegistry();
    const first = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    const second = await startAgent({ kind: 'generic', goal: 'Summarize interview notes' });
    storySpies.runTurn.mockClear();
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );
    const firstTurn = send(first);
    await vi.waitFor(() => expect(holders.get(NOTES)).toBe(first.agentId));
    const secondTurn = send(second);
    await vi.waitFor(() => expect(waitOf(second.agentId)).toBeDefined());

    expect(useAppStore.getState().answerWithoutEditing({ agentId: second.agentId })).toBe(true);
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));

    const answer = spawnOf(second.sessionId);
    expect(answer.confinedRole).toBe('scout');
    expect(answer.writeSetLease).toBeUndefined();
    expect(answer.writableRoots).toEqual([]);
    expect(answer.systemPrompt ?? '').toContain('do not change, create or delete any file');
    expect(holders.get(NOTES)).toBe(first.agentId);
    expect(waitOf(second.agentId)).toBeUndefined();

    hold.open();
    await firstTurn;
    await secondTurn;
  });
});

describe('a writing turn starts only after its before snapshot', () => {
  it('does not spawn when the before snapshot fails, records nothing, and frees the folder', async () => {
    const holders = fakeRegistry();
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();
    const before = (await userMessages()).length;
    inPlaceSnapshot.install({
      port: {
        begin: async () => {
          throw new Error('the disk is full');
        },
      },
    });

    await expect(send(writer)).rejects.toThrow(
      "Couldn't save acme-notes before this turn, so the agent did not start. the disk is full",
    );

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await userMessages()).toHaveLength(before);
    expect(holders.size).toBe(0);
  });

  it('takes the snapshot under the lease, before the spawn, and finalizes it before the release', async () => {
    const holders = fakeRegistry();
    const writer = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();
    const order: Array<string> = [];
    let snapshotRunId: ProviderRunId | null = null;
    inPlaceSnapshot.install({
      port: {
        begin: async ({ runId, folders }) => {
          snapshotRunId = runId;
          order.push(
            `begin:${holders.get(NOTES) ?? 'free'}:${folders.map((folder) => folder.name).join(',')}`,
          );
          return {
            finalize: async () => {
              order.push(`finalize:${holders.get(NOTES) ?? 'free'}`);
            },
            discard: async () => {
              order.push('discard');
            },
          };
        },
      },
    });
    storySpies.runTurn.mockImplementation(() => {
      order.push('spawn');
      return emptyTurnStream();
    });

    await send(writer);

    expect(order).toEqual([
      `begin:${writer.agentId}:acme-notes`,
      'spawn',
      `finalize:${writer.agentId}`,
    ]);
    expect(spawnAt(0).runId).toBe(snapshotRunId);
    expect(holders.size).toBe(0);
  });
});

describe('sessions that already write in a sessions/ folder keep it', () => {
  it('a session with a folder mount keeps it; a new one gets a root destination', async () => {
    fakeRegistry();
    const legacy = await startAgent({ kind: 'generic', goal: 'Draft the FAQ' });
    const fresh = await startAgent({ kind: 'generic', goal: 'Tighten the launch memo' });
    const legacyMount: SessionProjectMount = {
      mountId: brandId<MountId>({ value: 'mount-acme-notes-faq' }),
      sessionId: legacy.sessionId,
      projectId: notes.id,
      mountName: 'acme-notes',
      worktreePath: `${NOTES}/sessions/draft-the-faq`,
      lastWorktreePath: `${NOTES}/sessions/draft-the-faq`,
      repoRoot: NOTES,
      branch: '',
      baseBranch: null,
      parallelIndex: 1,
      isAttached: true,
      diskState: 'present',
      revision: 0,
    };
    useAppStore.setState({
      sessionProjectMounts: { [legacy.sessionId]: [legacyMount], [fresh.sessionId]: [] },
    });
    stubStoryInvoke({
      workspaces_with_unread: [],
      file_versions_begin_snapshot: { manifest: [], skipped: [] },
      file_versions_finalize_snapshot: { kept: [], skipped: [] },
    });
    storySpies.runTurn.mockClear();

    await send(legacy);
    await send(fresh);

    const legacySpawn = spawnOf(legacy.sessionId);
    expect(legacySpawn.workingDir).toBe(`${NOTES}/sessions/draft-the-faq`);
    expect(legacySpawn.writeSetLease).toBeUndefined();
    expect(legacySpawn.systemPrompt ?? '').toContain('[session-directory-scope]');
    expect(spawnOf(fresh.sessionId).workingDir).toBe(NOTES);
    expect(spawnOf(fresh.sessionId).systemPrompt ?? '').toContain('[folder-scope]');
  });
});
