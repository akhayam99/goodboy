import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { SessionExternalTask } from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = aWorkspace().id;
const SESSION_ID = aSession().id;
const PAYMENTS = aProject().id;
const LEDGER = aProject().id;

const SESSION_ROW: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'lin-204',
  identifier: 'HL-204',
  url: 'https://linear.app/harborline/issue/HL-204',
  title: 'Round ledger amounts once',
  createdAt: TEST_NOW,
  scope: 'session',
  projectId: PAYMENTS,
  relation: 'part-of',
};

const BARE_ROW: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'lin-204',
  identifier: 'HL-204',
  url: 'https://linear.app/harborline/issue/HL-204',
  title: 'Round ledger amounts once',
  createdAt: TEST_NOW,
  scope: 'session',
  projectId: PAYMENTS,
};

const BRANCH_A: SessionExternalTask = {
  ...SESSION_ROW,
  scope: 'branch',
  branch: 'hl/ledger-rounding',
  relation: 'closes',
};

const BRANCH_B: SessionExternalTask = { ...BRANCH_A, branch: 'hl/fix-duplicate-credit' };

let useAppStore: StoryStore;

type StoredLink = { scope: string; branch: string | null; relation: string };

const storedLinks = () =>
  rowsOf<StoredLink>({
    sql: 'SELECT scope, branch, relation FROM session_external_tasks ORDER BY scope, branch',
  });

const lastNotice = () => useAppStore.getState().undoNotices.at(-1)?.toast.message;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }));
  useAppStore.setState({
    sessionExternalTasks: {},
    projects: [
      aProject({ id: PAYMENTS, workspaceId: WORKSPACE_ID, name: 'payments-api' }),
      aProject({ id: LEDGER, workspaceId: WORKSPACE_ID, name: 'ledger-core' }),
    ],
  });
});

describe('moveSessionExternalTask', () => {
  it('moves a session placement onto a branch and keeps the relation', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, SESSION_ROW);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: SESSION_ROW,
      to: { kind: 'branch', projectId: PAYMENTS, branch: 'hl/ledger-rounding' },
    });

    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/ledger-rounding', relation: 'part-of' },
    ]);
    expect(lastNotice()).toBe('HL-204 is on payments-api / hl/ledger-rounding');
  });

  it('gives a branch row the closes relation when the source had none', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BARE_ROW);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: BARE_ROW,
      to: { kind: 'branch', projectId: PAYMENTS, branch: 'hl/ledger-rounding' },
    });

    expect((await storedLinks())[0]?.relation).toBe('closes');
  });

  it('moves the last branch back to the session and says so', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: BRANCH_A,
      to: { kind: 'session' },
    });

    expect(await storedLinks()).toEqual([
      { scope: 'session', branch: 'hl/ledger-rounding', relation: 'closes' },
    ]);
    expect(lastNotice()).toBe('HL-204 is on the session again');
  });

  it('moves branch A to branch B in one write and one Undo entry', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);
    const writes = vi.fn();
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.sessionExternalTasks !== previous.sessionExternalTasks) {
        writes();
      }
    });

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: BRANCH_A,
      to: { kind: 'branch', projectId: PAYMENTS, branch: BRANCH_B.branch ?? '' },
    });
    unsubscribe();

    expect(writes).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/fix-duplicate-credit', relation: 'closes' },
    ]);
  });

  it('restores the exact rows on Undo', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, SESSION_ROW);
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);
    const before = [...(useAppStore.getState().sessionExternalTasks[SESSION_ID] ?? [])];
    const stored = await storedLinks();

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: BRANCH_A,
      to: { kind: 'branch', projectId: PAYMENTS, branch: 'hl/fix-duplicate-credit' },
    });
    await useAppStore.getState().undoLastOperation({});

    expect(await storedLinks()).toEqual(stored);
    expect(useAppStore.getState().sessionExternalTasks[SESSION_ID]).toEqual(before);
  });

  it('refuses a branch of another project and writes nothing', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);

    await expect(
      moveSessionExternalTask({
        sessionId: SESSION_ID,
        task: BRANCH_A,
        to: { kind: 'branch', projectId: LEDGER, branch: 'lc/other' },
      }),
    ).rejects.toThrow('HL-204 belongs to payments-api. ledger-core has no place for it.');

    expect(await storedLinks()).toEqual([
      { scope: 'branch', branch: 'hl/ledger-rounding', relation: 'closes' },
    ]);
    expect(useAppStore.getState().undoStack).toEqual([]);
  });

  it('keeps a second branch when the first one is copied, not moved', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: BRANCH_A,
      to: { kind: 'branch', projectId: PAYMENTS, branch: 'hl/fix-duplicate-credit' },
      isCopy: true,
    });

    expect((await storedLinks()).map((row) => row.branch)).toEqual([
      'hl/fix-duplicate-credit',
      'hl/ledger-rounding',
    ]);
  });

  it('does nothing and records no Undo when the task is already there', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, SESSION_ROW);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: SESSION_ROW,
      to: { kind: 'session' },
    });

    expect(useAppStore.getState().undoStack).toEqual([]);
    expect(await storedLinks()).toHaveLength(1);
  });

  it('refuses an empty branch name', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, SESSION_ROW);

    await expect(
      moveSessionExternalTask({
        sessionId: SESSION_ID,
        task: SESSION_ROW,
        to: { kind: 'branch', projectId: PAYMENTS, branch: '' },
      }),
    ).rejects.toThrow('Pick a branch');
  });

  it('moves a task that sits only on branches as one unit when it comes from the session level', async () => {
    const { linkSessionExternalTask, moveSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION_ID, BRANCH_A);
    await linkSessionExternalTask(SESSION_ID, BRANCH_B);

    await moveSessionExternalTask({
      sessionId: SESSION_ID,
      task: { ...BRANCH_A, scope: 'session' },
      to: { kind: 'session' },
    });

    expect(await storedLinks()).toEqual([
      { scope: 'session', branch: 'hl/ledger-rounding', relation: 'closes' },
    ]);
  });
});
