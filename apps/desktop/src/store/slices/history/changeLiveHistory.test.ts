import { insertWorkspace, insertSession } from '@goodboy/db';
import { buildStoryWorkspace, storySqlite, injectDbFault } from '../../storyHarness';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  openStorySqlite,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../storyHarness';
import { seedLiveHistory } from '../../../features/history/testing/seedLiveHistory';
import { LEDGER_COMMITS, LEDGER } from '../../../features/history/testing/ledgerFixture';
import { initialPlanItems, rewordStep } from '../../../features/history/historyPlan';
import type { HistoryLiveOutcome } from '../../../features/history/historyLiveTypes';
import { resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import { setHistoryRun } from './setHistoryRun';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

let store: Awaited<ReturnType<typeof importStore>>;
let fixture: ReturnType<typeof seedLiveHistory>;
let result: HistoryLiveOutcome;
let head: string = LEDGER.f;
const edits: unknown[] = [];
const restores: unknown[] = [];
let handlers: Parameters<typeof stubStoryInvoke>[0] = {};

const live = () => store.getState().historyLiveSessions[fixture.mount.mountId];
const edit = () =>
  store.getState().changeLiveHistory({
    ...fixture.input,
    sha: LEDGER.f,
    items: rewordStep({
      items: initialPlanItems({ commits: LEDGER_COMMITS }),
      sha: LEDGER.f,
      message: 'Acme export',
      original: LEDGER_COMMITS[0]?.subject ?? '',
    }),
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  resetWorktreeStatusCache();
  fixture = seedLiveHistory({ store });
  store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: true });
  head = LEDGER.f;
  edits.length = 0;
  restores.length = 0;
  result = {
    kind: 'finished',
    outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old', carriedCount: 0 },
    map: [],
  };
  handlers = {
    history_live_edit: (args: unknown) => {
      edits.push(args);
      if (result.kind === 'finished' && result.outcome.kind === 'moved') {
        head = result.outcome.head;
      }
      return result;
    },
    history_restore: (args: unknown) => {
      restores.push(args);
      head = head === 'new-head' ? LEDGER.f : 'new-head';
      return { kind: 'moved', head, backupRef: `backup-${head}`, carriedCount: 0 };
    },
    worktree_status: () => ({
      branch: fixture.mount.branch,
      head,
      upstream: 'origin/hl/ledger-export',
      upstreamDistance: { kind: 'known', ahead: 1, behind: 1 },
      mainDistance: { kind: 'known', ahead: 7, behind: 0 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    }),
    worktree_commits: () =>
      LEDGER_COMMITS.map((commit, index) => (index === 0 ? { ...commit, sha: head } : commit)),
    history_graph: () => null,
    history_plan_predict: () => ({
      isSupported: true,
      head,
      steps: [],
      isTreeEqual: true,
      changedFiles: [],
    }),
  };
  stubStoryInvoke(handlers);
  const session = store.getState().sessions[0];
  if (session === undefined || session.workspaceId === null) {
    throw new Error('The live history fixture needs a workspace.');
  }
  await insertWorkspace({
    db: storySqlite(),
    workspace: buildStoryWorkspace({ id: session.workspaceId, name: 'Harborline' }),
  });
  await insertSession(storySqlite(), session);
});

describe('live history through the real store and SQLite', () => {
  it('applies an edit immediately, records its backup and never pushes', async () => {
    await edit();
    expect(live()?.undo).toHaveLength(1);
    expect(live()?.redo).toEqual([]);
    expect(store.getState().historyDrafts[fixture.mount.mountId]?.headSha).toBe('new-head');
    expect(edits[0]).toMatchObject({
      args: {
        request: {
          branch: fixture.mount.branch,
          plan: {
            head: LEDGER.f,
            steps: expect.arrayContaining([
              expect.objectContaining({ verb: 'reword', message: 'Acme export' }),
            ]),
          },
        },
      },
    });
  });

  it('undoes and redoes using reciprocal refs with exact expected heads', async () => {
    await edit();
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    expect(live()?.undo).toEqual([]);
    expect(live()?.redo).toHaveLength(1);
    expect(restores[0]).toMatchObject({
      args: {
        worktreePath: fixture.mount.worktreePath,
        backupRef: 'backup-old',
        expectedHead: 'new-head',
      },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(restores[1]).toMatchObject({
      args: { backupRef: `backup-${LEDGER.f}`, expectedHead: LEDGER.f },
    });
    expect(live()?.undo).toHaveLength(1);
  });

  it('resolves false for an empty stack and true when the branch moved', async () => {
    expect(await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' })).toBe(
      false,
    );
    expect(edits).toHaveLength(0);
    await edit();
    expect(await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' })).toBe(
      true,
    );
  });

  it('clears redo when a new edit follows undo', async () => {
    await edit();
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    await edit();
    expect(live()?.redo).toEqual([]);
    expect(live()?.undo).toHaveLength(1);
  });

  it('leaves the branch list and stack unchanged when an agent holds the reservation', async () => {
    result = { kind: 'blocked', reason: 'Acme agent is writing here' };
    await edit();
    expect(live()?.undo).toEqual([]);
    expect(live()?.error).toContain('Acme agent');
    expect(store.getState().historyDrafts[fixture.mount.mountId]?.headSha).toBe(LEDGER.f);
  });

  it('keeps a failed undo on the stack so retry targets the same ref', async () => {
    await edit();
    stubStoryInvoke({
      ...handlers,
      history_restore: () => ({ kind: 'busy', holder: 'Acme agent' }),
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    expect(live()?.undo).toHaveLength(1);
    expect(live()?.redo).toEqual([]);
    expect(live()?.pending).toMatchObject({
      expectedHead: 'new-head',
      entry: { backupRef: 'backup-old' },
    });
  });

  it('keeps the redo stack after an uncertain IPC failure', async () => {
    await edit();
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    stubStoryInvoke({
      history_restore: () => {
        throw new Error('Connection lost');
      },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(live()?.redo).toHaveLength(1);
    expect(live()?.error).toContain('Connection lost');
  });

  it('retries stash consent with the captured plan after the draft changed', async () => {
    result = {
      kind: 'finished',
      outcome: { kind: 'needs-stash', dirtyCount: 1, files: ['export.ts'] },
      map: [],
    };
    await edit();
    expect(live()?.shouldStashFiles).toBe(true);
    result = { kind: 'blocked', reason: 'The branch moved' };
    await store
      .getState()
      .changeLiveHistory({ ...fixture.input, shouldRetry: true, shouldStash: true });
    expect(edits[1]).toMatchObject({
      args: { shouldStash: true, request: { plan: { head: LEDGER.f } } },
    });
    expect(live()?.undo).toEqual([]);
  });

  it('queues no second edit while one runs', async () => {
    let release: (value: HistoryLiveOutcome) => void = () => undefined;
    stubStoryInvoke({
      history_live_edit: () =>
        new Promise<HistoryLiveOutcome>((resolve) => {
          release = resolve;
        }),
    });
    const pending = edit();
    expect(live()?.isBusy).toBe(true);
    await edit();
    release({ kind: 'blocked', reason: 'Acme agent is writing here' });
    await pending;
    expect(live()?.undo).toEqual([]);
    expect(live()?.isBusy).toBe(false);
  });

  it('drops a late answer after leaving and reopening the page', async () => {
    let release: (value: HistoryLiveOutcome) => void = () => undefined;
    stubStoryInvoke({
      history_live_edit: () =>
        new Promise<HistoryLiveOutcome>((resolve) => {
          release = resolve;
        }),
    });
    const pending = edit();
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: false });
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-two', isOpen: true });
    release({ kind: 'blocked', reason: 'Old page error' });
    await pending;
    expect(live()).toMatchObject({
      token: 'page-two',
      undo: [],
      redo: [],
      error: null,
      isBusy: false,
    });
  });

  it('clears only its own page session on leaving', async () => {
    await edit();
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-two', isOpen: true });
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: false });
    expect(live()?.token).toBe('page-two');
    expect(live()?.undo).toEqual([]);
  });

  it('refuses undo after the mount branch was renamed', async () => {
    await edit();
    store.setState({
      sessionProjectMounts: {
        [fixture.input.sessionId]: [{ ...fixture.mount, branch: 'hl/renamed-export' }],
      },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    expect(restores).toEqual([]);
    expect(live()?.undo).toHaveLength(1);
    expect(live()?.error).not.toBeNull();
  });

  it('records a partially successful move with Undo when stash restoration conflicts', async () => {
    result = {
      kind: 'finished',
      outcome: {
        kind: 'restore-conflict',
        head: 'new-head',
        backupRef: 'backup-old',
        stash: 'saved-files',
        files: ['export.ts'],
      },
      map: [],
    };
    await edit();
    expect(live()?.undo).toHaveLength(1);
    expect(store.getState().historyRuns[fixture.input.mountId]).toMatchObject({
      phase: 'restore-conflict',
      savedStash: { sha: 'saved-files' },
    });
    expect(live()?.error).toContain('saved files');
  });
});

describe('live history recovery and metadata', () => {
  it('remaps real comment references and restores them on undo and redo', async () => {
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_acme_export',
      patch: { commitShas: [LEDGER.f], fixupOfSha: LEDGER.f },
    });
    result = {
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old', carriedCount: 0 },
      map: [{ from: LEDGER.f, to: 'new-head' }],
    };
    await edit();
    expect(store.getState().sessionResolveThreads[fixture.input.sessionId]?.[0]).toMatchObject({
      commitShas: ['new-head'],
      fixupOfSha: 'new-head',
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    expect(store.getState().sessionResolveThreads[fixture.input.sessionId]?.[0]).toMatchObject({
      commitShas: [LEDGER.f],
      fixupOfSha: LEDGER.f,
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(store.getState().sessionResolveThreads[fixture.input.sessionId]?.[0]).toMatchObject({
      commitShas: ['new-head'],
      fixupOfSha: 'new-head',
    });
  });

  it('retains Undo and refreshes the branch when metadata writes fail after Git succeeds', async () => {
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_acme_export',
      patch: { commitShas: [LEDGER.f] },
    });
    injectDbFault({ match: /INSERT INTO resolve_threads/ });
    result = {
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old', carriedCount: 0 },
      map: [{ from: LEDGER.f, to: 'new-head' }],
    };
    await edit();
    expect(live()?.undo).toHaveLength(1);
    expect(live()?.error).not.toBeNull();
    expect(store.getState().historyDrafts[fixture.input.mountId]?.headSha).toBe('new-head');
  });

  it('restores two successive edits and redoes them in order', async () => {
    await edit();
    result = {
      kind: 'finished',
      outcome: { kind: 'moved', head: 'second-head', backupRef: 'backup-first', carriedCount: 0 },
      map: [],
    };
    await edit();
    const heads = ['new-head', LEDGER.f, 'new-head', 'second-head'];
    stubStoryInvoke({
      ...handlers,
      history_restore: (args: unknown) => {
        restores.push(args);
        head = heads.shift() ?? '';
        return { kind: 'moved', head, backupRef: `reciprocal-${head}` };
      },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    expect(restores[0]).toMatchObject({
      args: { expectedHead: 'second-head', backupRef: 'backup-first' },
    });
    expect(restores[1]).toMatchObject({
      args: { expectedHead: 'new-head', backupRef: 'backup-old' },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(live()?.redo).toEqual([]);
    expect(live()?.undo).toHaveLength(2);
    expect(head).toBe('second-head');
  });

  it('does not apply a late successful result to the reopened page', async () => {
    let release: (value: HistoryLiveOutcome) => void = () => undefined;
    stubStoryInvoke({
      ...handlers,
      history_live_edit: () =>
        new Promise<HistoryLiveOutcome>((resolve) => {
          release = resolve;
        }),
    });
    const pending = edit();
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: false });
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-two', isOpen: true });
    release({
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old' },
      map: [],
    });
    await pending;
    expect(live()).toMatchObject({ token: 'page-two', undo: [], redo: [], error: null });
    expect(store.getState().historyRuns[fixture.input.mountId]).toBeUndefined();
  });

  it('remaps references and records the event when the page closed during a successful edit', async () => {
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_acme_export',
      patch: { commitShas: [LEDGER.f] },
    });
    const recordSessionEvent = vi.fn(async () => undefined);
    store.setState({ recordSessionEvent });
    let release: (value: HistoryLiveOutcome) => void = () => undefined;
    stubStoryInvoke({
      ...handlers,
      history_live_edit: () =>
        new Promise<HistoryLiveOutcome>((resolve) => {
          release = resolve;
        }),
    });
    const pending = edit();
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: false });
    store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-two', isOpen: true });
    release({
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old' },
      map: [{ from: LEDGER.f, to: 'new-head' }],
    });
    await pending;
    expect(store.getState().sessionResolveThreads[fixture.input.sessionId]?.[0]).toMatchObject({
      commitShas: ['new-head'],
    });
    expect(recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'history_rewritten' }),
    );
    expect(live()).toMatchObject({ token: 'page-two', undo: [], redo: [] });
  });

  it('drops a restore conflict when the page is replaced during the bookkeeping awaits', async () => {
    result = {
      kind: 'finished',
      outcome: {
        kind: 'restore-conflict',
        head: 'new-head',
        backupRef: 'backup-old',
        stash: 'saved-files',
        files: ['export.ts'],
      },
      map: [],
    };
    const original = store.getState().recordSessionEvent;
    const recordSessionEvent = vi.fn(async () => {
      store
        .getState()
        .setHistoryLiveSession({ ...fixture.input, token: 'page-one', isOpen: false });
      store.getState().setHistoryLiveSession({ ...fixture.input, token: 'page-two', isOpen: true });
    });
    store.setState({ recordSessionEvent });
    await edit();
    store.setState({ recordSessionEvent: original });
    expect(recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'history_rewritten' }),
    );
    expect(live()).toMatchObject({ token: 'page-two', error: null });
    expect(store.getState().historyRuns[fixture.input.mountId]?.phase).not.toBe('restore-conflict');
    expect(store.getState().historyRuns[fixture.input.mountId]?.savedStash).toBeUndefined();
  });

  it('keeps the latest branch read when an older loader responds last', async () => {
    let release: (commits: typeof LEDGER_COMMITS) => void = () => undefined;
    let hasRead = false;
    stubStoryInvoke({
      ...handlers,
      worktree_commits: () => {
        if (hasRead) {
          return LEDGER_COMMITS.map((commit, index) =>
            index === 0 ? { ...commit, sha: 'new-head' } : commit,
          );
        }
        hasRead = true;
        return new Promise<typeof LEDGER_COMMITS>((resolve) => {
          release = resolve;
        });
      },
    });
    const older = store.getState().loadHistoryDraft(fixture.input);
    await store.getState().loadHistoryDraft(fixture.input);
    release(LEDGER_COMMITS);
    await older;
    expect(store.getState().historyDrafts[fixture.input.mountId]?.headSha).toBe('new-head');
  });
});

describe('redo after a metadata failure', () => {
  it('restores the intended references even when the first write did not land', async () => {
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_acme_export',
      patch: { commitShas: [LEDGER.f], replacesSha: LEDGER.f },
    });
    injectDbFault({ match: /INSERT INTO resolve_threads/ });
    result = {
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old' },
      map: [{ from: LEDGER.f, to: 'new-head' }],
    };
    await edit();
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(store.getState().sessionResolveThreads[fixture.input.sessionId]?.[0]).toMatchObject({
      commitShas: ['new-head'],
      replacesSha: 'new-head',
    });
    expect(live()?.error).toBeNull();
  });
});

describe('live history target and reference isolation', () => {
  it('keeps a checked Rewriter result for an immediate retry when the writer is busy', async () => {
    let isWriterBusy = true;
    let calls = 0;
    stubStoryInvoke({
      ...handlers,
      history_remote_lease: () => ({ kind: 'no-upstream' }),
      history_plan_apply: () => {
        calls += 1;
        if (isWriterBusy) {
          return { kind: 'busy', holder: 'Acme agent' };
        }
        head = 'new-head';
        return { kind: 'moved', head, backupRef: 'backup-old', carriedCount: 0 };
      },
    });
    const identity = {
      branch: fixture.mount.branch,
      worktreePath: fixture.mount.worktreePath,
      projectId: fixture.mount.projectId,
    };
    setHistoryRun({
      set: store.setState,
      ...fixture.input,
      origin: 'plan',
      patch: {
        phase: 'rewritten',
        result: {
          head: 'new-head',
          expectedHead: LEDGER.f,
          map: [],
          isTreeEqual: true,
          changedFiles: [],
          byAgent: true,
          identity,
        },
      },
    });
    expect(
      await store.getState().applyRewrittenHistory({ ...fixture.input, shouldPush: false }),
    ).toBe('busy');
    expect(calls).toBe(1);
    expect(store.getState().historyRuns[fixture.input.mountId]).toMatchObject({
      phase: 'rewritten',
      stop: { reason: 'blocked' },
      result: { head: 'new-head' },
    });
    expect(live()?.undo).toEqual([]);
    isWriterBusy = false;
    expect(
      await store.getState().applyRewrittenHistory({ ...fixture.input, shouldPush: false }),
    ).toBe('applied');
    expect(calls).toBe(2);
    expect(live()?.undo).toHaveLength(1);
  });

  it('keeps unrelated references changed after the edit when undoing and redoing', async () => {
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_acme_export',
      patch: { commitShas: [LEDGER.f] },
    });
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_northwind_export',
      patch: { commitShas: [LEDGER.b] },
    });
    result = {
      kind: 'finished',
      outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old' },
      map: [{ from: LEDGER.f, to: 'new-head' }],
    };
    await edit();
    await store.getState().updateResolveThread({
      ...fixture.input,
      threadId: 'PRRT_northwind_export',
      patch: { commitShas: ['northwind-head'] },
    });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'undo' });
    await store.getState().changeLiveHistory({ ...fixture.input, direction: 'redo' });
    expect(
      store
        .getState()
        .sessionResolveThreads[fixture.input.sessionId]?.find(
          (thread) => thread.threadId === 'PRRT_northwind_export',
        )?.commitShas,
    ).toEqual(['northwind-head']);
  });

  it('reports a missing branch target before sending anything to Git', async () => {
    store.setState({ sessionProjectMounts: {} });
    await edit();
    expect(edits).toEqual([]);
    expect(live()?.error).not.toBeNull();
    expect(live()?.undo).toEqual([]);
  });
});
