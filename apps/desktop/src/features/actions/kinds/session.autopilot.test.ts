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
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { SESSION_KIND } from './session';

let useAppStore: StoryStore;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const TARGET = { kind: 'session', sessionId: SESSION_ID } as const;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'Retry payments' }),
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

const idsNow = (): ReadonlyArray<string> =>
  resolveActions({ definitions: SESSION_KIND.actions, facts: factsNow() }).map(
    (action) => action.id,
  );

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const runNow = async ({ id }: { readonly id: string }): Promise<void> => {
  await SESSION_KIND.actions
    .find((action) => action.id === id)
    ?.run({ facts: factsNow(), env, choice: null });
};

const isAutoRun = (): boolean =>
  sessionById(useAppStore.getState().sessions, SESSION_ID)?.autoRun === true;

describe('the session Autopilot verbs', () => {
  it('turns the session autorun on from the menu, then offers to turn it off', async () => {
    expect(idsNow()).toContain('session.autopilotOn');
    expect(idsNow()).not.toContain('session.autopilotOff');

    await runNow({ id: 'session.autopilotOn' });

    expect(isAutoRun()).toBe(true);
    expect(idsNow()).toContain('session.autopilotOff');
    expect(idsNow()).not.toContain('session.autopilotOn');
  });

  it('turns it back off, so the way back is always there', async () => {
    await runNow({ id: 'session.autopilotOn' });

    await runNow({ id: 'session.autopilotOff' });

    expect(isAutoRun()).toBe(false);
  });

  it('offers neither on an archived session', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'Retry payments',
          archivedAt: brandedId<IsoDateTime>({ value: '2026-10-01T00:00:00.000Z' }),
        }),
      ],
    });

    expect(idsNow()).not.toContain('session.autopilotOn');
    expect(idsNow()).not.toContain('session.autopilotOff');
  });
});
