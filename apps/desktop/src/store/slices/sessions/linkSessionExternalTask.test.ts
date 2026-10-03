// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

const SESSION = aSession({ id: 's-retry' as SessionId, goal: 'Retry failed payments' });

const TASK = {
  provider: 'linear' as const,
  externalId: 'lin-212',
  identifier: 'HAR-212',
  url: 'https://linear.app/harborline/issue/HAR-212',
  title: 'Duplicate credit on webhook redelivery',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
};

const linksOf = () =>
  (useAppStore.getState().sessionExternalTasks[SESSION.id] ?? []).map((task) => ({
    scope: task.scope ?? 'session',
    branch: task.branch ?? null,
    relation: task.relation ?? 'closes',
  }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [SESSION], sessionExternalTasks: {} });
});

describe('linkSessionExternalTask by scope', () => {
  it('keeps the session link and the branch link of one task, once each', async () => {
    const { linkSessionExternalTask } = useAppStore.getState();

    await linkSessionExternalTask(SESSION.id, { ...TASK, branch: 'hl/fix-duplicate-credit' });
    await linkSessionExternalTask(SESSION.id, {
      ...TASK,
      scope: 'branch',
      branch: 'hl/fix-duplicate-credit',
      relation: 'part-of',
    });
    await linkSessionExternalTask(SESSION.id, {
      ...TASK,
      scope: 'branch',
      branch: 'hl/fix-duplicate-credit',
      relation: 'part-of',
    });

    expect(linksOf()).toEqual([
      { scope: 'session', branch: 'hl/fix-duplicate-credit', relation: 'closes' },
      { scope: 'branch', branch: 'hl/fix-duplicate-credit', relation: 'part-of' },
    ]);
  });

  it('refuses a branch link while the session has no branch', async () => {
    await expect(
      useAppStore.getState().linkSessionExternalTask(SESSION.id, { ...TASK, scope: 'branch' }),
    ).rejects.toThrow('This session has no branch yet');
    expect(linksOf()).toEqual([]);
  });

  it('unlinks the branch link and leaves the session link alone', async () => {
    const { linkSessionExternalTask, unlinkSessionExternalTask } = useAppStore.getState();
    await linkSessionExternalTask(SESSION.id, { ...TASK, branch: 'hl/fix-duplicate-credit' });
    await linkSessionExternalTask(SESSION.id, {
      ...TASK,
      scope: 'branch',
      branch: 'hl/fix-duplicate-credit',
    });

    await unlinkSessionExternalTask(
      SESSION.id,
      'linear',
      'lin-212',
      undefined,
      'hl/fix-duplicate-credit',
    );

    expect(linksOf()).toEqual([
      { scope: 'session', branch: 'hl/fix-duplicate-credit', relation: 'closes' },
    ]);
  });
});
