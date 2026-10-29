// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { readAutoLevel } from '../../../store/runtime/auto/level/readAutoLevel';
import { writeAutoLevel } from '../../../store/runtime/auto/level/writeAutoLevel';
import { runRouteOf, type RunRouteFacts } from './runRouteOf';
import { startRoutedRun } from './startRoutedRun';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const MISSING = brandId<SessionId>({ value: 'session-notify-relay' });

const FACTS: RunRouteFacts = {
  text: 'Why does the ledger-core importer drop rows?',
  presets: [],
  roles: [],
  lastPresetId: null,
  defaultShape: 'auto',
  hasTask: false,
  mountCount: 1,
  pullRequest: null,
  fileCount: 0,
};

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const result = runRouteOf({ facts: FACTS });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  useAppStore.setState({
    sessions: [
      aSession({ id: AUTO_SEED_SESSION, workspaceId: WORKSPACE }),
      aSession({ id: MISSING, workspaceId: WORKSPACE }),
    ],
    workspaceOverrides: {},
    settings: {},
  });
});

const mockSpawn = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
  useAppStore.setState({ spawnAgent });
  return spawnAgent;
};

describe('startRoutedRun stores the Auto level', () => {
  it('writes the picked level for the session before the lead starts', async () => {
    const spawnAgent = mockSpawn();
    spawnAgent.mockImplementationOnce(async () => {
      expect(
        await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
      ).toBe('step');
      return AGENT;
    });

    await startRoutedRun({ sessionId: AUTO_SEED_SESSION, result, level: 'step' });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('step');
  });

  it('writes nothing when no level was picked, so the workspace default applies', async () => {
    mockSpawn();
    await writeAutoLevel({ db: storySqlite(), target: { workspaceId: WORKSPACE }, level: 'run' });

    await startRoutedRun({ sessionId: AUTO_SEED_SESSION, result });

    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('run');
  });

  it('does not start the lead and keeps the old level when the write fails', async () => {
    const spawnAgent = mockSpawn();
    await writeAutoLevel({ db: storySqlite(), target: { workspaceId: WORKSPACE }, level: 'run' });

    await expect(startRoutedRun({ sessionId: MISSING, result, level: 'step' })).rejects.toThrow(
      'The session no longer exists.',
    );

    expect(spawnAgent).not.toHaveBeenCalled();
    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('run');
  });

  it('leaves the level alone for a run with a role', async () => {
    mockSpawn();

    await startRoutedRun({
      sessionId: AUTO_SEED_SESSION,
      result: { ...result, role: 'tester' },
      level: 'step',
    });

    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('plan');
  });
});
