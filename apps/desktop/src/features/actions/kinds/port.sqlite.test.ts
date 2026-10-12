import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { bindTarget } from '../registry';
import type { ActionEnv } from '../types';
import { PORT_EDIT_EVENT, type PortFacts } from './port';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();

let useAppStore: StoryStore;

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
});

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

type FactsParams = {
  readonly facts: PortFacts;
};

const bound = ({ facts }: FactsParams) => {
  const found = bindTarget({ state: useAppStore.getState(), target: { kind: 'port', facts } });
  if (found === null) {
    throw new Error('the port target did not bind');
  }
  return found;
};

const idsOf = ({ facts }: FactsParams): ReadonlyArray<string> =>
  bound({ facts })
    .resolve()
    .map((action) => action.id);

describe('the port kind', () => {
  it('offers Pin and Hide on a workspace or Goodboy port and nothing else', () => {
    expect(idsOf({ facts: { port: 5173, layer: 'workspace', description: 'dev' } })).toEqual([
      'port.pin',
      'port.hide',
    ]);
    expect(idsOf({ facts: { port: 4321, layer: 'goodboy', description: '' } })).toEqual([
      'port.pin',
      'port.hide',
    ]);
    expect(idsOf({ facts: { port: 6000, layer: 'listening', description: '' } })).toEqual([
      'port.pin',
      'port.hide',
    ]);
  });

  it('offers Edit description and Unpin on a pinned port and nothing else', () => {
    expect(idsOf({ facts: { port: 9000, layer: 'pinned', description: 'Mock API' } })).toEqual([
      'port.editDescription',
      'port.unpin',
    ]);
  });

  it('pins with the description of the row', async () => {
    await bound({ facts: { port: 5173, layer: 'workspace', description: 'dev' } }).run({
      actionId: 'port.pin',
      env: env(),
    });

    expect(useAppStore.getState().monitorPinned).toEqual([{ port: 5173, description: 'dev' }]);
  });

  it('hides from the layer the row sits in', async () => {
    await bound({ facts: { port: 4321, layer: 'goodboy', description: '' } }).run({
      actionId: 'port.hide',
      env: env(),
    });

    expect(useAppStore.getState().monitorHidden).toEqual([{ port: 4321, source: 'goodboy' }]);
  });

  it('unpins a pinned port', async () => {
    await useAppStore.getState().pinPort({ port: 9000, description: 'Mock API' });

    await bound({ facts: { port: 9000, layer: 'pinned', description: 'Mock API' } }).run({
      actionId: 'port.unpin',
      env: env(),
    });

    expect(useAppStore.getState().monitorPinned).toEqual([]);
  });

  it('asks the row to edit its description', async () => {
    const heard = vi.fn();
    window.addEventListener(PORT_EDIT_EVENT, heard);

    await bound({ facts: { port: 9000, layer: 'pinned', description: 'Mock API' } }).run({
      actionId: 'port.editDescription',
      env: env(),
    });
    window.removeEventListener(PORT_EDIT_EVENT, heard);

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('refuses an action the layer does not offer', async () => {
    await bound({ facts: { port: 9000, layer: 'pinned', description: '' } }).run({
      actionId: 'port.hide',
      env: env(),
    });

    expect(useAppStore.getState().monitorHidden).toEqual([]);
  });
});
