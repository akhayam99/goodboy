// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { WorkspaceScriptsDrawer } from '.';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: WS,
    projects: [
      aProject({
        id: LEDGER,
        workspaceId: WS,
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
      }),
    ],
    loadProjectRootScripts: async () => undefined,
    loadScriptPins: async () => undefined,
    projectRootScripts: {
      '/repos/ledger-core': {
        status: 'ready',
        error: null,
        groups: [
          {
            source: 'package-json',
            packageName: 'ledger-core',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'dev', body: 'vite', command: 'pnpm run dev' }],
          },
        ],
      },
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('the Scripts panel with no session', () => {
  it('lists the scripts of each project of the workspace', async () => {
    render(<WorkspaceScriptsDrawer workspaceId={WS} projectId={null} onClose={() => undefined} />);

    await screen.findByRole('region', { name: 'ledger-core' });
    screen.getByText('dev');
  });

  it('runs a script in a shell on the project folder of the workspace', async () => {
    render(<WorkspaceScriptsDrawer workspaceId={WS} projectId={null} onClose={() => undefined} />);

    fireEvent.click(await screen.findByLabelText('Run dev in ledger-core'));

    const state = useAppStore.getState();
    const tabs = state.terminalTabs[`ws:${WS}`] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.cwd).toBe('/repos/ledger-core');
    expect(tabs[0]?.prefill).toBe('pnpm run dev\r');
    expect(state.drawer).toMatchObject({ kind: 'terminal', sessionId: null });
  });
});
