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
import { resolveActions } from '../resolveActions';
import { SESSION_KIND } from './session';

let useAppStore: StoryStore;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-acme-notes' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-launch-memo' });
const TARGET = { kind: 'session', sessionId: SESSION_ID } as const;

type BranchParams = Readonly<{ branch: string }>;

const seed = ({ branch }: BranchParams) => {
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      buildStorySession({
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        goal: 'Tighten the launch memo',
      }),
    ],
    sessionBranches: { [SESSION_ID]: branch },
  });
};

const idsNow = (): ReadonlyArray<string> => {
  const facts = SESSION_KIND.facts({ state: useAppStore.getState(), target: TARGET });
  if (facts === null) {
    throw new Error('no facts');
  }
  return resolveActions({ definitions: SESSION_KIND.actions, facts }).map((action) => action.id);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('session verbs in a plain folder', () => {
  it('offers Changes and leaves Comments and Files unregistered without a branch', () => {
    seed({ branch: '' });

    const ids = idsNow();

    expect(ids).toContain('session.changes');
    expect(ids).not.toContain('session.review');
    expect(ids).not.toContain('session.diff');
  });

  it('keeps Comments and Files for a session on a branch', () => {
    seed({ branch: 'goodboy/launch-memo' });

    const ids = idsNow();

    expect(ids).toContain('session.review');
    expect(ids).toContain('session.diff');
    expect(ids).not.toContain('session.changes');
  });
});
