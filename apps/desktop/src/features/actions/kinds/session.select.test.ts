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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { resolveActions } from '../resolveActions';
import { SELECT_REQUEST_EVENT } from '../selectRequest';
import type { ActionEnv, ActionViewing } from '../types';
import { SESSION_KIND, sessionObjectKey } from './session';

let useAppStore: StoryStore;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const TARGET = { kind: 'session', sessionId: SESSION_ID } as const;
const ROW_SELECTION: ActionViewing = { kind: 'selection', id: SESSION_ID };

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

afterEach(() => {
  vi.restoreAllMocks();
});

const factsNow = () => {
  const facts = SESSION_KIND.facts({ state: useAppStore.getState(), target: TARGET });
  if (facts === null) {
    throw new Error('no facts');
  }
  return facts;
};

const resolved = (viewing: ActionViewing | null) =>
  resolveActions({ definitions: SESSION_KIND.actions, facts: factsNow(), viewing });

describe('the Select item of a session row menu', () => {
  it('shows only where a row can be selected, never in the palette or a header menu', () => {
    expect(resolved(ROW_SELECTION).map((action) => action.id)).toContain('session.select');
    expect(resolved(null).map((action) => action.id)).not.toContain('session.select');
  });

  it('reads Select, with no host or shortcut word', () => {
    const select = resolved(ROW_SELECTION).find((action) => action.id === 'session.select');
    expect(select?.label).toBe('Select');
    expect(select?.ariaLabel).toBeNull();
  });

  it('asks the row of its own anchor to select, and no other', () => {
    const select = SESSION_KIND.actions.find((action) => action.id === 'session.select');
    const received: Array<unknown> = [];
    const listener = (event: Event) => {
      if (event instanceof CustomEvent) {
        received.push(event.detail);
      }
    };
    window.addEventListener(SELECT_REQUEST_EVENT, listener);
    const env: ActionEnv = {
      getState: () => useAppStore.getState(),
      showToast: vi.fn(),
      copyText: vi.fn(async () => undefined),
      origin: 'menu',
      anchorKey: `sidebar:${SESSION_ID}`,
      viewing: ROW_SELECTION,
    };
    void select?.run({ facts: factsNow(), env, choice: null });
    window.removeEventListener(SELECT_REQUEST_EVENT, listener);

    expect(received).toEqual([
      {
        objectKey: sessionObjectKey({ sessionId: SESSION_ID }),
        anchorKey: `sidebar:${SESSION_ID}`,
      },
    ]);
  });
});
