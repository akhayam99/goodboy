// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionMenuOf } from '../../../app/components/SessionActions/sessionMenuOf';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { SESSION_KIND } from './session';

let useAppStore: StoryStore;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger-core' });
const TARGET = { kind: 'session', sessionId: SESSION_ID } as const;
const OPEN_ACTIVITY = 'session.openLog';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'Export the ledger' }),
    ],
  });
});

const factsNow = () => {
  const facts = SESSION_KIND.facts({ state: useAppStore.getState(), target: TARGET });
  if (facts === null) {
    throw new Error('no facts');
  }
  return facts;
};

describe('Open activity', () => {
  it('reads Open activity in the palette and sits in the Open submenu of the card menu', () => {
    const actions = resolveActions({
      definitions: SESSION_KIND.actions,
      facts: factsNow(),
      viewing: null,
    });
    const open = actions.find((action) => action.id === OPEN_ACTIVITY);

    expect(open?.label).toBe('Open activity');
    expect(SESSION_KIND.actions.find((action) => action.id === OPEN_ACTIVITY)?.submenu).toBe(
      'open',
    );
  });

  it('stays out of the session ⋯', () => {
    expect(sessionMenuOf({ isArchived: false })).not.toContain(OPEN_ACTIVITY);
    expect(sessionMenuOf({ isArchived: true })).not.toContain(OPEN_ACTIVITY);
  });

  it('opens the Activity page of the session it was asked from', async () => {
    const open = SESSION_KIND.actions.find((action) => action.id === OPEN_ACTIVITY);
    const env: ActionEnv = {
      getState: () => useAppStore.getState(),
      showToast: vi.fn(),
      copyText: vi.fn(async () => undefined),
      origin: 'palette',
      anchorKey: null,
      viewing: null,
    };

    await open?.run({ facts: factsNow(), env, choice: null });

    expect(useAppStore.getState().currentSessionId).toBe(SESSION_ID);
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('activity');
  });
});
