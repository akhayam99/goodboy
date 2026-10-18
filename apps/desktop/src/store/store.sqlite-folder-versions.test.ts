import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { aProject, nextWorkspaceId } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type Project,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import type { FinalizedVersion, FolderTurnManifest } from '../features/file-versions/fileVersions';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { inPlaceSnapshot } from './slices/turn/inPlaceSnapshot';
import { cancelTurnStartWindow, openTurnStartWindow } from './slices/turn/turnStartWindow';
import { historyFoldersOf, inPlaceFoldersOf } from './slices/project-mounts/inPlaceFoldersOf';
import { holdsFolderCapture } from './slices/file-versions/activeFolderCaptures';
import { createFolderSnapshotPort } from './slices/file-versions/createFolderSnapshotPort';
import { recoverStagedFolderTurns } from './slices/file-versions/recoverStagedFolderTurns';
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
  storySqlite,
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
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

type FolderArgs = Readonly<{
  args: Readonly<{
    folderPath: string;
    sessionId: SessionId;
    runId: string;
    restoreRunId?: string;
    isForced?: boolean;
    sessions?: ReadonlyArray<{ sessionId: string; endedAtMs: number | null }>;
  }>;
}>;

type Calls = Record<string, Array<FolderArgs['args']>>;

const calls: Calls = {};

const record = ({ name, payload }: { readonly name: string; readonly payload: FolderArgs }) => {
  const args = payload.args;
  calls[name] = [...(calls[name] ?? []), args];
  return args;
};

const versionOf = ({
  id,
  relativePath,
  changeKind = 'modified',
}: {
  readonly id: string;
  readonly relativePath: string;
  readonly changeKind?: FinalizedVersion['changeKind'];
}): FinalizedVersion => ({
  id,
  relativePath,
  storedName: `${id}-${relativePath}`,
  sizeBytes: 6,
  contentHash: `hash-${id}`,
  changeKind,
});

const turnOf = ({
  sessionId,
  runId,
  kind = 'turn',
  restoresRunId = null,
  finishedAtMs = 2,
}: {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly kind?: FolderTurnManifest['kind'];
  readonly restoresRunId?: string | null;
  readonly finishedAtMs?: number;
}): FolderTurnManifest => ({
  version: 1,
  sessionId,
  runId,
  folderId: notes.id,
  folderPath: NOTES,
  kind,
  restoresRunId,
  startedAtMs: 1,
  finishedAtMs,
  changes: [
    {
      relativePath: 'launch-memo.md',
      change: 'modified',
      beforeHash: 'hash-before',
      afterHash: 'hash-after',
      beforeSizeBytes: 6,
      afterSizeBytes: 5,
      versionId: 'version-memo',
      storedName: 'version-memo-launch-memo.md',
      isPruned: false,
    },
  ],
  skipped: [],
});

const versionRows = () =>
  rowsOf<{ id: string; snapshot_source: string; provider_run_id: string | null }>({
    sql: 'SELECT id, snapshot_source, provider_run_id FROM file_versions ORDER BY id',
  });

const startAgent = async ({ goal }: { readonly goal: string }) => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal,
    firstAgentKind: 'generic',
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
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
    content: 'Tighten the intro of launch-memo.md',
    origin: 'operator',
  });

const engine = ({ overrides = {} }: { readonly overrides?: Record<string, unknown> } = {}) => {
  const handlers: Record<string, unknown> = {
    workspaces_with_unread: [],
    file_versions_folder_status: (payload: FolderArgs) => {
      const args = record({ name: 'status', payload });
      return {
        folderPath: args.folderPath,
        isReady: true,
        isTurnOpen: false,
        fileCount: 2,
        keptBytes: 12,
        skipped: [],
        method: 'clone',
      };
    },
    file_versions_folder_begin: (payload: FolderArgs) => {
      const args = record({ name: 'begin', payload });
      return {
        runId: args.runId,
        wasReady: true,
        copied: 0,
        method: null,
        skipped: [],
        recovered: [],
      };
    },
    file_versions_folder_finalize: (payload: FolderArgs) => {
      const args = record({ name: 'finalize', payload });
      return {
        sessionId: args.sessionId,
        runId: args.runId,
        turn: turnOf({ sessionId: args.sessionId, runId: args.runId }),
        kept: [versionOf({ id: `kept-${args.runId}`, relativePath: 'launch-memo.md' })],
      };
    },
    file_versions_folder_discard: (payload: FolderArgs) => {
      record({ name: 'discard', payload });
      return true;
    },
    file_versions_folder_list_turns: (payload: FolderArgs) => {
      const args = record({ name: 'list', payload });
      return args.folderPath === NOTES
        ? [turnOf({ sessionId: args.sessionId, runId: 'run-listed' })]
        : [];
    },
    ...overrides,
  };
  stubStoryInvoke(handlers);
};

beforeEach(async () => {
  await resetStoryStore();
  for (const key of Object.keys(calls)) {
    delete calls[key];
  }
  await insertWorkspace({ db: await openStorySqlite(), workspace });
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
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  engine();
  inPlaceSnapshot.install({
    port: createFolderSnapshotPort({ set: useAppStore.setState, get: useAppStore.getState }),
  });
});

afterEach(async () => {
  inPlaceSnapshot.reset();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('saved versions around a writing turn', () => {
  it('saves the folder before the spawn and keeps its versions after the turn', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    const order: Array<string> = [];
    engine({
      overrides: {
        file_versions_folder_begin: (payload: FolderArgs) => {
          const args = record({ name: 'begin', payload });
          order.push('begin');
          return {
            runId: args.runId,
            wasReady: true,
            copied: 0,
            method: null,
            skipped: [],
            recovered: [],
          };
        },
      },
    });
    storySpies.runTurn.mockImplementation(() => {
      order.push('spawn');
      return emptyTurnStream();
    });

    await send(writer);

    expect(order).toEqual(['begin', 'spawn']);
    const runId = calls.begin?.[0]?.runId;
    expect(calls.finalize?.[0]).toEqual({ folderPath: NOTES, sessionId: writer.sessionId, runId });
    expect(await versionRows()).toEqual([
      { id: `kept-${runId}`, snapshot_source: 'agent_turn', provider_run_id: runId },
    ]);
  });

  it('holds the folder for its session while the turn runs and lets go after', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    const during: Array<boolean> = [];
    storySpies.runTurn.mockImplementation(() => {
      during.push(holdsFolderCapture({ sessionId: writer.sessionId, folderPath: NOTES }));
      return emptyTurnStream();
    });

    await send(writer);

    expect(during).toEqual([true]);
    expect(holdsFolderCapture({ sessionId: writer.sessionId, folderPath: NOTES })).toBe(false);
  });

  it('discards the snapshot of a run cancelled before the spawn', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();
    engine({
      overrides: {
        file_versions_folder_begin: (payload: FolderArgs) => {
          const args = record({ name: 'begin', payload });
          openTurnStartWindow({ agentId: writer.agentId });
          cancelTurnStartWindow({ agentId: writer.agentId });
          return {
            runId: args.runId,
            wasReady: true,
            copied: 0,
            method: null,
            skipped: [],
            recovered: [],
          };
        },
      },
    });

    await send(writer);

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(calls.discard).toEqual([
      { folderPath: NOTES, sessionId: writer.sessionId, runId: calls.begin?.[0]?.runId },
    ]);
    expect(calls.finalize).toBeUndefined();
  });

  it('frees the folders already saved when a later folder fails to save', async () => {
    useAppStore.setState({ projects: [notes, research] });
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    storySpies.runTurn.mockClear();
    engine({
      overrides: {
        file_versions_folder_begin: (payload: FolderArgs) => {
          const args = record({ name: 'begin', payload });
          if (args.folderPath === RESEARCH) {
            throw new Error('the disk is full');
          }
          return {
            runId: args.runId,
            wasReady: true,
            copied: 0,
            method: null,
            skipped: [],
            recovered: [],
          };
        },
      },
    });

    await expect(send(writer)).rejects.toThrow(
      "Couldn't save acme-notes and acme-research before this turn, so the agent did not start.",
    );

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(calls.discard?.map((args) => args.folderPath)).toEqual([NOTES]);
  });

  it('says when the first copy is still being made and marks it ready after', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    let isReady = false;
    let seenWhileBuilding: string | undefined;
    engine({
      overrides: {
        file_versions_folder_status: (payload: FolderArgs) => {
          const args = record({ name: 'status', payload });
          return {
            folderPath: args.folderPath,
            isReady,
            isTurnOpen: false,
            fileCount: 2,
            keptBytes: 12,
            skipped: [],
            method: 'clone',
          };
        },
        file_versions_folder_begin: (payload: FolderArgs) => {
          const args = record({ name: 'begin', payload });
          seenWhileBuilding = useAppStore.getState().folderVersionsStatus[notes.id]?.kind;
          isReady = true;
          return {
            runId: args.runId,
            wasReady: false,
            copied: 2,
            method: 'clone',
            skipped: [],
            recovered: [],
          };
        },
      },
    });

    await send(writer);

    expect(seenWhileBuilding).toBe('building');
    expect(useAppStore.getState().folderVersionsStatus[notes.id]?.kind).toBe('ready');
  });
});

describe('when the after snapshot fails', () => {
  it('keeps the failure, and Retry saves each version once', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    let attempt = 0;
    engine({
      overrides: {
        file_versions_folder_finalize: (payload: FolderArgs) => {
          const args = record({ name: 'finalize', payload });
          attempt += 1;
          return {
            sessionId: args.sessionId,
            runId: args.runId,
            turn: turnOf({ sessionId: args.sessionId, runId: args.runId }),
            kept: [
              versionOf({ id: 'memo', relativePath: 'launch-memo.md' }),
              versionOf({
                id: 'faq',
                relativePath: 'faq.md',
                changeKind: attempt === 1 ? JSON.parse('"broken"') : 'deleted',
              }),
            ],
          };
        },
      },
    });

    await send(writer);

    const runId = brandId<ProviderRunId>({ value: calls.finalize?.[0]?.runId ?? 'missing' });
    expect(useAppStore.getState().folderCaptureFailures[runId]?.folderPaths).toEqual([NOTES]);
    expect((await versionRows()).map((row) => row.id)).toEqual(['memo']);

    await useAppStore.getState().retryFolderCapture({ runId });

    expect((await versionRows()).map((row) => row.id)).toEqual(['faq', 'memo']);
    expect(useAppStore.getState().folderCaptureFailures[runId]).toBeUndefined();

    await useAppStore.getState().retryFolderCapture({ runId });
    expect(calls.finalize).toHaveLength(2);
  });

  it('finishes a turn left staged by a restart, but not one that is still running', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    const nowMs = 10_000_000;
    engine({
      overrides: {
        file_versions_folder_list_staged: [
          { folderPath: NOTES, sessionId: writer.sessionId, runId: 'run-crashed', startedAtMs: 1 },
          { folderPath: NOTES, sessionId: writer.sessionId, runId: 'run-live', startedAtMs: 1 },
          {
            folderPath: NOTES,
            sessionId: writer.sessionId,
            runId: 'run-young',
            startedAtMs: nowMs - 5,
          },
        ],
      },
    });
    storySpies.listLiveRunIds.mockResolvedValue(new Set(['run-live']));
    await storySqlite().execute(
      `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at)
       VALUES ('run-crashed', ?, 'anthropic', 'claude-sonnet-4-5', 'cancelled', '{}', 1)`,
      [writer.sessionId],
    );
    const failures: Array<string> = [];

    await recoverStagedFolderTurns({
      set: useAppStore.setState,
      get: useAppStore.getState,
      nowMs,
      onFailure: async ({ message }) => {
        failures.push(message);
      },
    });

    expect(calls.finalize?.map((args) => args.runId)).toEqual(['run-crashed']);
    expect(failures).toEqual([]);
  });
});

describe('restore and undo restore', () => {
  const seedTurns = async ({ sessionId }: { readonly sessionId: SessionId }) => {
    await useAppStore.getState().loadSessionFolderTurns({ sessionId });
  };

  it('saves the current text as a restore version and lists the restore', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    await seedTurns({ sessionId: writer.sessionId });
    engine({
      overrides: {
        file_versions_folder_restore: (payload: FolderArgs) => {
          const args = record({ name: 'restore', payload });
          return {
            status: 'restored',
            changedSince: [],
            turn: turnOf({
              sessionId: args.sessionId,
              runId: args.restoreRunId ?? '',
              kind: 'restore',
              restoresRunId: args.runId,
            }),
            kept: [versionOf({ id: 'saved-first', relativePath: 'launch-memo.md' })],
          };
        },
      },
    });

    const result = await useAppStore.getState().restoreFolderChange({
      sessionId: writer.sessionId,
      folderPath: NOTES,
      runId: 'run-listed',
      relativePaths: ['launch-memo.md'],
      isForced: false,
    });

    expect(result.status).toBe('restored');
    expect(calls.restore?.[0]).toMatchObject({
      folderPath: NOTES,
      runId: 'run-listed',
      isForced: false,
    });
    expect(await versionRows()).toEqual([
      { id: 'saved-first', snapshot_source: 'restore', provider_run_id: null },
    ]);
    expect(calls.list).toHaveLength(2);
  });

  it('asks when the file changed since and writes nothing', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    engine({
      overrides: {
        file_versions_folder_restore: {
          status: 'changedSince',
          changedSince: ['launch-memo.md'],
          turn: null,
          kept: [],
        },
      },
    });

    const result = await useAppStore.getState().restoreFolderChange({
      sessionId: writer.sessionId,
      folderPath: NOTES,
      runId: 'run-listed',
      isForced: false,
    });

    expect(result.changedSince).toEqual(['launch-memo.md']);
    expect(await versionRows()).toEqual([]);
  });

  it('runs one restore of a file at a time', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    engine({
      overrides: {
        file_versions_folder_restore: async () => {
          await held;
          return { status: 'nothingToRestore', changedSince: [], turn: null, kept: [] };
        },
      },
    });
    const params = {
      sessionId: writer.sessionId,
      folderPath: NOTES,
      runId: 'run-listed',
      relativePaths: ['launch-memo.md'],
      isForced: false,
    };

    const first = useAppStore.getState().restoreFolderChange(params);
    await expect(useAppStore.getState().restoreFolderChange(params)).rejects.toThrow(
      'This restore is already running',
    );
    release();

    expect((await first).status).toBe('nothingToRestore');
  });

  it('undo restore restores the restore run, asks when the file moved on, and is safe to repeat', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    const outcomes = [
      { status: 'changedSince', changedSince: ['launch-memo.md'], turn: null, kept: [] },
      {
        status: 'restored',
        changedSince: ['launch-memo.md'],
        turn: turnOf({
          sessionId: writer.sessionId,
          runId: 'run-undo',
          kind: 'restore',
          restoresRunId: 'run-restore',
        }),
        kept: [versionOf({ id: 'before-undo', relativePath: 'launch-memo.md' })],
      },
      { status: 'nothingToRestore', changedSince: [], turn: null, kept: [] },
    ];
    engine({
      overrides: {
        file_versions_folder_restore: (payload: FolderArgs) => {
          record({ name: 'restore', payload });
          return outcomes.shift();
        },
      },
    });
    const undo = (isForced: boolean) =>
      useAppStore.getState().undoFolderRestore({
        sessionId: writer.sessionId,
        folderPath: NOTES,
        restoreRunId: 'run-restore',
        isForced,
      });

    expect((await undo(false)).status).toBe('changedSince');
    expect((await undo(true)).status).toBe('restored');
    expect((await undo(true)).status).toBe('nothingToRestore');

    expect(calls.restore?.map((args) => [args.runId, args.isForced])).toEqual([
      ['run-restore', false],
      ['run-restore', true],
      ['run-restore', true],
    ]);
    expect((await versionRows()).map((row) => row.id)).toEqual(['before-undo']);
  });

  it('lists what a failed turn restore did before it stopped', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    engine({
      overrides: {
        file_versions_folder_restore: () => {
          throw new Error('stored copy not found');
        },
      },
    });

    await expect(
      useAppStore.getState().restoreFolderChange({
        sessionId: writer.sessionId,
        folderPath: NOTES,
        runId: 'run-listed',
        isForced: false,
      }),
    ).rejects.toThrow('stored copy not found');

    expect(calls.list).toHaveLength(1);
    expect(useAppStore.getState().sessionFolderTurns[writer.sessionId]).toHaveLength(1);
  });
});

describe('pruning saved versions', () => {
  it('passes each session end and removes the rows of the versions it dropped', async () => {
    const live = await startAgent({ goal: 'Tighten the launch memo' });
    const archived = await startAgent({ goal: 'Summarize the interviews' });
    const gone = brandId<SessionId>({ value: 'session-gone' });
    await storySqlite().execute('UPDATE sessions SET archived_at = ? WHERE id = ?', [
      5_000,
      archived.sessionId,
    ]);
    await storySqlite().execute(
      `INSERT INTO file_versions (id, session_id, relative_path, stored_name, size_bytes, content_hash, change_kind, snapshot_source, provider_run_id, captured_at)
       VALUES ('old-version', ?, 'faq.md', 'old-version-faq.md', 6, 'hash', 'modified', 'agent_turn', NULL, 1)`,
      [archived.sessionId],
    );
    engine({
      overrides: {
        file_versions_folder_sessions: [live.sessionId, archived.sessionId, gone],
        file_versions_folder_prune: (payload: FolderArgs) => {
          record({ name: 'prune', payload });
          return {
            pruned: [
              {
                sessionId: archived.sessionId,
                runId: 'run-old',
                versionId: 'old-version',
                storedName: 'old-version-faq.md',
                relativePath: 'faq.md',
              },
            ],
            removedTurns: 1,
            versionBytes: 0,
            capBytes: 1024,
          };
        },
      },
    });

    const summary = await useAppStore.getState().pruneFolderVersions({ nowMs: 9_000 });

    expect(summary).toEqual({ prunedCount: 1, folderCount: 1 });
    expect(calls.prune?.[0]?.sessions).toEqual([
      { sessionId: live.sessionId, endedAtMs: null },
      { sessionId: archived.sessionId, endedAtMs: 5_000 },
      { sessionId: gone, endedAtMs: 0 },
    ]);
    expect(await versionRows()).toEqual([]);
  });
});

describe('the first copy of a folder', () => {
  const readyStatus = {
    folderPath: NOTES,
    isReady: true,
    isTurnOpen: false,
    fileCount: 86,
    keptBytes: 42,
    skipped: [],
    method: 'clone',
  };

  it('says it could not start, and Retry makes it', async () => {
    let attempt = 0;
    engine({
      overrides: {
        file_versions_folder_prepare: () => {
          attempt += 1;
          if (attempt === 1) {
            throw new Error('the disk is full');
          }
          return readyStatus;
        },
      },
    });

    await expect(useAppStore.getState().prepareFolderVersions({ folder: notes })).rejects.toThrow(
      'the disk is full',
    );
    expect(useAppStore.getState().folderVersionsStatus[notes.id]).toEqual({
      kind: 'failed',
      message: 'the disk is full',
    });

    await useAppStore.getState().prepareFolderVersions({ folder: notes });

    expect(useAppStore.getState().folderVersionsStatus[notes.id]).toEqual({
      kind: 'ready',
      status: readyStatus,
    });
  });

  it('drops the answer for a folder removed while it was copied, and forgets its copy', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    engine({
      overrides: {
        file_versions_folder_prepare: async () => {
          await held;
          return readyStatus;
        },
        file_versions_folder_forget: (payload: FolderArgs) => {
          record({ name: 'forget', payload });
          return null;
        },
      },
    });

    const preparing = useAppStore.getState().prepareFolderVersions({ folder: notes });
    useAppStore.setState({ projects: [] });
    await useAppStore.getState().forgetFolderVersions({ folder: notes });
    release();
    await preparing;

    expect(calls.forget).toEqual([{ folderPath: NOTES }]);
    expect(useAppStore.getState().folderVersionsStatus[notes.id]).toBeUndefined();
  });

  it('keeps the newest size of the saved versions', async () => {
    const sizes = [
      { versionBytes: 5, capBytes: 100 },
      { versionBytes: 18, capBytes: 100 },
    ];
    let releaseFirst: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let call = 0;
    engine({
      overrides: {
        file_versions_folder_size: async () => {
          call += 1;
          const size = sizes[call - 1];
          if (call === 1) {
            await firstHeld;
          }
          return {
            folderPath: NOTES,
            isReady: true,
            fileCount: 2,
            keptBytes: 12,
            versionCount: 1,
            ...size,
          };
        },
      },
    });

    const first = useAppStore.getState().loadFolderHistorySize({ folder: notes });
    await useAppStore.getState().loadFolderHistorySize({ folder: notes });
    releaseFirst();
    await first;

    expect(useAppStore.getState().folderHistorySizes[notes.id]?.usedBytes).toBe(18);
  });
});

describe('a folder tracked with git after its sessions wrote in it', () => {
  it('keeps listing the saved turns of the sessions that wrote there', async () => {
    const writer = await startAgent({ goal: 'Tighten the launch memo' });
    await useAppStore.getState().loadSessionFolderTurns({ sessionId: writer.sessionId });
    expect(useAppStore.getState().sessionFolderTurns[writer.sessionId]).toHaveLength(1);

    useAppStore.setState({
      projects: [
        { ...notes, kind: 'repo' },
        { ...research, kind: 'repo' },
      ],
    });
    await useAppStore
      .getState()
      .loadSessionFolderTurns({ sessionId: writer.sessionId, isForced: true });

    const turns = useAppStore.getState().sessionFolderTurns[writer.sessionId] ?? [];
    expect(turns.map((turn) => turn.folderId)).toEqual([notes.id]);
    expect(
      historyFoldersOf({ state: useAppStore.getState(), sessionId: writer.sessionId }).map(
        (folder) => folder.id,
      ),
    ).toEqual([notes.id]);
    expect(
      inPlaceFoldersOf({ state: useAppStore.getState(), sessionId: writer.sessionId }),
    ).toEqual([]);
  });
});

describe('unlinking a folder while an agent writes in it', () => {
  const statusWith = ({ isTurnOpen }: { readonly isTurnOpen: boolean }) => ({
    file_versions_folder_status: (payload: FolderArgs) => ({
      folderPath: payload.args.folderPath,
      isReady: true,
      isTurnOpen,
      fileCount: 2,
      keptBytes: 12,
      skipped: [],
      method: 'clone',
    }),
    file_versions_folder_forget: (payload: FolderArgs) => {
      record({ name: 'forget', payload });
      return null;
    },
  });

  it('refuses, keeps the folder linked and keeps the turn staging', async () => {
    engine({ overrides: statusWith({ isTurnOpen: true }) });

    await expect(useAppStore.getState().removeProject({ projectId: notes.id })).rejects.toThrow(
      /still saving changes in acme-notes/,
    );

    expect(calls.forget).toBeUndefined();
    expect(useAppStore.getState().projects.map((project) => project.id)).toEqual([notes.id]);
  });

  it('unlinks and forgets the first copy once the turn has finished, on retry', async () => {
    engine({ overrides: statusWith({ isTurnOpen: true }) });
    await expect(useAppStore.getState().removeProject({ projectId: notes.id })).rejects.toThrow();

    engine({ overrides: statusWith({ isTurnOpen: false }) });
    await useAppStore.getState().removeProject({ projectId: notes.id });

    expect(calls.forget).toEqual([{ folderPath: NOTES }]);
    expect(useAppStore.getState().projects).toEqual([]);
  });
});
