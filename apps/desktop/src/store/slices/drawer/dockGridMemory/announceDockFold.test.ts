// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { dockGridOwner } from '../dockGridWrites';
import { dockFoldMessageOf } from '../../../../shared/shellFocus/dockFoldMessageOf';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ sessions: [aSession({ id: SESSION_ID })], currentSessionId: SESSION_ID });
  dockGridOwner.take({ sessionId: SESSION_ID });
  store.getState().openDrawer({ kind: 'browser', sessionId: null, payload: null });
  store.getState().openDrawer({ kind: 'monitoring', sessionId: null, payload: null });
});

const openKinds = (): ReadonlyArray<string> =>
  (store.getState().drawerGrid?.columns ?? []).flat().map((panel) => panel.kind);

const announce = (): void =>
  store.getState().announceDockFold({
    sessionId: SESSION_ID,
    opened: 'monitoring',
    message: 'Monitor folded into the Browser tab',
  });

describe('the fold toast', () => {
  it('names the fold and the panel it hides', () => {
    expect(
      dockFoldMessageOf({
        fold: {
          opened: 'monitoring',
          folds: [
            { key: 'monitoring', into: 'browser' },
            { key: 'terminal', into: 'browser' },
          ],
        },
        labelOf: ({ key }) =>
          ({ monitoring: 'Monitor', terminal: 'Terminal', browser: 'Browser' })[key] ?? key,
      }),
    ).toBe('Monitor and Terminal folded into the Browser tab');
  });

  it('offers Undo, and Undo closes the panel that was opened', async () => {
    announce();

    const notice = store.getState().undoStack.at(-1);
    expect(notice).toBeDefined();
    expect(openKinds()).toContain('monitoring');

    await store.getState().undoLastOperation({ id: notice?.id ?? '' });

    expect(openKinds()).not.toContain('monitoring');
    expect(openKinds()).toContain('browser');
  });

  it('forgets the Undo once the panel was closed another way', async () => {
    announce();
    const entry = (store.getState().drawerGrid?.columns ?? [])
      .flat()
      .find((panel) => panel.kind === 'monitoring');
    if (entry === undefined) {
      throw new Error('The Monitor is open');
    }

    store.getState().closeDrawerEntry({ entry });
    const isUndone = await store.getState().undoLastOperation();

    expect(isUndone).toBe(false);
    expect(openKinds()).toEqual(['browser']);
  });

  it('forgets the Undo once another session owns the grid', async () => {
    announce();
    dockGridOwner.take({ sessionId: null });

    expect(await store.getState().undoLastOperation()).toBe(false);
    expect(openKinds()).toContain('monitoring');
  });
});
